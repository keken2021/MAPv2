/*
  file summary: project composition types for multi-org asset and service linking.
  responsibilities: defines project header fields, asset roster links, type enums, and status.
  role in system: consumed by project views, store, and assurance rollup sync.
*/

import { AssuranceProject } from './assurance';

export type ProjectStatus =
  | 'Draft'
  | 'Composing'
  | 'Assurance In Progress'
  | 'Ready for Charter'
  | 'Closed';

export type ProjectType =
  | 'Charter / Voyage'
  | 'Service Engagement'
  | 'Crew Provision'
  | 'Equipment Rental'
  | 'Assurance Campaign'
  | 'Mixed / Composite';

export type ProjectRiskProfile =
  | 'Standard'
  | 'Elevated'
  | 'High-Risk'
  | 'Armed Escort Required';

export type WorkLocationType = 'Onboard' | 'Shoreside' | 'Offshore' | 'Mixed';

export type ProjectAssetType = 'Vessel' | 'Crew' | 'Equipment' | 'Activity';

export const PROJECT_TYPE_OPTIONS: ProjectType[] = [
  'Charter / Voyage',
  'Service Engagement',
  'Crew Provision',
  'Equipment Rental',
  'Assurance Campaign',
  'Mixed / Composite',
];

export const WORK_LOCATION_OPTIONS: WorkLocationType[] = [
  'Onboard',
  'Shoreside',
  'Offshore',
  'Mixed',
];

export interface ProjectAssetLink {
  id: string;
  projectId: string;
  assetType: ProjectAssetType;
  assetId: string;
  assetName: string;
  providerOrganization: string;
  assuranceSetId: string;
  roleInProject?: string;
  addedAt: string;
  addedByPersona: string;
  notes?: string;
}

export interface Project extends AssuranceProject {
  projectType: ProjectType;
  requestingOrganization: string;
  /** Charter / voyage and mixed projects */
  charterer?: string;
  routeDescription?: string;
  riskProfile?: ProjectRiskProfile | null;
  /** Project window (stored as charter window for assurance set sync) */
  charterWindowStart: string;
  charterWindowEnd: string;
  status: ProjectStatus;
  operatorOrganization: string;
  /** Client organization that owns this project / master assurance (charterer) */
  ownerOrganization?: string;
  masterAssuranceSetId: string;
  assetLinks: ProjectAssetLink[];
  readinessScore?: number;
  /** Service / rental projects */
  serviceProvider?: string;
  workOrderRef?: string;
  workLocationType?: WorkLocationType;
  primaryVesselId?: string;
}
