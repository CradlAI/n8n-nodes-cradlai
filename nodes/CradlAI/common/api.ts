import {
  IDataObject,
  IExecuteFunctions,
  IHookFunctions,
  IHttpRequestMethods,
  IHttpRequestOptions,
  ILoadOptionsFunctions,
  IWebhookFunctions
} from "n8n-workflow";
import { CREDENTIALS_NAME, DEFAULT_VALUE_API_BASE_URL } from "./constants";

export type CradlApiRequest = {
  method: IHttpRequestMethods;
  path?: string;
  url?: string;
  body?: object;
  qs?: IDataObject;
  encoding?: 'arraybuffer' | 'blob' | 'document' | 'json' | 'text' | 'stream';
};

export const cradlApiRequest = async (context: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions | IWebhookFunctions, {
  method,
  path,
  url,
  body,
  qs,
  encoding
}: CradlApiRequest) => {
  const credentials = await context.getCredentials(CREDENTIALS_NAME);
  const options: IHttpRequestOptions = {
    method,
    url: url ?? `${credentials.apiBaseUrl ?? DEFAULT_VALUE_API_BASE_URL}${path}`,
    headers: encoding ? undefined : { 'Content-Type': 'application/json' },
    body,
    qs,
    encoding,
  };

  return context.helpers.httpRequestWithAuthentication.call(context, CREDENTIALS_NAME, options);
};
