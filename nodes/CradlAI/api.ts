import {
    IDataObject,
    IExecuteFunctions,
    IHookFunctions,
    IHttpRequestMethods,
    IHttpRequestOptions,
    ILoadOptionsFunctions,
    IWebhookFunctions
} from "n8n-workflow";
import { CREDENTIALS_NAME, API_BASE_URL } from "./constants";

export type CradlApiRequest = {
    method: IHttpRequestMethods;
    path?: string;
    url?: string;
    body?: object;
    qs?: IDataObject;
    encoding?: 'arraybuffer' | 'blob' | 'document' | 'json' | 'text' | 'stream';
};

export async function cradlApiRequest(this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions | IWebhookFunctions, {
    method,
    path,
    url,
    body,
    qs,
    encoding
}: CradlApiRequest) {
    const credentials = await this.getCredentials(CREDENTIALS_NAME);
    const options: IHttpRequestOptions = {
        method,
        url: url ?? `${credentials.apiBaseUrl ?? API_BASE_URL}${path}`,
        headers: encoding ? undefined : { 'Content-Type': 'application/json' },
        body,
        qs,
        encoding,
    };

    return this.helpers.httpRequestWithAuthentication.call(this, CREDENTIALS_NAME, options);
};