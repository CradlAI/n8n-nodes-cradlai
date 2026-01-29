import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { cradlApiRequest } from './api';

export class CradlAi implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Cradl AI',
		name: 'cradlAi',
		icon: { light: 'file:cradl.svg', dark: 'file:cradl.dark.svg' },
		group: ['transform'],
		version: 1,
 		credentials: [
			{
				name: 'cradlAiApi',
				required: true,
				displayOptions: {
					show: {
						authentication: ['oAuth2'],
					},
				},
			}
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
				displayName: 'Document Name or ID',
				name: 'documentId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getDocumentIdOptions',
				},
				default: '',
				description: 'Select a value from the API. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				required: true,
			},
			{
				displayName: 'Variables',
				name: 'variables',
				type: 'json',
				default: '{}',
				description: 'JSON object containing variables to pass to the agent run',
			}
		],
	};

	methods = {
		loadOptions: {
			async getAgentIdOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
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
			},

			async getDocumentIdOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
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
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const item = items[itemIndex];

				const agentId = this.getNodeParameter('agentId', itemIndex, '') as string;
				const documentId = this.getNodeParameter('documentId', itemIndex, '') as string;
				const variables = JSON.parse(this.getNodeParameter('variables', itemIndex, '{}') as string);

				const document = await cradlApiRequest.call(this, {
					method: 'GET',
					path: `/documents/${documentId}`
				});

				const documentContent = await cradlApiRequest.call(this, {
					method: 'GET',
					url: document.fileUrl,
					encoding: 'arraybuffer'
				});

				const run = await cradlApiRequest.call(this, {
					method: 'POST',
					path: `/agents/${agentId}/runs`,
					body: { variables }
				});

				const newDocument = await cradlApiRequest.call(this, {
					method: 'POST',
					path: `/documents`,
					body: { name: document.name, agentRunId: run.id }
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

		return [items];
	}
}
