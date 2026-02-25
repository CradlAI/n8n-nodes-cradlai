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
      description: 'Handle processed document events via webhooks',
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
