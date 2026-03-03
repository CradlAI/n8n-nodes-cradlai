import {
  type IHookFunctions,
  type IWebhookFunctions,
  type INodeType,
  type INodeTypeDescription,
  type IWebhookResponseData,
  NodeConnectionTypes,
  INodeTypeBaseDescription,
} from 'n8n-workflow';
import { createAction, deleteAction, getAction, getAgentIdOptions, handleWebhookResponse, updateAction } from './common';
import { CREDENTIALS_NAME } from '../common/constants';
import {
  PROPERTY_NAME_AGENT_ID,
  PROPERTY_NAME_HMAC_SECRET,
  WEBHOOK_NAME,
} from './constants';

const versionDescription: INodeTypeDescription = {
  version: 1,
  description: 'Handle processed document events via webhooks',
  displayName: 'Cradl AI Trigger',
  group: ['trigger'],
  icon: { light: 'file:cradl.svg', dark: 'file:cradl.dark.svg' },
  name: 'cradlAiTrigger',
  subtitle: '={{ $parameter["operation"] }}',
  defaults: { name: 'Cradl AI Trigger' },
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
          name: 'On Extracted Data From Document',
          value: 'onExtractedDataFromDocument',
          action: 'On extracted data from document',
          description: 'Triggers when document data extraction is completed. If human-in-the-loop is configured, the trigger fires after the review step is finished.',
        },
      ],
      default: 'onExtractedDataFromDocument',
    },
    {
      displayName: 'Agent Name or ID',
      name: PROPERTY_NAME_AGENT_ID,
      type: 'options',
      typeOptions: {
        loadOptionsMethod: 'getAgentIdOptions',
      },
      default: '',
      description: 'Select which Cradl AI agent this node should use. This determines how the document is processed and what data is extracted. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
      required: true,
    },
    {
      displayName: 'Show Advanced Options',
      name: 'showAdvancedOptions',
      type: 'boolean',
      default: false,
    },
    {
      displayName: 'HMAC Secret',
      name: PROPERTY_NAME_HMAC_SECRET,
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      description: 'The shared secret used to generate and verify the HMAC signature. Keep this value secure.',
      displayOptions: {
        show: {
          showAdvancedOptions: [true],
        },
      },
    },
  ],
};

/* eslint-disable @n8n/community-nodes/icon-validation */
export class CradlAiTriggerV1 implements INodeType {
  description: INodeTypeDescription;

  constructor(baseDescription: INodeTypeBaseDescription) {
    this.description = {
      ...baseDescription,
      ...versionDescription,
    };
  }

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

        const credentials = await this.getCredentials(CREDENTIALS_NAME);
        const hmacSecret = this.getNodeParameter(PROPERTY_NAME_HMAC_SECRET, credentials.clientSecret as string | undefined) as string | undefined;

        await updateAction(this, action, webhookUrl, hmacSecret);
        return true;
      },

      async create(this: IHookFunctions): Promise<boolean> {
        const agentId = this.getNodeParameter(PROPERTY_NAME_AGENT_ID) as string | undefined;
        if (!agentId) return false;

        const webhookUrl = this.getNodeWebhookUrl(WEBHOOK_NAME);
        if (!webhookUrl) return false;

        const credentials = await this.getCredentials(CREDENTIALS_NAME);
        const hmacSecret = this.getNodeParameter(PROPERTY_NAME_HMAC_SECRET, credentials.clientSecret as string | undefined) as string | undefined;

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
