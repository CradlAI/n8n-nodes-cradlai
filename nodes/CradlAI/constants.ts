export const CRADL_ORGANIZATION_ID = 'cradl:organization:cradl';
export const CREDENTIALS_NAME = 'cradlAiApi';
export const EVALUATE_PREDICTION_FUNCTION_ID = `${CRADL_ORGANIZATION_ID}/cradl:function:hook-evaluate-prediction`;
export const EXPORT_TO_N8N_FUNCTION_ID = `${CRADL_ORGANIZATION_ID}/cradl:function:export-to-webhook`;
export const WEBHOOK_NAME = 'default';

/* Property names */
export const PROPERTY_NAME_AGENT_ID = 'agentId';
export const PROPERTY_NAME_CALCULATE_SIGNATURE = 'calculateSignature';
export const PROPERTY_NAME_DOCUMENT_ID = 'documentId';
export const PROPERTY_NAME_DOCUMENT_BINARY_DATA = 'documentBinaryData';
export const PROPERTY_NAME_HMAC_SECRET = 'hmacSecret';
export const PROPERTY_NAME_RESUME_URL_VARIABLE_NAME = 'resumeUrlVariableName';
export const PROPERTY_NAME_USE_EXISTING_DOCUMENT = 'useExistingDocument';
export const PROPERTY_NAME_VARIABLES = 'variables';
export const PROPERTY_NAME_WAIT_FOR_RESULTS = 'waitForResults';

/* Default values */
export const DEFAULT_VALUE_API_BASE_URL = 'https://api.cradl.ai/v1';
export const DEFAULT_VALUE_CALCULATE_SIGNATURE = false;
export const DEFAULT_VALUE_RESUME_URL_VARIABLE_NAME = 'n8nResumeUrl';
export const DEFAULT_VALUE_USE_EXISTING_DOCUMENT = false;
export const DEFAULT_VALUE_VARIABLES = '{}';
export const DEFAULT_VALUE_WAIT_FOR_RESULTS = true;
export const DEFAULT_VALUE_RESUME_URL_VARIABLE = 'resumeUrlVariableName';
