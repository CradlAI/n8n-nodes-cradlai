import axios from 'axios';

import type { ICredentialDataDecryptedObject, ICredentialTestRequest, ICredentialType, IHttpRequestOptions, INodeProperties } from 'n8n-workflow';

export class CradlAiApi implements ICredentialType {
	name = 'cradlAiApi';

    icon = undefined;

	displayName = 'Cradl AI API';

	documentationUrl = 'https://docs.cradl.ai/api-reference/introduction';

	properties: INodeProperties[] = [
		{
			displayName: 'Grant Type',
			name: 'grantType',
			type: 'hidden',
			default: 'client_credentials',
            options: [
                {
                    name: 'Client Credentials',
                    value: 'client_credentials',
                },
            ],
		},
		{
			displayName: 'Access Token URL',
			name: 'accessTokenUrl',
			type: 'hidden',
			default: 'https://auth.cradl.ai/oauth2/token',
		},
		{
			displayName: 'Audience',
			name: 'audience',
			type: 'hidden',
			default: 'https%3A%2F%2Fapi.cradl.ai%2Fv1',
		},
		{
			displayName: 'Authentication',
			name: 'authentication',
			type: 'hidden',
			default: 'header',
		},
		{
			displayName: 'Client ID',
			name: 'clientId',
			type: 'string',
			default: '',
			required: true,
		},
		{
			displayName: 'Client Secret',
			name: 'clientSecret',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
		},
	];

	async authenticate(credentials: ICredentialDataDecryptedObject, requestOptions: IHttpRequestOptions): Promise<IHttpRequestOptions> {
		const auth = await axios.post(credentials.accessTokenUrl as string, 
			`client_id=${credentials.clientId}&client_secret=${credentials.clientSecret}&audience=${credentials.audience}&grant_type=${credentials.grantType}`,
			{ headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
		);

		requestOptions.headers ??= {};
		requestOptions.headers['Authorization'] = `Bearer ${auth.data.access_token}`;
		return requestOptions;
	}

	test: ICredentialTestRequest = {
		request: {
			method: 'GET',
			baseURL: 'https://api.cradl.ai/v1',
			url: '/organizations/me',
		},
	};
}