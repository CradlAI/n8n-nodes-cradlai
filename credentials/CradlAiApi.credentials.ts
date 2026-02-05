import type {
  IAuthenticateGeneric,
  ICredentialDataDecryptedObject,
  ICredentialTestRequest,
  ICredentialType,
  IHttpRequestHelper,
  INodeProperties,
} from 'n8n-workflow';

const DEFAULT_API_BASE_URL = 'https://api.cradl.ai/v1';
const DEFAULT_ACCESS_TOKEN_URL = 'https://auth.cradl.ai/oauth2/token';

export class CradlAiApi implements ICredentialType {
  name = 'cradlAiApi';

  icon = undefined;

  displayName = 'Cradl AI API';

  documentationUrl = 'https://docs.cradl.ai/api-reference/introduction';

  properties: INodeProperties[] = [
    {
      displayName: 'Session Token',
      name: 'sessionToken',
      type: 'hidden',
      typeOptions: {
        expirable: true,
        password: true,
      },
      default: '',
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
    {
      displayName: 'Show Advanced Options',
      name: 'showAdvancedOptions',
      type: 'boolean',
      default: false,
    },
    {
      displayName: 'API Base URL',
      name: 'apiBaseUrl',
      type: 'string',
      default: DEFAULT_API_BASE_URL,
      displayOptions: {
        show: {
          showAdvancedOptions: [true],
        },
      },
    },
    {
      displayName: 'Access Token URL',
      name: 'accessTokenUrl',
      type: 'string',
      default: DEFAULT_ACCESS_TOKEN_URL,
      displayOptions: {
        show: {
          showAdvancedOptions: [true],
        },
      },
    },
  ];

  async preAuthentication(this: IHttpRequestHelper, credentials: ICredentialDataDecryptedObject) {
    const { access_token } = (await this.helpers.httpRequest({
      method: 'POST',
      url: (credentials.accessTokenUrl as string | undefined) ?? DEFAULT_ACCESS_TOKEN_URL,
      body: {
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        audience: DEFAULT_API_BASE_URL,
        grant_type: 'client_credentials',
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })) as { access_token: string };
    return { sessionToken: access_token };
  }

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        Authorization: '=Bearer {{ $credentials.sessionToken }}',
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      method: 'GET',
      baseURL: '={{ $credentials.apiBaseUrl ?? "https://api.cradl.ai/v1" }}',
      url: '/organizations/me',
    },
  };
}
