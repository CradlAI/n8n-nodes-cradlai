import {
  BINARY_ENCODING,
  IExecuteFunctions,
  IHookFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodePropertyOptions,
  IWebhookFunctions,
  IWebhookResponseData,
  JsonObject,
  NodeOperationError,
} from 'n8n-workflow';
import { createHmac } from 'crypto';
import { cradlApiRequest } from '../common/api';
import { CREDENTIALS_NAME, EVALUATE_PREDICTION_FUNCTION_ID, EXPORT_TO_N8N_FUNCTION_ID } from '../common/constants';
import { PROPERTY_NAME_HMAC_SECRET } from './constants';

export type Action = {
  actionId: string;
  functionId: string;
  config: JsonObject;
}

const getParam = <T>(context: IWebhookFunctions, name: string, defaultValue?: T) => {
  const param = context.getNodeParameter(name, defaultValue);

  if (param == null || param === '') {
    throw new NodeOperationError(context.getNode(), `Parameter "${name}" is required`);
  }

  return param as T;
}

export const verifySignature = async (context: IWebhookFunctions) => {
  const req = context.getRequestObject();

  const getHeader = (name: string): string => {
    const header = req.headers[name.toLowerCase()];
    if (header == null) throw new NodeOperationError(context.getNode(), `Header "${name}" is missing`);
    return header as string;
  };

  const signedHeaders = getHeader('x-cradl-signedheaders');
  const signedHeadersList = signedHeaders.split(',');
  signedHeadersList.sort();

  const parts = [
    req.method.toUpperCase(),
    `${req.headers['x-forwarded-proto'] ?? req.protocol}://${req.host}${req.originalUrl}`,
  ];

  for (const header of signedHeadersList) {
    const headerValue = getHeader(header);
    parts.push(`${header.toLowerCase()}:${headerValue}`);
  }

  parts.push(req.rawBody.toString());

  const credentials = await context.getCredentials(CREDENTIALS_NAME);
  const hmacSecret = getParam(context, PROPERTY_NAME_HMAC_SECRET, credentials.clientSecret as string | undefined);
  const calculatedSignature = createHmac('sha256', hmacSecret).update(parts.join('')).digest('hex');

  const signature = getHeader('x-cradl-signature');
  if (calculatedSignature !== signature) {
    throw new NodeOperationError(context.getNode(), `Invalid signature: received ${signature} but expected ${calculatedSignature} signing message: ${parts.join('')}`);
  }
}

export const handleWebhookResponse = async (context: IWebhookFunctions): Promise<IWebhookResponseData> => {
  await verifySignature(context);

  const req = context.getRequestObject();

  let document;
  let documentContent;
  try {
    document = await cradlApiRequest(context, {
      method: 'GET',
      path: `/documents/${req.body.context.documentId}`,
    });

    documentContent = await cradlApiRequest(context, {
      method: 'GET',
      url: document.fileUrl,
      encoding: 'arraybuffer',
    });
  } catch (error: unknown) {
    throw new NodeOperationError(
      context.getNode(),
      error as Error,
      { message: `Failed to retrieve document ${req.body.context.documentId} from Cradl AI` },
    );
  }

  const response: INodeExecutionData = {
    json: {
      headers: req.headers,
      params: req.params,
      query: req.query,
      body: req.body,
    },
    binary: {
      document: {
        data: documentContent.toString(BINARY_ENCODING),
        fileName: document.name,
        fileSize: document.contentLength,
        mimeType: document.contentType,
      },
    }
  };

  return { workflowData: [[response]] };
}

