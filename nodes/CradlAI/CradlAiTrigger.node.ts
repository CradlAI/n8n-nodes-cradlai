import {
	type IHookFunctions,
	type IWebhookFunctions,
	type IDataObject,
	type INodeType,
	type INodeTypeDescription,
	type IWebhookResponseData,
	NodeConnectionTypes,
	ILoadOptionsFunctions,
	INodePropertyOptions,
} from 'n8n-workflow';
import { cradlApiRequest } from './api';

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
				name: 'cradlAiApi',
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
		},
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const agentId = this.getNodeParameter('agentId') as string;
				const webhookData = this.getWorkflowStaticData('node');
				const webhookUrl = this.getNodeWebhookUrl('default');

				try {
					const agent = await cradlApiRequest.call(this, {
						method: 'GET',
						path: `/agents/${agentId}`,
					});

					for (const resourceId of agent.resourceIds ?? []) {
						if (!resourceId.startsWith('cradl:action:')) {
							continue;
						}

						const action = await cradlApiRequest.call(this, {
							method: 'GET',
							path: `/actions/${resourceId}`,
						});

						if (action.functionId !== 'cradl:organization:cradl/cradl:function:export-to-webhook') {
							continue;
						}

						if (action.config.url === webhookUrl) {
							webhookData.actionId = action.actionId;
							return true;
						}
					}
				} catch { /* empty */ }

				return false;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const agentId = this.getNodeParameter('agentId') as string;
				const webhookData = this.getWorkflowStaticData('node');
				const webhookUrl = this.getNodeWebhookUrl('default');

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
							functionId: 'cradl:organization:cradl/cradl:function:export-to-webhook',
							name: 'Export to n8n',
							config: {
								url: webhookUrl,
								httpMethod: 'POST',
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
							functionId: 'cradl:organization:cradl/cradl:function:hook-evaluate-prediction',
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

					webhookData.actionId = action.actionId as string;
					return true;
				} catch {
					await onCleanup();
				}

				return false;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');

				if (webhookData.actionId !== undefined) {
					try {
						/* TODO: delete associated hooks? */
						await cradlApiRequest.call(this, {
							method: 'DELETE',
							path: `/actions/${webhookData.actionId}`,
						});

						delete webhookData.actionId;
					} catch {
						return false;
					}
				}

				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();
		
		return {
			workflowData: [this.helpers.returnJsonArray(req.body as IDataObject)],
		};
	}
}
