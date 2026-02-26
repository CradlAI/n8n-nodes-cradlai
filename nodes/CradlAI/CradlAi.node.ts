import {
  VersionedNodeType,
  type INodeTypeBaseDescription,
  type IVersionedNodeType,
} from 'n8n-workflow';

import { CradlAiV1 } from './v1/CradlAiV1.node';

export class CradlAi extends VersionedNodeType {
  constructor() {
    const baseDescription: INodeTypeBaseDescription = {
      defaultVersion: 1,
      description: 'Extract data from documents with AI + human-in-the-loop exception handling.',
      displayName: 'Cradl AI',
      group: ['transform'],
      icon: { light: 'file:cradl.svg', dark: 'file:cradl.dark.svg' },
      name: 'cradlAi',
      subtitle: '={{ $parameter["operation"] }}',
      usableAsTool: true,
    };

    const nodeVersions: IVersionedNodeType['nodeVersions'] = {
      1: new CradlAiV1(baseDescription),
    };

    super(nodeVersions, baseDescription);
  }
}