export const getAction = async (context: IHookFunctions | IExecuteFunctions, agentId: string): Promise<Action | undefined> => {
  const data = context.getWorkflowStaticData('node');

  if (data.actionId) {
    try {
      return await cradlApiRequest(context, {
        method: 'GET',
        path: `/actions/${data.actionId}`,
      });
    } catch { /* empty */ }
  }

  try {
    const agent = await cradlApiRequest(context, {
      method: 'GET',
      path: `/agents/${agentId}`,
    });

    for (const resourceId of agent.resourceIds ?? []) {
      if (!resourceId.startsWith('cradl:action:')) {
        continue;
      }

      let action;
      try {
        action = await cradlApiRequest(context, {
          method: 'GET',
          path: `/actions/${resourceId}`,
        });
      } catch {
        continue;
      }

      if (action.config?.nodeId === context.getNode().id) {
        return action as Action;
      }
    }
  } catch { /* empty */ }

  return;
}

export const updateAction = async (
  context: IHookFunctions | IExecuteFunctions,
  action: Action,
  webhookUrl: string,
  hmacSecret?: string,
) => {
  const data = context.getWorkflowStaticData('node');
  const workflowName = context.getWorkflow().name;
  const nodeId = context.getNode().id;

  let needsUpdate = false;

  if (action.functionId !== EXPORT_TO_N8N_FUNCTION_ID) needsUpdate = true;
  if (action.config.hmacSecret !== hmacSecret) needsUpdate = true;
  if (action.config.httpMethod !== 'POST') needsUpdate = true;
  if (action.config.nodeId !== nodeId) needsUpdate = true;
  if (action.config.url !== webhookUrl) needsUpdate = true;
  if (action.config.workflowName !== workflowName) needsUpdate = true;

  if (!needsUpdate) {
    data.actionId = action.actionId;
    return;
  }

  try {
    cradlApiRequest(context, {
      method: 'PATCH',
      path: `/actions/${action.actionId}`,
      body: {
        functionId: EXPORT_TO_N8N_FUNCTION_ID,
        config: {
          hmacSecret,
          httpMethod: 'POST',
          nodeId,
          url: webhookUrl,
          workflowName,
        },
      },
    })
    data.actionId = action.actionId;
  } catch (error: unknown) {
    throw new NodeOperationError(
      context.getNode(),
      error as Error,
      { message: 'Failed to update webhook in Cradl AI' },
    );
  }
}

export const createAction = async (
  context: IHookFunctions | IExecuteFunctions,
  agentId: string,
  webhookUrl: string,
  hmacSecret?: string,
) => {
  const data = context.getWorkflowStaticData('node');
  const workflowName = context.getWorkflow().name;
  const nodeId = context.getNode().id;

  const cleanupFns: (() => Promise<unknown>)[] = [];

  const onCleanup = async () => {
    /* cleanup in reverse order */
    for (const fn of [...cleanupFns].reverse()) {
      try {
        await fn();
      } catch { /* empty */ }
    }
  };

  try {
    const action = await cradlApiRequest(context, {
      method: 'POST',
      path: '/actions',
      body: {
        functionId: EXPORT_TO_N8N_FUNCTION_ID,
        name: 'Export to n8n',
        config: {
          hmacSecret,
          httpMethod: 'POST',
          nodeId,
          url: webhookUrl,
          workflowName,
        },
      },
    });

    cleanupFns.push(() => cradlApiRequest(context, {
      method: 'DELETE',
      path: `/actions/${action.actionId}`,
    }));

    const reviewHook = await cradlApiRequest(context, {
      method: 'POST',
      path: '/hooks',
      body: {
        config: {},
        trigger: 'ValidationTask has Completed',
        trueActionId: action.actionId,
      },
    });

    cleanupFns.push(() => cradlApiRequest(context, {
      method: 'DELETE',
      path: `/hooks/${reviewHook.hookId}`,
    }));

    const autoHook = await cradlApiRequest(context, {
      method: 'POST',
      path: '/hooks',
      body: {
        functionId: EVALUATE_PREDICTION_FUNCTION_ID,
        config: {},
        trigger: 'Prediction is Created',
        trueActionId: action.actionId,
      },
    });

    cleanupFns.push(() => cradlApiRequest(context, {
      method: 'DELETE',
      path: `/hooks/${autoHook.hookId}`,
    }));

    const agent = await cradlApiRequest(context, {
      method: 'GET',
      path: `/agents/${agentId}`,
    });

    await cradlApiRequest(context, {
      method: 'PATCH',
      path: `/agents/${agentId}`,
      body: {
        resourceIds: [...agent.resourceIds, action.actionId, reviewHook.hookId, autoHook.hookId],
      },
    });

    data.actionId = action.actionId as string;
  } catch (error: unknown) {
    await onCleanup();
    throw new NodeOperationError(
      context.getNode(),
      error as Error,
      { message: 'Failed to create webhook in Cradl AI' },
    );
  }
}

