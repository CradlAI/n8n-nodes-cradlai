import type {
  IBinaryData,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeBaseDescription,
  INodeTypeDescription,
  IWebhookFunctions,
  IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError, WAIT_INDEFINITELY } from 'n8n-workflow';
import { cradlApiRequest } from '../common/api';
import { deleteAction, ensureWebhookExists, getAgentIdOptions, getDocumentIdOptions, handleWebhookResponse } from './common';
import { CREDENTIALS_NAME } from '../common/constants';
import {
  DEFAULT_VALUE_CALCULATE_SIGNATURE,
  DEFAULT_VALUE_RESUME_URL_VARIABLE_NAME,
  DEFAULT_VALUE_USE_EXISTING_DOCUMENT,
  DEFAULT_VALUE_VARIABLES,
  DEFAULT_VALUE_WAIT_FOR_RESULTS,
  PROPERTY_NAME_AGENT_ID,
  PROPERTY_NAME_CALCULATE_SIGNATURE,
  PROPERTY_NAME_DOCUMENT_BINARY_DATA,
  PROPERTY_NAME_DOCUMENT_ID,
  PROPERTY_NAME_HMAC_SECRET,
  PROPERTY_NAME_RESUME_URL_VARIABLE_NAME,
  PROPERTY_NAME_USE_EXISTING_DOCUMENT,
  PROPERTY_NAME_VARIABLES,
  PROPERTY_NAME_WAIT_FOR_RESULTS,
  WEBHOOK_NAME,
} from './constants';


const versionDescription: Omit<INodeTypeDescription, 'displayName' | 'name' | 'description' | 'group'> = {
  version: 1,
  defaults: { name: 'Cradl AI' },
  inputs: [NodeConnectionTypes.Main],
  outputs: [NodeConnectionTypes.Main],
  credentials: [
    {
      name: CREDENTIALS_NAME,
      required: true,
    }
  ],
  waitingNodeTooltip: `=Execution will continue when webhook is received on {{ $execution.resumeUrl }}`,
  webhooks: [
    {
      name: WEBHOOK_NAME,
      httpMethod: 'POST',
      responseMode: 'onReceived',
      path: '',
      restartWebhook: true,
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
          name: 'Parse Document with HITL',
          value: 'parseDocumentWithHITL',
          description: 'Import a binary file into Cradl AI and extract structured data, with human review if confidence is low',
          action: 'Import a binary file and extract structured data with human review if confidence is low',
        },
      ],
      default: 'parseDocumentWithHITL',
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
      displayName: 'Use Existing Document',
      name: PROPERTY_NAME_USE_EXISTING_DOCUMENT,
      type: 'boolean',
      // eslint-disable-next-line n8n-nodes-base/node-param-default-wrong-for-boolean
      default: DEFAULT_VALUE_USE_EXISTING_DOCUMENT,
      description: 'Whether to use an existing document or create a new one',
    },
    {
      displayName: 'Document Name or ID',
      name: PROPERTY_NAME_DOCUMENT_ID,
      type: 'options',
      typeOptions: {
        loadOptionsMethod: 'getDocumentIdOptions',
      },
      displayOptions: {
        show: {
          useExistingDocument: [true],
        }
      },
      default: '',
      description: 'Select a value from the API. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
      required: true,
    },
    {
      displayName: 'Document Binary Data',
      name: PROPERTY_NAME_DOCUMENT_BINARY_DATA,
      type: 'string',
      displayOptions: {
        show: {
          useExistingDocument: [false],
        }
      },
      default: '',
      description: 'The binary property name of the document to process',
      required: true,
    },
    {
      displayName: 'Wait for Results',
      name: PROPERTY_NAME_WAIT_FOR_RESULTS,
      type: 'boolean',
      // eslint-disable-next-line n8n-nodes-base/node-param-default-wrong-for-boolean
      default: DEFAULT_VALUE_WAIT_FOR_RESULTS,
      description: 'Whether to wait for the agent run to complete and return the results',
    },
    {
      displayName: 'Show Advanced Options',
      name: 'showAdvancedOptions',
      type: 'boolean',
      default: false,
    },
    {
      displayName: 'Resume URL Variable Name',
      name: PROPERTY_NAME_RESUME_URL_VARIABLE_NAME,
      type: 'string',
      default: DEFAULT_VALUE_RESUME_URL_VARIABLE_NAME,
      description: 'The name of the variable to pass the resume URL in. Only used if "Wait for Results" is enabled.',
      displayOptions: {
        show: {
          waitForResults: [true],
          showAdvancedOptions: [true],
        }
      },
    },
    {
      displayName: 'Variables',
      name: PROPERTY_NAME_VARIABLES,
      type: 'json',
      default: DEFAULT_VALUE_VARIABLES,
      description: 'JSON object containing variables to pass to the agent run',
      displayOptions: {
        show: {
          showAdvancedOptions: [true],
        }
      },
    },
    {
      displayName: 'Calculate Signature',
      name: PROPERTY_NAME_CALCULATE_SIGNATURE,
      type: 'boolean',
      // eslint-disable-next-line n8n-nodes-base/node-param-default-wrong-for-boolean
      default: DEFAULT_VALUE_CALCULATE_SIGNATURE,
      description: 'Whether to calculate HMAC signature for incoming webhooks for additional security',
      displayOptions: {
        show: {
          showAdvancedOptions: [true],
        }
      },
    },
    {
      displayName: 'HMAC Secret',
      name: PROPERTY_NAME_HMAC_SECRET,
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: undefined,
      description: 'The secret used to calculate the HMAC signature',
      displayOptions: {
        show: {
          calculateSignature: [true],
          showAdvancedOptions: [true],
        },
      },
    },
  ],
};

