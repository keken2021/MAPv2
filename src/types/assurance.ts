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
  | 'Approved'
  | 'Cancelled';

export type InitiatingRoleType =
  | 'Vessel Provider'
  | 'Client Admin'
  | 'C Admin · Client Created'
  | 'Vessel Provider Admin'
  | 'Service Provider Admin';

export type AssuranceScopeType = 'Vessel' | 'Crew' | 'Activity' | 'Equipment';
export type AssuranceSubtype = 'Vessel' | 'Crew' | 'Activity' | 'Equipment';
export type ThreePillarsCategory = 'People' | 'Plant' | 'Process';

/** canonical assurance object types under BRD V4.2 change 3 and ADR 0029 */
export type AssuranceObjectType =
  | 'vessel'
  | 'person'
  | 'equipment'
  | 'organization'
  | 'procedure'
  | 'document'
  | 'method';

/** how far an assurance object has been checked. A later status replaces the earlier one. */
export type ObjectVerificationStatus =
  | 'Uploaded, not externally verified'
  | 'Submitted and tested'
  | 'Tested externally'
  | 'Used and tested by several entities over time';

/** a client self-check reads as internal. A review by another organization reads as external. */
export type ObjectVerificationChannel = 'internal' | 'external';

/** the check one client can see on an object. It does not include another client's documents. */
export interface ObjectVerification {
  status: ObjectVerificationStatus;
  channel?: ObjectVerificationChannel;
  verifiedBy?: string;
  verifiedAt?: string;
  clientOrganization: string;
}

export interface AssuranceObject {
  id: string;
  type: AssuranceObjectType;
  name: string;
  ownerOrganization: string;
  identifier?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export type ReviewMode = 'internal' | 'third_party' | 'issuing_authority' | 'mixed';
export type ReviewChannel = 'internal' | 'third_party' | 'issuing_authority';

/** group of an organization on a project or a set. Labels are not confirmed as final names. */
export type OrganizationGroup = 'Client' | 'Vendor' | 'Third party';

export interface OrganizationParty {
  organization: string;
  group: OrganizationGroup;
}
export type AuthorityValidationMethod = 'api' | 'direct_link' | 'manual';

/** How a requirement is fulfilled: document upload or link to another assurance set */
export type RequirementFulfillmentType = 'document' | 'assurance_set';

/** Client-owned campaign workflow (C Admin controls review & approval) */
export type ClientWorkflowStage = 'draft' | 'in_review' | 'pending_approval' | 'approved';

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

/** how a person confirmed a document for one set; MAP records the method, it does not confirm with the issuer itself (paper P3) */
export type VerificationMethod = 'Issuer lookup' | 'Direct link' | 'Manual review' | 'Client-provided copy';

/** where an inspection report comes from (paper Table 2) */
export type InspectionReportSource = 'OVID' | 'eCMID' | 'SIRE 2.0' | 'Charterer' | 'Other';

/** the facts a charterer reads off an inspection report, not only that one exists (gap review G4) */
export interface InspectionReportEvidence {
  source: InspectionReportSource;
  reportDate: string;
  validityMonths: number;
  inspectorAccreditation?: string;
}

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
  /** document (default) or pointer to a linked assurance set */
  fulfillmentType?: RequirementFulfillmentType;
  linkedAssuranceSetId?: string;
  /** the exact document version this requirement was verified against; an approved set shows this, never the live version */
  verifiedVersion?: RequirementVersionSnapshot;
  /** how the verifier confirmed the document for this set (gap review G1) */
  verificationMethod?: VerificationMethod;
  /** identifier, URL, UTN, or lookup reference used to verify the certificate (gap review G1, R2-S5) */
  verificationReference?: string;
  /** summary or confirmation details returned by the issuer verification portal */
  verificationResultSummary?: string;
  /** why the verifier verified although a check failed or was not run (gap review E6) */
  overrideReason?: string;
  /** source, date, validity and inspector of the report, on an inspection report requirement */
  inspectionReport?: InspectionReportEvidence;
  /** ID of the assurance object this requirement/task is assigned to (ADR 0029) */
  targetObjectId?: string;
  /** target date for this requirement/task (must fall on or before the set target date; BRD V4.2 change 6) */
  targetDate?: string;
  /** section this task belongs to; matches TaskSection.id on the set */
  sectionId?: string;
  /** the one earlier task this task follows */
  predecessorId?: string;
  /** exemption details if this requirement/task was exempted (BRD V4.2 change 7) */
  exemption?: TaskExemption;
}

/** a named group of tasks on an assurance set; the critical-path chart is not part of this prototype */
/** exemption on an assurance requirement/task (BRD V4.2 change 7) */
export interface TaskExemption {
  reason: string;
  grantedBy: string;
  grantedAt?: string;
  newDate: string;
}

export interface TaskSection {
  id: string;
  name: string;
  order: number;
}

/** short-term permission granted to a named client user to change target dates (BRD V4.2 change 6) */
export interface DatePermissionGrant {
  id: string;
  userId: string;
  userName: string;
  grantedBy: string;
  grantedAt: string;
  expiresAt: string;
  reason?: string;
}

