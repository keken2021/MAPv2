/* 
  file summary: Document Library models containing 13 vessel attributes, 11 crew attributes, ocr confidence metrics, and versioning schemas.
  responsibilities: defines complete types for statutory vessel certificates, crew stcw clearances, version history records, and extraction validation checks.
  role in system: used by document library, verifier split-screen drawer, deep-dive document view, and assurance set requirements.
*/

export type DocumentEntityType = 'Vessel Certificate' | 'Crew Certificate';

export type ComplianceState = 'Valid' | 'Expiring < 6 Mos' | 'Mismatch/Exception' | 'Expired';

export interface DocumentVersion {
  versionLabel: string; // e.g. v1.0, v1.1
  uploadedAt: string;
  uploadedBy: string;
  fileSizeBytes: number;
  fileName: string;
  changeSummary: string;
  attemptNumber?: number;
}

export interface VesselCertAttributes {
  title: string;
  certificateNumber: string; // e.g. DNV-STAT-2026-99
  certType: string;
  issuingBody: string; // e.g. DNV / ABS
  issueDate: string;
  expiryDate: string;
  vesselName: string;
  imoNumber: string;
  flagState: string;
  assetMatchFlag: boolean; // 100% asset match check
  lastSurveyDate: string;
  ocrConfidence: number; // e.g. 96%
  status: ComplianceState;
  /* Extended IMO & statutory certificate attributes (gap review R2-G1) */
  uniqueTrackingNumber?: string; // UTN, TID, or QR verification payload
  issuingState?: string; // Flag state administration separate from RO
  recognisedOrganisation?: string; // RO acting on behalf of flag (e.g. DNV, LR)
  placeOfIssue?: string; // Port or city of issue
  surveyCompletionDate?: string; // Date survey/audit was completed
  anniversaryDate?: string; // Annual survey anniversary window reference
  isInterim?: boolean; // Interim certificate flag (max 5-6 mos)
  companyImoNumber?: string; // Operating company IMO number (DOC/SMC/ISSC)
  grossTonnagePrinted?: number; // Gross tonnage as printed on certificate
  certificateStatus?: 'Valid' | 'Expiring Soon' | 'Expired' | 'Suspended' | 'Withdrawn' | 'Superseded';
  checksumSha256?: string;
  attemptNumber?: number;
  decisionTime?: string; // SHA-256 digital fingerprint of certificate
}

export interface CrewCertAttributes {
  crewName: string; // e.g. Capt. James Stirling
  passportId: string; // e.g. PA-983421
  rank: string; // e.g. Master / Chief Engineer
  certType: string; // e.g. STCW Reg II/2 Master CoC
  issuingCenter: string; // e.g. Australian Maritime Safety Authority (AMSA)
  issueDate: string;
  expiryDate: string;
  assignedVessel: string;
  nationality: string; // e.g. Australian
  trainingDate: string;
  ocrConfidence: number; // e.g. 98%
}

export interface ValidationRuleStatus {
  charterBufferPassed: boolean; // 6-month buffer check
  assetMatch100Percent: boolean; // 100% imo/name match
  iacsAuthorityValid: boolean; // IACS recognized body
  overallValid: boolean;
  exceptionDetails?: string;
  /* true until a check has run: the booleans above then mean nothing and the UI shows "Not checked" (gap review E7) */
  rulesNotChecked?: boolean;
}

export interface MasterDocument {
  id: string; // e.g. MAP-VES-2026-STAT-00412
  title: string;
  entityType: DocumentEntityType;
  vesselId: string;
  certificateNo: string;
  issuingAuthority: string;
  expiryDate: string;
  ocrConfidence: number; // 0 - 100%
  complianceState: ComplianceState;
  currentVersion: string; // e.g. v1.1
  versions: DocumentVersion[];
  vesselAttributes?: VesselCertAttributes;
  crewAttributes?: CrewCertAttributes;
  validationRules: ValidationRuleStatus;
  verificationStatus: 'Pending' | 'Verified' | 'Correction Requested' | 'Rejected';
  verificationNotes?: string;
  fileUrl?: string;
  /* Extended IMO certificate metadata (gap review R2-G1) */
  uniqueTrackingNumber?: string;
  issuingState?: string;
  recognisedOrganisation?: string;
  placeOfIssue?: string;
  surveyCompletionDate?: string;
  anniversaryDate?: string;
  isInterim?: boolean;
  companyImoNumber?: string;
  grossTonnagePrinted?: number;
  checksumSha256?: string;
  attemptNumber?: number;
  decisionTime?: string;
}
