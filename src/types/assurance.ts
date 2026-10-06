/* 
  file summary: assurance set data models and pipeline stage definitions for the marine assurance platform (map).
  responsibilities: defines types for assurance projects, charter window timelines, stage progression, requirement toggles, and compliance scoring.
  role in system: consumed by assurance set command center, tables, state management, and approver readiness dial.
*/

export type AssuranceStage =
  | 'Initiated'
  | 'Validation'
  | 'Verification'
  | 'Inspection'
  | 'Approval'
  | 'Certified'
  | 'Approved';

export type InitiatingRoleType =
  | 'Vessel Provider'
  | 'Client Admin'
  | 'C Admin · Client Created'
  | 'Vessel Provider Admin';

export type AssuranceScopeType = 'Project' | 'Vessel' | 'Crew' | 'Activity' | 'Equipment';
export type AssuranceSubtype = 'Vessel' | 'Crew' | 'Activity' | 'Equipment';
export type ThreePillarsCategory = 'People' | 'Plant' | 'Process';

export type ReviewMode = 'internal' | 'third_party' | 'issuing_authority' | 'mixed';
export type ReviewChannel = 'internal' | 'third_party' | 'issuing_authority';
export type AuthorityValidationMethod = 'api' | 'direct_link' | 'manual';

export type AssuranceRequirementCategory =
  | 'Statutory Certificate'
  | 'Class Notation Certificate'
  | 'Flag Administration Registry'
  | 'Environmental'
  | 'Environmental Certificate'
  | 'Safety & Lifesaving Equipment'
  | 'Vessel Custom Requirement'
  | 'Crew Credential'
  | 'Certificate of Competency (CoC)'
  | 'Medical Fitness Certificate'
  | 'Offshore Safety Induction (BOSIET)'
  | 'Specialized Training Endorsement'
  | 'Crew Custom Requirement'
  | 'Inspection Report'
  | 'Operational Plan'
  | 'Method Statement (MOP)'
  | 'Risk Assessment (HAZID/HAZOP)'
  | 'Mooring & Towage Analysis'
  | 'Emergency Contingency Protocol'
  | 'SIMOPS Agreement'
  | 'Activity Custom Requirement'
  | 'Equipment Register'
  | 'Lifting Appliance Register (ILO 152)'
  | 'DP FMEA Proving Trial'
  | 'Pull & Load Test Certificate'
  | 'Helideck Safety Certificate'
  | 'Equipment Custom Requirement'
  | 'Custom Requirement'
  | (string & {});

export interface AssuranceRequirement {
  id: string;
  category: AssuranceRequirementCategory;
  title: string; // e.g. Cargo Ship Safety Equipment
  description?: string; // rich descriptive explanation of why the document is required
  subtype?: AssuranceSubtype;
  isMandatory: boolean;
  isFulfilled: boolean;
  ocrConfidence: number; // 0 - 100%
  documentId?: string;
  linkedDocumentId?: string;
  documentVersion?: string;
  verifierStatus: 'Pending' | 'Verified' | 'Correction Requested' | 'Rejected';
  verificationRoute?: 'Inspector' | 'Approver';
  notes?: string;
  isOtherDocument?: boolean;
  isSpecialized?: boolean;
  assignedSubmitter?: string;
  assignedVerifier?: string;
  submitterId?: string;
  verifierId?: string;
}

export interface AssuranceProject {
  id: string; // e.g. MAP-PROJ-2026-OFFSHORE-001
  name: string; // e.g. Gorgon Stage 2 & Jansz-Io Compression
  clientOperator: string; // e.g. Chevron Australia Pty Ltd
  location: string; // e.g. Barrow Island / Greater Gorgon Area, WA
  description: string;
  primaryVesselId?: string;
  primaryCrewId?: string;
  primaryEquipmentId?: string;
  primaryActivityId?: string;
  defaultTemplateId?: string;
}

export interface AssuranceActivity {
  id: string; // e.g. MAP-ACT-2026-SURF-001
  name: string; // e.g. Deepwater SURF & Subsea Tie-In Installation
  category: string; // e.g. Subsea Installation
  location: string; // e.g. Greater Gorgon Field, WA
  description: string;
}

export interface AssuranceStakeholderMapping {
  submitterId?: string;
  submitterName?: string;
  submitterOrg?: string;
  verifierId?: string;
  verifierName?: string;
  verifierOrg?: string;
  inspectorId?: string;
  inspectorName?: string;
  inspectorOrg?: string;
  approverId?: string;
  approverName?: string;
  approverOrg?: string;
}

export interface SubtypeStakeholderMapping {
  submitterId?: string;
  submitterName?: string;
  submitterOrg?: string;
  assignedSubmitter?: string;
  verifierId?: string;
  verifierName?: string;
  verifierOrg?: string;
  assignedVerifier?: string;
}

export interface AssuranceSet {
  stakeholders?: AssuranceStakeholderMapping | null;
  assignedStakeholders?: AssuranceStakeholderMapping | null;
  subtypeStakeholders?: Partial<Record<AssuranceSubtype, SubtypeStakeholderMapping>>;
  categoryStakeholders?: Record<string, SubtypeStakeholderMapping>;
  createdByPersona?: string;
  id: string; // e.g. AS-2026-001
  title: string; // e.g. Chevron Gorgon Charter Vetting
  assuranceType?: AssuranceScopeType;
  projectId?: string;
  projectName?: string;
  crewId?: string;
  crewName?: string;
  equipmentId?: string;
  equipmentName?: string;
  activityId?: string;
  activityName?: string;
  subtypes?: AssuranceSubtype[];
  visibility?: 'public' | 'organization' | 'draft';
  templateSource?: 'public' | 'organization' | 'custom' | 'none';
  appliedTemplates?: Record<string, string>;
  vesselId: string;
  vesselName: string;
  imoNumber: string;
  initiatorOrg: string;
  initiatorRole: InitiatingRoleType;
  charterer?: string; /* charterer organization or entity assigned to the campaign set */
  charterWindowStart: string; /* iso date */
  charterWindowEnd: string; /* iso date */
  stage: AssuranceStage;
  readinessScore: number; // 0 - 100%
  requirements: AssuranceRequirement[];
  verificationRequired?: boolean;
  mandatoryInspectionRequired: boolean;
  formalApprovalRequired?: boolean;
  inspectionCompleted: boolean;
  assignedSubmitter?: string;
  assignedVerifier?: string;
  assignedInspector?: string;
  assignedApprover?: string;
  approverDecision?: 'Approved' | 'Returned for Correction' | 'Rejected' | 'Pending';
  approverNotes?: string;
  /** review channel governance (MVP 1.5): internal, third party, issuing authority, or mixed */
  reviewMode?: ReviewMode;
  reviewChannels?: ReviewChannel[];
  validityCheckRequired?: boolean;
  suitabilityCheckRequired?: boolean;
  authorityValidationMethod?: AuthorityValidationMethod;
  /** service provider organization delivering the asset or services (cannot verify/approve own documents) */
  serviceProviderOrg?: string;
  /** initiating client organization that owns the assurance set */
  clientOrg?: string;
  /** true when C Admin runs assurance on their own fleet (internal deployment, not third-party charter) */
  internalDeployment?: boolean;
  /** true for project-level master rollup sets (e.g. AS-02-P001) */
  isProjectMaster?: boolean;
  parentProjectId?: string;
  aggregatedFromSetIds?: string[];
}