/** historical record of a target date change on an assurance set or one of its tasks (BRD V4.2 change 6) */
export interface TargetDateChangeRecord {
  id: string;
  setId: string;
  taskId?: string;
  requirementId?: string;
  taskTitle?: string;
  scope: 'set' | 'task';
  targetType?: 'set' | 'task';
  oldDate: string;
  newDate: string;
  changedBy: string;
  changedAt: string;
  reason?: string;
}

/** frozen copy of one document version, taken when a requirement is verified or its set is approved */
export interface RequirementVersionSnapshot {
  documentId: string;
  versionLabel: string;
  fileName: string;
  uploadedAt: string;
  verifiedAt: string;
  verifiedBy?: string;
  verificationStatus: 'Verified' | 'Pending' | 'Correction Requested' | 'Rejected';
  expiryDate?: string;
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
  /** display name of the user who created the set */
  createdByName?: string;
  id: string; // e.g. AS-2026-001
  title: string; // e.g. Chevron Gorgon Charter Vetting
  assuranceType?: AssuranceScopeType;
  /** specific asset or operational category, e.g. Tanker, Barge, Captain */
  scopeType?: string;
  /** nullable foreign key: a set belongs to at most one project; a project has zero or many sets */
  projectId?: string;
  projectName?: string;
  /** first crew member of a crew set; kept for single-member readers */
  crewId?: string;
  crewName?: string;
  /** every crew member a crew set covers, in selection order; crewIds[0] equals crewId (ADR 0023) */
  crewIds?: string[];
  crewNames?: string[];
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
  charterWindowStart: string; /* iso date - contractual hire window (on-hire delivery to off-hire redelivery) */
  charterWindowEnd: string; /* iso date - contractual hire window */
  complianceDeadline: string; /* iso date - the set must be complete on or before the contract start */
  projectWindowStart?: string; /* iso date - active offshore field operations window */
  projectWindowEnd?: string; /* iso date - active offshore field operations window */
  stage: AssuranceStage;
  readinessScore: number; // 0 - 100%
  requirements: AssuranceRequirement[];
  /** ordered task groups; a task points at one of these with sectionId */
  sections?: TaskSection[];
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
  /** organization that provides the one asset the set covers: its Vessel, Crew or Equipment Provider (cannot verify/approve own documents) */
  serviceProviderOrg?: string;
  /** initiating client organization that owns the assurance set */
  clientOrg?: string;
  /** organizations on this set, each placed as Client, Vendor, or Third party */
  parties?: OrganizationParty[];
  /** true when C Admin runs assurance on their own fleet (internal deployment, not third-party charter) */
  internalDeployment?: boolean;
  /** C Admin workflow: draft until sent for review; client owns final approval */
  clientWorkflowStage?: ClientWorkflowStage;
  sentForReviewAt?: string;
  /** iso date-time the set was approved and its document versions locked */
  lockedAt?: string;
  /** assurance objects covered by this set across multiple types (ADR 0029) */
  assuranceObjects?: AssuranceObject[];
  /** target date for the set (aligned with complianceDeadline; BRD V4.2 change 6) */
  targetDate?: string;
  /** short-term date change permission grants to named client users (BRD V4.2 change 6) */
  datePermissionGrants?: DatePermissionGrant[];
  /** audit history ledger of target date changes on this set and its tasks (BRD V4.2 change 6) */
  targetDateHistory?: TargetDateChangeRecord[];
  /** closure mode: full (default when approved) or partial (BRD V4.2 change 7) */
  closureType?: 'full' | 'partial';
  /** revised completion date when overdue (BRD V4.2 change 7) */
  revisedCompletionDate?: string;
  /** iso date-time the set was partially closed */
  partiallyClosedAt?: string;
  /** iso date-time the set was cancelled */
  cancelledAt?: string;
  /** reason why the set was cancelled */
  cancellationReason?: string;
}

/**
 * Generalized public assurance template blueprint.
 * Stripped of any specific asset bindings (no vessel, crew, equipment, project or execution stages).
 * Identified by AST- prefix.
 */
export interface AssuranceTemplate {
  /** template unique identifier, strictly prefixed with AST- (e.g. AST-2026-001) */
  id: string;
  title: string;
  description?: string;
  /** primary operational scope (Vessel, Crew, Equipment, Activity) */
  scope: AssuranceScopeType;
  /** operational scope alias for compatibility */
  assuranceType?: AssuranceScopeType;
  /** specific asset or operational category, e.g. Tanker, Barge, Captain, Crane, Lifeboat */
  scopeType: string;
  visibility: 'public' | 'organization' | 'private';
  templateSource?: 'public' | 'organization' | 'custom';
  appliedTemplates?: Record<string, string>;
  subtypes?: AssuranceSubtype[];
  requirements: AssuranceRequirement[];
  initiatorOrg: string;
  createdByPersona?: string;
  createdByName?: string;
  createdAt?: string;
  mandatoryInspectionRequired?: boolean;
  verificationRequired?: boolean;
  formalApprovalRequired?: boolean;
  reviewMode?: ReviewMode;
  reviewChannels?: ReviewChannel[];
}

