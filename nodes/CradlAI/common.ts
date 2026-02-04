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
import { cradlApiRequest } from './api';
import { EVALUATE_PREDICTION_FUNCTION_ID, EXPORT_TO_N8N_FUNCTION_ID } from './constants';

export type Action = {
    actionId: string;
    functionId: string;
    config: JsonObject;
}

export async function handleWebhookResponse(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const req = this.getRequestObject();

    const calculateSignature = this.getNodeParameter('calculateSignature', false) as boolean;

    if (calculateSignature) {
        const signature = req.headers['x-cradl-signature'] as string | undefined;
        if (!signature) {
            throw new NodeOperationError(this.getNode(), 'X-Cradl-Signature header is missing');
        }

        const signedHeaders = req.headers['x-cradl-signedheaders'] as string | undefined;
        if (!signedHeaders) {
            throw new NodeOperationError(this.getNode(), 'X-Cradl-SignedHeaders header is missing');
        }

        const data = this.getWorkflowStaticData('node');
        const hmacSecret = this.getNodeParameter('hmacSecret', data.actionId) as string | undefined;
        if (!hmacSecret) {
            throw new NodeOperationError(this.getNode(), 'HMAC secret is required to calculate signature');
        }

        const signedHeadersList = signedHeaders.split(',');
        signedHeadersList.sort();

        const parts = [
            req.method.toUpperCase(),
            `${req.headers['x-forwarded-proto'] ?? req.protocol}://${req.host}${req.originalUrl}`,
        ];

        for (const header of signedHeadersList) {
            const headerValue = req.headers[header];
            if (!headerValue) {
                throw new NodeOperationError(this.getNode(), `Signed header ${header} is missing`);
            }
            parts.push(`${header.toLowerCase()}:${headerValue}`);
        }

        parts.push(req.rawBody.toString());

        const calculatedSignature = createHmac('sha256', hmacSecret).update(parts.join('')).digest('hex');

        if (calculatedSignature !== signature) {
            throw new NodeOperationError(this.getNode(), `Invalid signature: received ${signature} but expected ${calculatedSignature} signing message: ${parts.join('')}`);
        }
    }

    const document = await cradlApiRequest.call(this, {
        method: 'GET',
        path: `/documents/${req.body.context.documentId}`,
    });

    const documentContent = await cradlApiRequest.call(this, {
        method: 'GET',
        url: document.fileUrl,
        encoding: 'arraybuffer',
    });

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

export async function getAction(this: IHookFunctions | IExecuteFunctions, agentId: string): Promise<Action | undefined> {
    const data = this.getWorkflowStaticData('node');

    if (data.actionId) {
        try {
            return await cradlApiRequest.call(this, {
                method: 'GET',
                path: `/actions/${data.actionId}`,
            });
        } catch { /* empty */ }
    }

    try {
        const agent = await cradlApiRequest.call(this, {
            method: 'GET',
            path: `/agents/${agentId}`,
        });

        for (const resourceId of agent.resourceIds ?? []) {
            if (!resourceId.startsWith('cradl:action:')) {
                continue;
            }

            let action;
            try {
                action = await cradlApiRequest.call(this, {
                    method: 'GET',
                    path: `/actions/${resourceId}`,
                });
            } catch {
                continue;
            }

            if (action.config?.nodeId === this.getNode().id) {
                return action as Action;
            }
        }
    } catch { /* empty */ }

    return;
}

export async function updateAction(this: IHookFunctions | IExecuteFunctions, action: Action, webhookUrl: string, hmacSecret?: string): Promise<boolean> {
    const data = this.getWorkflowStaticData('node');
 
    let needsUpdate = false;

    if (action.functionId !== EXPORT_TO_N8N_FUNCTION_ID) needsUpdate = true;
    if (action.config.url !== webhookUrl) needsUpdate = true;
    if (action.config.httpMethod !== 'POST') needsUpdate = true;
    if (action.config.nodeId !== this.getNode().id) needsUpdate = true;
    if (action.config.hmacSecret !== hmacSecret) needsUpdate = true;

    if (!needsUpdate) {
        data.actionId = action.actionId;
        return true;
    }

    try {
        cradlApiRequest.call(this, {
            method: 'PATCH',
            path: `/actions/${action.actionId}`,
            body: {
                functionId: EXPORT_TO_N8N_FUNCTION_ID,
                config: {
                    hmacSecret,
                    httpMethod: 'POST',
                    nodeId: this.getNode().id,
                    url: webhookUrl,
                },
            },
        })

        data.actionId = action.actionId;
        return true;
    } catch { /* empty */ }

    return false;
}

export async function createAction(this: IHookFunctions | IExecuteFunctions, agentId: string, webhookUrl: string, hmacSecret?: string): Promise<boolean> {
    const data = this.getWorkflowStaticData('node');

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
        const action = await cradlApiRequest.call(this, {
            method: 'POST',
            path: '/actions',
            body: {
                functionId: EXPORT_TO_N8N_FUNCTION_ID,
                name: 'Export to n8n',
                config: {
                    hmacSecret,
                    httpMethod: 'POST',
                    nodeId: this.getNode().id,
                    url: webhookUrl,
                },
            },
        });

        cleanupFns.push(() => cradlApiRequest.call(this, {
            method: 'DELETE',
            path: `/actions/${action.actionId}`,
        }));

        const reviewHook = await cradlApiRequest.call(this, {
            method: 'POST',
            path: '/hooks',
            body: {
                config: {},
                trigger: 'ValidationTask has Completed',
                trueActionId: action.actionId,
            },
        });

        cleanupFns.push(() => cradlApiRequest.call(this, {
            method: 'DELETE',
            path: `/hooks/${reviewHook.hookId}`,
        }));

        const autoHook = await cradlApiRequest.call(this, {
            method: 'POST',
            path: '/hooks',
            body: {
                functionId: EVALUATE_PREDICTION_FUNCTION_ID,
                config: {},
                trigger: 'Prediction is Created',
                trueActionId: action.actionId,
            },
        });

        cleanupFns.push(() => cradlApiRequest.call(this, {
            method: 'DELETE',
            path: `/hooks/${autoHook.hookId}`,
        }));

        const agent = await cradlApiRequest.call(this, {
            method: 'GET',
            path: `/agents/${agentId}`,
        });

        await cradlApiRequest.call(this, {
            method: 'PATCH',
            path: `/agents/${agentId}`,
            body: {
                resourceIds: [...agent.resourceIds, action.actionId, reviewHook.hookId, autoHook.hookId],
            },
        });

        data.actionId = action.actionId as string;
        return true;
    } catch {
        await onCleanup();
    }

    return false;
}

