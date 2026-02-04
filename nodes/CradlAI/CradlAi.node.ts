import type {
	IBinaryData,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError, WAIT_INDEFINITELY } from 'n8n-workflow';
import { cradlApiRequest } from './api';
import { ensureWebhookExists, getAgentIdOptions, getDocumentIdOptions, handleWebhookResponse } from './common';
import { CREDENTIALS_NAME, RESUME_URL_VARIABLE_NAME } from './constants';

export class CradlAi implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Cradl AI',
		name: 'cradlAi',
		icon: { light: 'file:cradl.svg', dark: 'file:cradl.dark.svg' },
		group: ['transform'],
		version: 1,
 		credentials: [
			{
				name: CREDENTIALS_NAME,
				required: true,
				displayOptions: {
					show: {
						authentication: ['oAuth2'],
					},
				},
			}
		],
		waitingNodeTooltip: `=Execution will continue when webhook is received on {{ $execution.resumeUrl }}`,
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
				restartWebhook: true,
				isFullPath: true,
			},
		],
		description: 'Extract data reliably from any document',
		defaults: {
			name: 'Cradl AI',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		properties: [
			{
				displayName: 'Authentication',
				name: 'authentication',
				type: 'options',
				options: [
					{
						name: 'OAuth2',
						value: 'oAuth2',
					},
				],
				default: 'oAuth2',
			},
			{
				displayName: 'Agent Name or ID',
				name: 'agentId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getAgentIdOptions',
				},
				default: '',
				description: 'Select a value from the API. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				required: true,
			},
			{
				displayName: 'Wait for Results',
				name: 'waitForResults',
				type: 'boolean',
				default: true,
				description: 'Whether to wait for the agent run to complete and return the results',
			},
			{
				displayName: 'Resume URL Variable Name',
				name: 'resumeUrlVariableName',
				type: 'string',
				default: RESUME_URL_VARIABLE_NAME,
				description: 'The name of the variable to pass the resume URL in. Only used if "Wait for Results" is enabled.',
				displayOptions: {
					show: {
						waitForResults: [true],
					}
				},
			},
			{
				displayName: 'Use Existing Document',
				name: 'useExistingDocument',
				type: 'boolean',
				default: false,
				description: 'Whether to use an existing document or create a new one',
			},
			{
				displayName: 'Document Name or ID',
				name: 'documentId',
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
				displayName: 'Binary Property Name',
				name: 'binaryPropertyName',
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
				displayName: 'Variables',
				name: 'variables',
				type: 'json',
				default: '{}',
				description: 'JSON object containing variables to pass to the agent run',
			},
		],
	};

	methods = {
		loadOptions: {
			getAgentIdOptions,
			getDocumentIdOptions,
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		return handleWebhookResponse.call(this);
	}

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const resumeUrl = this.evaluateExpression('{{ $execution.resumeUrl }}', 0) as string;
		const waitForResults = this.getNodeParameter('waitForResults', 0, true) as boolean;

		const items = this.getInputData();

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const item = items[itemIndex];

				const agentId = this.getNodeParameter('agentId', itemIndex) as string | undefined;
				if (!agentId) throw new NodeOperationError(this.getNode(), 'Agent ID is required', { itemIndex });

				const variables = JSON.parse(this.getNodeParameter('variables', itemIndex, '{}') as string);

				if (waitForResults) {
					const resumeUrlVariableName = this.getNodeParameter('resumeUrlVariableName', itemIndex, RESUME_URL_VARIABLE_NAME) as string;
					const webhookUrl = `$\{${resumeUrlVariableName}}`;
					const webhookExists = await ensureWebhookExists.call(this, agentId, webhookUrl);
					if (!webhookExists) {
						throw new NodeOperationError(this.getNode(), `Failed to ensure webhook exists for agent ${agentId}`, { itemIndex });
					}

					variables[resumeUrlVariableName] = { 'value': resumeUrl };
				}

				const useExistingDocument = this.getNodeParameter('useExistingDocument', itemIndex) as boolean;
				let documentContent;
				let documentFileName;

				if (useExistingDocument) {
					const documentId = this.getNodeParameter('documentId', itemIndex, '') as string;

					const document = await cradlApiRequest.call(this, {
						method: 'GET',
						path: `/documents/${documentId}`
					});

					documentContent = await cradlApiRequest.call(this, {
						method: 'GET',
						url: document.fileUrl,
						encoding: 'arraybuffer'
					});
					documentFileName = document.name;
				} else {
					const binaryPropertyName = this.getNodeParameter('binaryPropertyName', itemIndex) as string;
					const binary = this.evaluateExpression('{{ $binary }}', itemIndex) as {[key: string]: IBinaryData};
					documentContent = await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);
					documentFileName = binary[binaryPropertyName].fileName;
				}

				const run = await cradlApiRequest.call(this, {
					method: 'POST',
					path: `/agents/${agentId}/runs`,
					body: { variables }
				});

				const newDocument = await cradlApiRequest.call(this, {
					method: 'POST',
					path: `/documents`,
					body: { name: documentFileName, agentRunId: run.id }
				});

				await cradlApiRequest.call(this, {
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
