/*
  file summary: project composition types for multi-org asset and service linking.
  responsibilities: defines project header fields, asset roster links, type enums, and status.
  role in system: consumed by project views, store, and assurance rollup sync.
*/

import { AssuranceProject, OrganizationGroup, OrganizationParty } from './assurance';

export type { OrganizationGroup, OrganizationParty };

/** place in the commercial chain. A head contractor's group is still Vendor. */
export type ContractChainRole = 'client' | 'head_contractor' | 'vendor';

export interface ContractParty extends OrganizationParty {
  chainRole?: ContractChainRole;
}

export const PROJECT_CURRENCIES = ['AUD', 'USD', 'EUR', 'GBP'] as const;

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

export type ProjectAssetType = 'Vessel' | 'Crew' | 'Equipment';

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
  /** Client organization that owns this project (charterer) */
  ownerOrganization?: string;
  /** Organizations that may open the project and create a set before they are the client on one */
  invitedOrganizations?: string[];
  assetLinks: ProjectAssetLink[];
  readinessScore?: number;
  /** client, head contractor, vendor, and any other party, each with a group */
  contractParties?: ContractParty[];
  /** commercial value of the project */
  projectValue?: number | null;
  currency?: string;
  /** multi-year commercial term, separate from the operational project window */
  multiYearStart?: string;
  multiYearEnd?: string;
  /**
   * Shared on-hire date. A-02 is not confirmed, so the screen always marks this pending
   * and does not copy it onto the project's sets.
   */
  onHireDate?: string;
  /** Service / rental projects */
  serviceProvider?: string;
  workOrderRef?: string;
  workLocationType?: WorkLocationType;
  primaryVesselId?: string;
}
