import {
    IDataObject,
    IExecuteFunctions,
    IHookFunctions,
    IHttpRequestMethods,
    IHttpRequestOptions,
    ILoadOptionsFunctions,
    IWebhookFunctions
} from "n8n-workflow";

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
    const options: IHttpRequestOptions = {
        method,
        url: url ?? `https://api.cradl.ai/v1${path}`,
        headers: encoding ? undefined : { 'Content-Type': 'application/json' },
        body,
        qs,
        encoding,
    };

    return this.helpers.httpRequestWithAuthentication.call(this, 'cradlAiApi', options);
};