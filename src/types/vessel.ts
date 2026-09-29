/* 
  file summary: vessel data models and statutory interfaces matching the 11 Information categories for the marine assurance platform (map).
  responsibilities: defines complete domain types for vessel identification, classification, construction, tonnage, ownership, management, statutory certificates, insurance, crew, environmental specs, and document attachments.
  role in system: foundational type declarations consumed across store, tables, details views, and registration forms.
*/

import { AvailabilityStatus } from './asset';

export type VesselRegistrationStatus =
  | 'In Operations'
  | 'In Transit'
  | 'Dry Docking'
  | 'Lay-up'
  | 'Port Stay'
  | 'Under Charter'
  | 'Active'
  | 'Standby'
  | 'Maintenance'
  | 'Decommissioned'
  | 'Awaiting Orders'
  | 'In-Transit'
  | 'Dry-Docking';

export type ClassificationSociety = 'DNV' | 'ABS' | "Lloyd's Register" | 'Bureau Veritas' | 'RINA';

export type VesselClientCharterOutcome = 'Approved' | 'Rejected' | 'Returned for Correction' | 'In Progress' | 'Completed';

export interface VesselClientHistoryRecord {
  id: string;
  clientOrganization: string;
  charterTitle: string;
  assuranceSetId?: string;
  charterStart: string;
  charterEnd: string;
  outcome: VesselClientCharterOutcome;
  notes?: string;
}

export interface StatutoryCertificateSummary {
  id: string;
  name: string;
  certificateNumber: string;
  issuingBody: string;
  issueDate: string;
  expiryDate: string;
  status: 'Valid' | 'Expiring Soon' | 'Expired';
}

export interface VesselInformation {
  // Category 1 - Vessel Identification
  id: string;
  name: string; // e.g. MV Pacific Endeavour
  previousNames?: string;
  imoNumber: string; // 7 digits, e.g. 9123456
  officialRegNumber: string; // e.g. OSV-44-2019
  mmsiNumber: string; // 9 digits, e.g. 503728940
  callSign: string; // e.g. VJQ4821
  flagState: string; // e.g. Australia
  portOfRegistry: string; // e.g. Fremantle, WA
  status: VesselRegistrationStatus;
  complianceReadinessScore: number; // 0 - 100%
  imageUrl?: string; // Custom uploaded or selected profile image URL
  photos?: string[]; // Gallery or additional vessel photography

  /** FE-5: separate asset status dimensions (optional — derived when absent) */
  availabilityStatus?: AvailabilityStatus;
  availabilityUpdatedAt?: string;
  registrationStatus?: string;
  registrationUpdatedAt?: string;
  classStatus?: string;
  classStatusUpdatedAt?: string;
  complianceStatus?: string;
  complianceUpdatedAt?: string;

  // Category 2 - Classification & Notation
  vesselType: string; // e.g. Offshore Support Vessel (OSV)
  vesselSubtype: string; // e.g. AHTS / PSV
  intendedUse: string; // e.g. Offshore Supply & Towing
  tradingArea: string; // e.g. International
  classificationSociety: ClassificationSociety;
  classNotation: string; // e.g. +100A1 Offshore Support Vessel
  hullType: string; // e.g. Double Bottom / Double Side Steel
  ispsSolasStatus: string; // e.g. Fully Compliant

  // Category 3 - Construction & Dimensions
  yearBuilt: number; // e.g. 2019
  shipyardBuilder: string; // e.g. Damen Shipyards Group
  lengthOverallMeters: number; // e.g. 83.4
  beamMeters: number; // e.g. 18.0
  draftMeters: number; // e.g. 5.8

  // Category 4 - Tonnage & Propulsion
  grossTonnageGT: number; // e.g. 3250
  deadweightTonnageDWT: number; // e.g. 4100
  dynamicPositioningClass: string; // e.g. DP2 (Kongsberg K-Pos)
  mainEnginePowerKW: string; // e.g. 2x 2400 kW Wärtsilä

  // Category 5 - Ownership & Management
  registeredOwner: string; // e.g. Pacific Ocean Logistics Pty Ltd
  ownerType: string; // e.g. Corporate Entity
  corporateRegistryNo: string; // e.g. ACN 894 123 765
  ismCompany: string; // e.g. Ocean Fleet Management Services
  technicalManager: string; // e.g. Pacific Ship Management Ltd
  docNumber: string; // Document of Compliance Number
  contact247: string; // e.g. +61 8 9234 5678 (24/7 Ops)

  // Category 6 - Statutory Certificates
  statutoryCertificates: StatutoryCertificateSummary[];

  // Category 7 - Insurance & P&I Coverage
  hmInsurer: string; // Hull & Machinery Insurer
  piClubName: string; // P&I Club Name, e.g. Gard P&I Club
  policyNumber: string; // e.g. PI-2026-88492
  policyExpiryDate: string; // e.g. 2027-02-20

  // Category 8 - Crew & Safety Information
  safeManningComplement: number; // e.g. 14
  certifiedOfficersRatings: string; // e.g. 6 Officers / 8 Ratings
  masterName: string; // e.g. Capt. James Stirling
  lifeboatCapacity: number; // e.g. 30 persons (2x 15)

  // Category 9 - Environmental & Energy Efficiency
  fuelType: string; // e.g. MGO / VLSFO
  lowSulphurCompliant: boolean;
  bwtsSpec: string; // Ballast Water Treatment Spec
  owCalibrationDate: string; // Oil-Water Separator 15ppm calibration date

  // Category 10 & 11 - Attachments & Meta
  masterCertificateUploadCount: number;

  /** Past and current client / charter engagements for this vessel */
  clientHistory: VesselClientHistoryRecord[];
}

// Alias exports so components using legacy or current names work seamlessly
export type Vessel = VesselInformation;
/** @deprecated Use VesselInformation — kept for backward compatibility after rename */
export type VesselParticulars = VesselInformation;