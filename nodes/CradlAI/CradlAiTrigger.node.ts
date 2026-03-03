import {
  VersionedNodeType,
  type INodeTypeBaseDescription,
  type IVersionedNodeType,
} from 'n8n-workflow';

import { CradlAiTriggerV1 } from './v1/CradlAiTriggerV1.node';

export class CradlAiTrigger extends VersionedNodeType {
  constructor() {
    const baseDescription: INodeTypeBaseDescription = {
      defaultVersion: 1,
      description: 'Extract data from any document with built-in validation, guardrails, and human-in-the-loop exception handling.',
      displayName: 'Cradl AI Trigger',
      group: ['trigger'],
      icon: { light: 'file:cradl.svg', dark: 'file:cradl.dark.svg' },
      name: 'cradlAiTrigger',
      subtitle: '={{ $parameter["operation"] }}',
      usableAsTool: true,
    };

    const nodeVersions: IVersionedNodeType['nodeVersions'] = {
      1: new CradlAiTriggerV1(baseDescription),
    };

    super(nodeVersions, baseDescription);
  }
}
