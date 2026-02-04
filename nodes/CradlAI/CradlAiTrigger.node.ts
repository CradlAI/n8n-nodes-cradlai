import {
	type IHookFunctions,
	type IWebhookFunctions,
	type INodeType,
	type INodeTypeDescription,
	type IWebhookResponseData,
	NodeConnectionTypes,
} from 'n8n-workflow';
import { createAction, deleteAction, getAction, getAgentIdOptions, handleWebhookResponse, updateAction } from './common';
import { CREDENTIALS_NAME } from './constants';

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
				displayOptions: {
					show: {
						authentication: ['oAuth2'],
					},
				},
			}
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
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
		],
		usableAsTool: true,
	};

	methods = {
		loadOptions: {
			getAgentIdOptions,
		},
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const agentId = this.getNodeParameter('agentId') as string | undefined;
				if (!agentId) return false;

				const action = await getAction.call(this, agentId);
				if (!action) return false;

				const webhookUrl = this.getNodeWebhookUrl('default');
				if (!webhookUrl) return false;

				return await updateAction.call(this, action, webhookUrl)
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const agentId = this.getNodeParameter('agentId') as string | undefined;
				if (!agentId) return false;

				const webhookUrl = this.getNodeWebhookUrl('default');
				if (!webhookUrl) return false;

				return await createAction.call(this, agentId, webhookUrl);
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const agentId = this.getNodeParameter('agentId') as string | undefined;
				if (!agentId) return false;

				return await deleteAction.call(this, agentId);
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		return handleWebhookResponse.call(this);
	}
}
