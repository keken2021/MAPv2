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
}
