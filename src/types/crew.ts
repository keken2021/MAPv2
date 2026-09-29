/* 
  file summary: stcw crew member profile and layered compliance document interfaces.
  responsibilities: defines structured types for crew Information, historical vessel sea service assignments, and stcw layer 1 & 2 certificates.
  role in system: consumed by CrewTable, CrewDetailView, CrewModal, CrewDocumentUploadModal, and useMapStore.
*/

export type STCWLayer = 'Layer 1 - Universal Core' | 'Layer 2 - Vessel Specific & Endorsements';

export type CrewComplianceStatus = 'Fully Compliant' | 'Expiring < 60 Days' | 'Document Deficient';

export interface STCWDocumentItem {
  id: string;
  title: string;
  layer: STCWLayer;
  stcwRegulation: string; // e.g. STCW II/2, VI/1, V/1-1
  certificateNo: string;
  issuingAuthority: string;
  flagState?: string;
  issueDate: string;
  expiryDate: string;
  verificationStatus: 'Verified' | 'Pending' | 'Expiring' | 'Expired';
  fileUrl?: string;
  fileName?: string;
  fileSizeBytes?: number;
}

export interface CrewVesselAssignment {
  id: string;
  vesselId: string;
  vesselName: string;
  imoNumber: string;
  vesselType: string; // e.g. OSV / AHTS, Oil/Chemical Tanker, LNG Carrier, Passenger Vessel
  rankHeld: string;
  organization?: string; // organization managing assignment
  embarkDate: string;
  disembarkDate?: string; // undefined if current assignment
  isCurrent: boolean;
}

export interface CrewMember {
  id: string; // e.g. CREW-101
  fullName: string;
  rank: string; // e.g. Master / Ship Captain, Chief Engineer, Chief Officer, Bosun
  nationality: string;
  organization?: string; // employer / managing organization
  seamansBookNo: string;
  passportNo: string;
  dateOfBirth: string;
  emergencyContact: string;
  currentVesselId?: string;
  currentVesselName?: string;
  complianceStatus: CrewComplianceStatus;
  overallComplianceScore: number; // 0-100%
  lastAuditedDate: string;
  assignments: CrewVesselAssignment[];
  layer1CoreDocuments: STCWDocumentItem[];
  layer2Endorsements: STCWDocumentItem[];
}
