# @cradl/n8n-nodes-cradlai

This is an n8n community node. It lets you use Cradl AI in your n8n workflows.

Cradl AI is an intelligent document processing platform that uses AI to extract, validate, and process data from documents with human-in-the-loop capabilities.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Compatibility](#compatibility)
[Usage](#usage)
[Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

Alternatively, for local development:

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run build` to compile the TypeScript code
4. Link the node to your n8n instance or copy the built files to your custom nodes directory

## Operations

### Cradl AI Node

The main Cradl AI node supports the following operations:

- **Run Agent**: Execute a Cradl AI agent on a document
  - Create agent runs with custom variables
  - Automatically copy and attach documents to agent runs
  - Support for binary document data transfer
  - Configurable resume URLs for webhook callbacks

### Cradl AI Trigger Node

The trigger node enables webhook-based workflows:

- **Webhook Trigger**: Receive notifications when agent runs complete or require human intervention
  - Wait for agent run completion
  - Handle human-in-the-loop callbacks
  - Process document processing results

## Credentials

To use this node, you need to authenticate with Cradl AI using OAuth2:

### Prerequisites

1. Sign up for a Cradl AI account at [https://app.cradl.ai](https://app.cradl.ai)
2. Create an OAuth2 application in your Cradl AI organization settings
3. Note your Client ID and Client Secret

### Setting up OAuth2 Credentials

1. In n8n, create new credentials of type "Cradl AI OAuth2 API"
2. Fill in the following:
   - **Authorization URL**: Pre-configured
   - **Access Token URL**: Pre-configured
   - **Client ID**: From your Cradl AI OAuth2 application
   - **Client Secret**: From your Cradl AI OAuth2 application
   - **Scope**: Pre-configured for API access
   - **Audience**: Automatically set to `https://api.cradl.ai/v1`
3. Click "Connect my account" and authorize the application

## Compatibility

- Minimum n8n version: 1.0.0
- Tested against n8n versions: 1.x
- Node version: Requires Node.js 18 or higher

## Usage

### Running an Agent

1. Add the "Cradl AI" node to your workflow
2. Select "Run Agent" operation
3. Choose your agent from the dropdown (dynamically loaded from your Cradl AI account)
4. Provide a document ID
5. Optionally add custom variables (JSON format)
6. The node will:
   - Create a new agent run
   - Copy the document and attach it to the run
   - Return the agent run details

### Using the Trigger Node

1. Add the "Cradl AI Trigger" node to start a workflow
2. The node automatically generates a webhook URL
3. Pass this URL as `resumeUrl` in your agent variables
4. The workflow will pause and wait for the webhook callback
5. When the agent completes or requires human input, it will trigger the workflow to continue

### Example Workflow

Create a workflow that:
1. Triggers on document upload (via webhook or schedule)
2. Runs a Cradl AI agent on the document
3. Waits for processing to complete
4. Sends results to your system

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
* [Cradl AI Documentation](https://docs.cradl.ai)
* [Cradl AI API Reference](https://docs.cradl.ai/api-reference)
* [Cradl AI Platform](https://app.cradl.ai)
