import {
  type IHookFunctions,
  type IWebhookFunctions,
  type INodeType,
  type INodeTypeDescription,
  type IWebhookResponseData,
  NodeConnectionTypes,
} from 'n8n-workflow';
import { createAction, deleteAction, getAction, getAgentIdOptions, handleWebhookResponse, updateAction } from './common';
import {
  CREDENTIALS_NAME,
  DEFAULT_VALUE_CALCULATE_SIGNATURE,
  PROPERTY_NAME_AGENT_ID,
  PROPERTY_NAME_CALCULATE_SIGNATURE,
  PROPERTY_NAME_HMAC_SECRET,
  WEBHOOK_NAME,
} from './constants';

export class CradlAiTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Cradl AI Trigger',
    name: 'cradlAiTrigger',
    icon: { light: 'file:cradl.svg', dark: 'file:cradl.dark.svg' },
    group: ['trigger'],
    version: 1,
    description: 'Handle processed document events via webhooks',
    defaults: {
      name: 'Cradl AI Trigger',
    },
    inputs: [],
    outputs: [NodeConnectionTypes.Main],
    credentials: [
      {
        name: CREDENTIALS_NAME,
        required: true,
      }
    ],
    webhooks: [
      {
        name: WEBHOOK_NAME,
        httpMethod: 'POST',
        responseMode: 'onReceived',
        path: '',
        isFullPath: true,
      },
    ],
    properties: [
      {
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Parsed and Reviewed Document Received',
						value: 'parsedAndReviewedDocumentReceived',
						description: 'Receive a webhook from Cradl AI when a document has been parsed and validated',
						action: 'Receive a webhook when a document has been parsed and validated'
					},
				],
				default: 'parsedAndReviewedDocumentReceived',
			},
      {
        displayName: 'Agent Name or ID',
        name: PROPERTY_NAME_AGENT_ID,
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getAgentIdOptions',
        },
        default: '',
        description: 'Select a value from the API. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
        required: true,
      },
      {
        displayName: 'Calculate Signature',
        name: PROPERTY_NAME_CALCULATE_SIGNATURE,
        type: 'boolean',
        // eslint-disable-next-line n8n-nodes-base/node-param-default-wrong-for-boolean
        default: DEFAULT_VALUE_CALCULATE_SIGNATURE,
        description: 'Whether to calculate HMAC signature for incoming webhooks for security',
      },
      {
        displayName: 'HMAC Secret',
        name: PROPERTY_NAME_HMAC_SECRET,
        type: 'string',
        typeOptions: {
          password: true,
        },
        default: '',
        description: 'The secret used to calculate the HMAC signature',
        displayOptions: {
          show: {
            calculateSignature: [true],
          },
        },
      },
    ],
    usableAsTool: true,
  };

  methods = {
    loadOptions: {
      getAgentIdOptions,
    },
  };

  webhookMethods = {
    [WEBHOOK_NAME]: {
      async checkExists(this: IHookFunctions): Promise<boolean> {
        const agentId = this.getNodeParameter(PROPERTY_NAME_AGENT_ID) as string | undefined;
        if (!agentId) return false;

        const action = await getAction(this, agentId);
        if (!action) return false;

        const webhookUrl = this.getNodeWebhookUrl(WEBHOOK_NAME);
        if (!webhookUrl) return false;

        const hmacSecret = this.getNodeParameter(PROPERTY_NAME_HMAC_SECRET) as string | undefined;
        await updateAction(this, action, webhookUrl, hmacSecret);
        return true;
      },

      async create(this: IHookFunctions): Promise<boolean> {
        const agentId = this.getNodeParameter(PROPERTY_NAME_AGENT_ID) as string | undefined;
        if (!agentId) return false;

        const webhookUrl = this.getNodeWebhookUrl(WEBHOOK_NAME);
        if (!webhookUrl) return false;

        const hmacSecret = this.getNodeParameter(PROPERTY_NAME_HMAC_SECRET) as string | undefined;
        await createAction(this, agentId, webhookUrl, hmacSecret);
        return true;
      },

      async delete(this: IHookFunctions): Promise<boolean> {
        const agentId = this.getNodeParameter(PROPERTY_NAME_AGENT_ID) as string | undefined;
        if (!agentId) return false;

        await deleteAction(this, agentId);
        return true;
      },
    },
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    return handleWebhookResponse(this);
  }
}