export const deleteAction = async (context: IHookFunctions | IExecuteFunctions, agentId: string): Promise<boolean> => {
  const data = context.getWorkflowStaticData('node');
  const action = await getAction(context, agentId);

  if (action) {
    try {
      const { hooks } = await cradlApiRequest(context, { method: 'GET', path: '/hooks' });
      const deletedHookIds = [];

      for (const hook of hooks) {
        const updates: { trueActionId?: string | null; falseActionId?: string | null } = {};

        if (hook.trueActionId === action.actionId) {
          updates.trueActionId = null;
        }

        if (hook.falseActionId === action.actionId) {
          updates.falseActionId = null;
        }

        if (Object.keys(updates).length > 0) {
          const afterUpdate = { ...hook, ...updates };

          /* Delete the hook if it no longer has any actions */
          if ([afterUpdate.trueActionId, afterUpdate.falseActionId].every((id) => id == null)) {
            await cradlApiRequest(context, {
              method: 'DELETE',
              path: `/hooks/${hook.hookId}`,
            });
            deletedHookIds.push(hook.hookId);
          } else {
            await cradlApiRequest(context, {
              method: 'PATCH',
              path: `/hooks/${hook.hookId}`,
              body: updates,
            });
          }
        }
      }

      await cradlApiRequest(context, {
        method: 'DELETE',
        path: `/actions/${action.actionId}`,
      });

      const agent = await cradlApiRequest(context, {
        method: 'GET',
        path: `/agents/${agentId}`,
      });

      await cradlApiRequest(context, {
        method: 'PATCH',
        path: `/agents/${agentId}`,
        body: {
          resourceIds: [...agent.resourceIds].filter((id: string) => id !== action.actionId),
        },
      });

      delete data.actionId;
    } catch (error: unknown) {
      throw new NodeOperationError(
        context.getNode(),
        error as Error,
        { message: 'Failed to delete webhook in Cradl AI' },
      );
    }
  }

  return true;
}

export async function getAgentIdOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
  const { agents } = await cradlApiRequest(this, { method: 'GET', path: '/agents' });
  const options: INodePropertyOptions[] = [];

  if (agents && Array.isArray(agents)) {
    agents.forEach((agent: { name: string; agentId: string }) => {
      options.push({
        name: agent.name || agent.agentId,
        value: agent.agentId,
      });
    });
  }

  return options;
}

export async function getDocumentIdOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
  const { documents } = await cradlApiRequest(this, { method: 'GET', path: '/documents' });
  const options: INodePropertyOptions[] = [];

  if (documents && Array.isArray(documents)) {
    documents.forEach((document: { name: string; documentId: string }) => {
      options.push({
        name: document.name || document.documentId,
        value: document.documentId,
      });
    });
  }

  return options;
}

export const ensureWebhookExists = async (
  context: IExecuteFunctions,
  agentId: string,
  webhookUrl: string,
  hmacSecret?: string,
) => {
  const action = await getAction(context, agentId);
  if (action) {
    await updateAction(context, action, webhookUrl, hmacSecret);
  } else {
    await createAction(context, agentId, webhookUrl, hmacSecret);
  }
}
