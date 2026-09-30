/*
  file summary: project charter composition types for multi-org asset linking.
  responsibilities: defines project header fields, asset roster links, and status enums.
  role in system: consumed by project views, store, and assurance rollup sync.
*/

import { AssuranceProject } from './assurance';

export type ProjectStatus =
  | 'Draft'
  | 'Composing'
  | 'Assurance In Progress'
  | 'Ready for Charter'
  | 'Closed';

export type ProjectRiskProfile =
  | 'Standard'
  | 'Elevated'
  | 'High-Risk'
  | 'Armed Escort Required';

export type ProjectAssetType = 'Vessel' | 'Crew' | 'Equipment' | 'Activity';

export interface ProjectAssetLink {
  id: string;
  projectId: string;
  assetType: ProjectAssetType;
  assetId: string;
  assetName: string;
  providerOrganization: string;
  assuranceSetId: string;
  addedAt: string;
  addedByPersona: string;
  notes?: string;
}

export interface Project extends AssuranceProject {
  charterer: string;
  routeDescription: string;
  riskProfile: ProjectRiskProfile;
  charterWindowStart: string;
  charterWindowEnd: string;
  status: ProjectStatus;
  operatorOrganization: string;
  masterAssuranceSetId: string;
  assetLinks: ProjectAssetLink[];
  readinessScore?: number;
}