/* eslint-disable @n8n/community-nodes/icon-validation */
export class CradlAiV1 implements INodeType {
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
      getDocumentIdOptions,
    },
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    return handleWebhookResponse(this);
  }

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const waitForResults = this.getNodeParameter(PROPERTY_NAME_WAIT_FOR_RESULTS, 0, DEFAULT_VALUE_WAIT_FOR_RESULTS) as unknown as boolean;
    const items = this.getInputData();

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      const getParam = <T>(name: string, defaultValue?: T) => {
        const param = this.getNodeParameter(name, itemIndex, defaultValue);

        if (param == null || param === '') {
          throw new NodeOperationError(this.getNode(), `Parameter "${name}" is required`, { itemIndex });
        }

        return param as T;
      };

      const item = items[itemIndex];

      try {
        const agentId = getParam<string>(PROPERTY_NAME_AGENT_ID);
        const variables = JSON.parse(getParam<string>(PROPERTY_NAME_VARIABLES, DEFAULT_VALUE_VARIABLES));

        if (waitForResults) {
          const calculateSignature = getParam(PROPERTY_NAME_CALCULATE_SIGNATURE, DEFAULT_VALUE_CALCULATE_SIGNATURE);
          let hmacSecret;
          if (calculateSignature) {
            hmacSecret = getParam<string>(PROPERTY_NAME_HMAC_SECRET);
          } else {
            hmacSecret = undefined;
          }

          const resumeUrlVariableName = getParam(PROPERTY_NAME_RESUME_URL_VARIABLE_NAME, DEFAULT_VALUE_RESUME_URL_VARIABLE_NAME);
          const webhookUrl = `$\{${resumeUrlVariableName}}`;

          await ensureWebhookExists(this, agentId, webhookUrl, hmacSecret);

          const resumeUrl = this.evaluateExpression('{{ $execution.resumeUrl }}', itemIndex) as string;
          if (!resumeUrl) {
            throw new NodeOperationError(this.getNode(), 'Failed to get resume URL for execution', { itemIndex });
          }
          variables[resumeUrlVariableName] = { 'value': resumeUrl };
        } else if (this.getWorkflowStaticData('node').actionId) {
          await deleteAction(this, agentId);
        }

        const useExistingDocument = getParam(PROPERTY_NAME_USE_EXISTING_DOCUMENT, DEFAULT_VALUE_USE_EXISTING_DOCUMENT);
        let documentContent;
        let documentFileName;

        if (useExistingDocument) {
          const documentId = getParam<string>(PROPERTY_NAME_DOCUMENT_ID);

          const document = await cradlApiRequest(this, {
            method: 'GET',
            path: `/documents/${documentId}`
          });

          documentContent = await cradlApiRequest(this, {
            method: 'GET',
            url: document.fileUrl,
            encoding: 'arraybuffer'
          });
          documentFileName = document.name;
        } else {
          const binaryPropertyName = getParam<string>(PROPERTY_NAME_DOCUMENT_BINARY_DATA);
          documentContent = await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);
          const binary = this.evaluateExpression('{{ $binary }}', itemIndex) as { [key: string]: IBinaryData };
          documentFileName = binary[binaryPropertyName].fileName;
        }

        const run = await cradlApiRequest(this, {
          method: 'POST',
          path: `/agents/${agentId}/runs`,
          body: { variables }
        });

        const newDocument = await cradlApiRequest(this, {
          method: 'POST',
          path: `/documents`,
          body: { name: documentFileName, agentRunId: run.id }
        });

        await cradlApiRequest(this, {
          method: 'PUT',
          url: newDocument.fileUrl,
          body: documentContent,
          encoding: 'arraybuffer'
        });

        item.json.run = run;
      } catch (error) {
        if (this.continueOnFail()) {
          items.push({ json: this.getInputData(itemIndex)[0].json, error, pairedItem: itemIndex });
        } else {
          if (error.context) {
            error.context.itemIndex = itemIndex;
            throw error;
          }
          throw new NodeOperationError(this.getNode(), error, {
            itemIndex,
          });
        }
      }
    }

    if (waitForResults) {
      await this.putExecutionToWait(WAIT_INDEFINITELY);
      return [this.getInputData()];
    } else {
      return [items];
    }
  }
}
