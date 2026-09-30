/* 
  file summary: unit tests for general fleet registry search by vessel attributes, assurance sets, and document information.
  responsibilities: tests matchesVesselSearch helper for full coverage of vessel, assurance set, requirement, and document criteria.
  role in system: validates search functionality for Administrator, Submitter, and C Admin personas.
*/

import { describe, it, expect } from 'vitest';
import { matchesVesselSearch } from '../utils/rbacHelpers';
import { AssuranceSet } from '../types/assurance';
import { MasterDocument } from '../types/document';
import { MOCK_VESSELS } from '../store/mockData';

const mockVessel = {
  ...MOCK_VESSELS[0],
  id: 'VESSEL-001',
  name: 'MV Pacific Endeavour',
  imoNumber: '9123456',
  vesselType: 'Offshore Support Vessel (OSV)',
  vesselSubtype: 'AHTS / PSV',
  shipyardBuilder: 'Damen Shipyards Group',
  registeredOwner: 'Pacific Ocean Logistics Pty Ltd',
  statutoryCertificates: [
    {
      id: 'SC-001',
      name: 'Safety Management Certificate (SMC)',
      certificateNumber: 'SMC-DNV-2024-912',
      issuingBody: 'DNV',
      issueDate: '2024-01-15',
      expiryDate: '2029-01-14',
      status: 'Valid' as const,
    },
  ],
};

const mockAssuranceSets: AssuranceSet[] = [
  {
    id: 'AS-2026-001',
    title: 'Chevron Gorgon Charter Vetting',
    vesselId: 'VESSEL-001',
    vesselName: 'MV Pacific Endeavour',
    imoNumber: '9123456',
    initiatorOrg: 'Chevron Australia',
    initiatorRole: 'Client Admin',
    charterer: 'Chevron Global Upstream',
    charterWindowStart: '2026-03-01',
    charterWindowEnd: '2026-06-30',
    stage: 'Approved',
    readinessScore: 95,
    mandatoryInspectionRequired: true,
    inspectionCompleted: true,
    assignedStakeholders: undefined,
    stakeholders: {},
    createdByPersona: 'C Admin',
    requirements: [
      {
        id: 'REQ-001',
        category: 'Statutory Certificate',
        title: 'Cargo Ship Safety Equipment',
        isMandatory: true,
        isFulfilled: true,
        ocrConfidence: 98,
        documentId: 'MAP-VES-2026-STAT-00001',
        linkedDocumentId: 'MAP-VES-2026-STAT-00001',
        verifierStatus: 'Verified',
        notes: 'Audited and verified by Lloyd surveyor',
      },
    ],
  },
];

const mockDocuments: MasterDocument[] = [
  {
    id: 'MAP-VES-2026-STAT-00001',
    title: 'International Oil Pollution Prevention Certificate (IOPP)',
    entityType: 'Vessel Certificate',
    vesselId: 'VESSEL-001',
    certificateNo: 'IOPP-DNV-2026-0091',
    issuingAuthority: 'DNV Maritime Authority',
    expiryDate: '2028-11-20',
    ocrConfidence: 99,
    complianceState: 'Valid',
    currentVersion: 'v1.0',
    versions: [],
    validationRules: {
      charterBufferPassed: true,
      assetMatch100Percent: true,
      iacsAuthorityValid: true,
      overallValid: true,
    },
    verificationStatus: 'Verified',
    vesselAttributes: {
      title: 'IOPP Certificate',
      certificateNumber: 'IOPP-DNV-2026-0091',
      certType: 'Statutory Certificate',
      issuingBody: 'DNV Maritime Authority',
      issueDate: '2023-11-20',
      expiryDate: '2028-11-20',
      vesselName: 'MV Pacific Endeavour',
      imoNumber: '9123456',
      flagState: 'Australia',
      assetMatchFlag: true,
      lastSurveyDate: '2025-11-20',
      ocrConfidence: 99,
      status: 'Valid',
    },
  },
  {
    id: 'MAP-CRW-2026-STCW-00101',
    title: 'STCW Reg II/2 Master Mariner Certificate of Competency',
    entityType: 'Crew Certificate',
    vesselId: 'VESSEL-001',
    certificateNo: 'AMSA-COC-98762',
    issuingAuthority: 'AMSA Australia',
    expiryDate: '2029-05-15',
    ocrConfidence: 97,
    complianceState: 'Valid',
    currentVersion: 'v1.0',
    versions: [],
    validationRules: {
      charterBufferPassed: true,
      assetMatch100Percent: true,
      iacsAuthorityValid: true,
      overallValid: true,
    },
    verificationStatus: 'Verified',
    crewAttributes: {
      crewName: 'Capt. Alexander Vance',
      passportId: 'PASS-AU-98214',
      rank: 'Master Mariner',
      certType: 'STCW Reg II/2 Master',
      issuingCenter: 'Australian Maritime Safety Authority (AMSA)',
      issueDate: '2024-05-15',
      expiryDate: '2029-05-15',
      assignedVessel: 'MV Pacific Endeavour',
      nationality: 'Australian',
      trainingDate: '2024-04-01',
      ocrConfidence: 97,
    },
  },
];