export async function deleteAction(this: IHookFunctions | IExecuteFunctions, agentId: string): Promise<boolean> {
    const data = this.getWorkflowStaticData('node');

    if (data.actionId !== undefined) {
        try {
            const { hooks } = await cradlApiRequest.call(this, { method: 'GET', path: '/hooks' });
            const deletedHookIds = [];

            for (const hook of hooks) {
                const updates: { trueActionId?: string | null; falseActionId?: string | null } = {};

                if (hook.trueActionId === data.actionId) {
                    updates.trueActionId = null;
                }

                if (hook.falseActionId === data.actionId) {
                    updates.falseActionId = null;
                }

                if (Object.keys(updates).length > 0) {
                    const afterUpdate = { ...hook, ...updates };

                    /* Delete the hook if it no longer has any actions */
                    if ([afterUpdate.trueActionId, afterUpdate.falseActionId].every((id) => id == null)) {
                        await cradlApiRequest.call(this, {
                            method: 'DELETE',
                            path: `/hooks/${hook.hookId}`,
                        });
                        deletedHookIds.push(hook.hookId);
                    } else {
                        await cradlApiRequest.call(this, {
                            method: 'PATCH',
                            path: `/hooks/${hook.hookId}`,
                            body: updates,
                        });
                    }
                }
            }

            await cradlApiRequest.call(this, {
                method: 'DELETE',
                path: `/actions/${data.actionId}`,
            });

            const agent = await cradlApiRequest.call(this, {
                method: 'GET',
                path: `/agents/${agentId}`,
            });

            await cradlApiRequest.call(this, {
                method: 'PATCH',
                path: `/agents/${agentId}`,
                body: {
                    resourceIds: [...agent.resourceIds].filter((id: string) => id !== data.actionId),
                },
            });

            delete data.actionId;
        } catch {
            return false;
        }
    }

    return true;
}

export async function getAgentIdOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
    const { agents } = await cradlApiRequest.call(this, { method: 'GET', path: '/agents' });
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
    const { documents } = await cradlApiRequest.call(this, { method: 'GET', path: '/documents' });
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

export async function ensureWebhookExists(this: IExecuteFunctions, agentId: string, webhookUrl: string, hmacSecret?: string): Promise<boolean> {
    const action = await getAction.call(this, agentId);
    let exists;

    if (action) {
        exists = await updateAction.call(this, action, webhookUrl, hmacSecret);
    } else {
        exists = false;
    }

    if (exists) return true;

    return await createAction.call(this, agentId, webhookUrl, hmacSecret);
}
