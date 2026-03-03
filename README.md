# @cradl/n8n-nodes-cradlai

This is an n8n community node. It lets you use Cradl AI in your n8n workflows.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

## Cradl AI

Document processing AI agents you can trust. Run production-grade agents that reliably extract and validate data, with built-in guardrails and human-in-the-loop exception handling.

## Overview

- [Installation](#installation)
- [Operations](#operations)
- [Credentials](#credentials)
- [Compatibility](#compatibility)
- [Usage](#usage)
- [Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

Alternatively, for local development:

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run build` to compile the TypeScript code
4. Link the node to your n8n instance or copy the built files to your custom nodes directory

## Operations

### Cradl AI Node

The Cradl AI node provides intelligent document processing capabilities:

- **Extract Data From Document**: Process documents using AI-powered agents
  - Upload documents directly from workflow binary data or reference existing documents
  - Configure custom variables to pass context and metadata
  - Optionally wait for processing completion with automatic webhook handling
  - Support for human-in-the-loop review workflows
  - Secure HMAC signature verification for webhook callbacks

### Cradl AI Trigger Node

The trigger node enables event-driven workflows based on Cradl AI processing:

- **Webhook Trigger**: Respond to document processing events
  - Automatic webhook registration and management
  - Receive notifications when processing completes or requires human intervention
  - Configurable HMAC verification for secure callbacks
  - Seamless integration with Cradl AI workflows

## Credentials

This node requires OAuth2 authentication with Cradl AI.

### Setup Instructions

1. **Locate OAuth2 credentials in Cradl AI:**
   - Navigate to [https://rc.app.cradl.ai](https://rc.app.cradl.ai)
   - Go to Account Settings ⮕ API
   - Locate the Client ID and Client Secret under API credentials

2. **Configure Credentials in n8n:**
   - Create new credentials of type **Cradl AI API**
   - Enter your Client ID and Client Secret
   - The Authorization URL, Token URL, Scope, and Audience are pre-configured
   - Click **Connect my account** and authorize the application

3. **Security:**
   - Client Secret is also used as the default HMAC secret for webhook verification
   - Store credentials securely and rotate them periodically
   - Use custom HMAC secrets in production for enhanced security

## Compatibility

- Minimum n8n version: 1.0.0
- Tested against n8n versions: 1.x
- Node version: Requires Node.js 18 or higher

## Usage

### Extract Data From Documents

1. Add the **Cradl AI** node to your workflow
2. Select **Extract Data From Document** operation
3. Configure the node:
   - **Agent**: Choose from your configured Cradl AI agents (dynamically loaded)
   - **Document Source**:
     - Upload new: Specify binary data property from previous node
     - Use existing: Select a previously uploaded document for testing
   - **Wait for Results**: Enable to pause workflow until processing completes
   - **Variables**: Pass custom JSON data to your agent workflow
4. Advanced options (when waiting for results):
   - **Resume URL Variable Name**: Customize the webhook variable name (default: `n8nResumeUrl`)
   - **HMAC Secret**: Override default secret for webhook signature verification if needed

The node will create an agent run, upload the document, and either return immediately or wait for processing completion based on your configuration.

### Working with Binary Data

The node accepts document data from any source that provides binary output:

```
HTTP Request → Cradl AI
Webhook → Cradl AI
Read Binary File → Cradl AI
```

Specify the binary property name (e.g., `data`) in the **Document Binary Data** field.

### Asynchronous Processing

When **Wait for Results** is disabled:
- The workflow continues immediately after submitting the document
- The node returns the agent run details
- Results must be retrieved separately or handled via the Cradl AI Trigger node

When **Wait for Results** is enabled:
- The workflow pauses at the node
- A webhook is automatically configured on your Cradl AI agent
- Execution resumes when processing completes or human review is finished
- The node outputs the final extracted data

### Example Workflows

**Synchronous Document Processing:**
```
Manual Trigger → Read Binary File → Cradl AI (wait enabled) → Send Email
```

**Asynchronous Processing with Trigger:**
```
Workflow 1: Webhook → Cradl AI (wait disabled) → Store Run ID

Workflow 2: Cradl AI Trigger → Process Results → Update Database
```

**Batch Processing:**
```
Schedule → List Files → Loop Over Items → Cradl AI → Aggregate Results
```

## Resources

* [n8n Community Nodes Documentation](https://docs.n8n.io/integrations/#community-nodes)
* [Cradl AI Documentation](https://docs.cradl.ai)
* [Cradl AI API Reference](https://docs.cradl.ai/api-reference)
* [Cradl AI Platform](https://rc.app.cradl.ai)

## Support

For issues related to this n8n node, please open an issue in this repository.

For Cradl AI platform support, contact [support@cradl.ai](mailto:support@cradl.ai).

## License

MIT