describe('matchesVesselSearch - Fleet Registry Search by Assurance Sets and Documents', () => {
  it('returns true for empty or whitespace-only search string', () => {
    expect(matchesVesselSearch(mockVessel, '', mockAssuranceSets, mockDocuments)).toBe(true);
    expect(matchesVesselSearch(mockVessel, '   ', mockAssuranceSets, mockDocuments)).toBe(true);
  });

  it('matches vessel core fields (name, IMO, owner, type, classification)', () => {
    expect(matchesVesselSearch(mockVessel, 'Pacific Endeavour', mockAssuranceSets, mockDocuments)).toBe(true);
    expect(matchesVesselSearch(mockVessel, '9123456', mockAssuranceSets, mockDocuments)).toBe(true);
    expect(matchesVesselSearch(mockVessel, 'Pacific Ocean Logistics', mockAssuranceSets, mockDocuments)).toBe(true);
    expect(matchesVesselSearch(mockVessel, 'AHTS', mockAssuranceSets, mockDocuments)).toBe(true);
    expect(matchesVesselSearch(mockVessel, 'Damen', mockAssuranceSets, mockDocuments)).toBe(true);
  });

  it('matches vessel by linked Assurance Set ID and Title', () => {
    expect(matchesVesselSearch(mockVessel, 'AS-2026-001', mockAssuranceSets, mockDocuments)).toBe(true);
    expect(matchesVesselSearch(mockVessel, 'Gorgon Charter Vetting', mockAssuranceSets, mockDocuments)).toBe(true);
    expect(matchesVesselSearch(mockVessel, 'Chevron Global Upstream', mockAssuranceSets, mockDocuments)).toBe(true);
  });

  it('matches vessel by Assurance Set Requirement title, category, or note', () => {
    expect(matchesVesselSearch(mockVessel, 'Cargo Ship Safety Equipment', mockAssuranceSets, mockDocuments)).toBe(true);
    expect(matchesVesselSearch(mockVessel, 'Lloyd surveyor', mockAssuranceSets, mockDocuments)).toBe(true);
  });

  it('matches vessel by linked Master Document ID (MAP-[ENTITY]-[YYYY]-[CATEGORY]-[SEQ])', () => {
    expect(matchesVesselSearch(mockVessel, 'MAP-VES-2026-STAT-00001', mockAssuranceSets, mockDocuments)).toBe(true);
    expect(matchesVesselSearch(mockVessel, 'MAP-CRW-2026-STCW-00101', mockAssuranceSets, mockDocuments)).toBe(true);
  });

  it('matches vessel by Master Document certificate number, title, and issuing authority', () => {
    expect(matchesVesselSearch(mockVessel, 'IOPP-DNV-2026-0091', mockAssuranceSets, mockDocuments)).toBe(true);
    expect(matchesVesselSearch(mockVessel, 'Oil Pollution Prevention', mockAssuranceSets, mockDocuments)).toBe(true);
    expect(matchesVesselSearch(mockVessel, 'DNV Maritime Authority', mockAssuranceSets, mockDocuments)).toBe(true);
  });

  it('matches vessel by linked crew credentials and crew name', () => {
    expect(matchesVesselSearch(mockVessel, 'Alexander Vance', mockAssuranceSets, mockDocuments)).toBe(true);
    expect(matchesVesselSearch(mockVessel, 'PASS-AU-98214', mockAssuranceSets, mockDocuments)).toBe(true);
    expect(matchesVesselSearch(mockVessel, 'Master Mariner', mockAssuranceSets, mockDocuments)).toBe(true);
  });

  it('matches vessel by direct statutory certificate on vessel record', () => {
    expect(matchesVesselSearch(mockVessel, 'SMC-DNV-2024-912', mockAssuranceSets, mockDocuments)).toBe(true);
  });

  it('returns false when no vessel, assurance set, or document matches the search query', () => {
    expect(matchesVesselSearch(mockVessel, 'Nonexistent Query XYZ', mockAssuranceSets, mockDocuments)).toBe(false);
  });
});
