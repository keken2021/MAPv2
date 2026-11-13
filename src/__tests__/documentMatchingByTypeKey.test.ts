/* 
  file summary: unit tests for document matching by type key (docTypeId).
  responsibilities: verifies exact key matching, rejection of wrong or missing keys, exclusion of expired and pending documents, selection of latest expiry date, and correct object scoping across Vessel, Crew, and Equipment.
  role in system: executed during vitest test runs for Task 4 / story 5483.
*/

import { describe, it, expect } from 'vitest';
import { findMatchingDocumentForRequirement, AssetMatchingContext } from '../utils/documentMatchingHelpers';
import { AssuranceRequirement } from '../types/assurance';
import { MasterDocument } from '../types/document';
import { CrewMember, STCWDocumentItem } from '../types/crew';
import { useMapStore } from '../store/useMapStore';

describe('Document Matching by Type Key', () => {
  const sampleVessel = useMapStore.getState().vessels[0];

  const createBaseMasterDoc = (overrides: Partial<MasterDocument>): MasterDocument => ({
    id: 'DOC-BASE',
    title: 'Base Title',
    entityType: 'Vessel Certificate',
    certificateNo: 'DNV-2026-001',
    issuingAuthority: 'DNV',
    expiryDate: '2028-12-31',
    ocrConfidence: 98,
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
    ...overrides,
  });

  it('matches by exact docTypeId and rejects title similarity if docTypeId differs', () => {
    const req: AssuranceRequirement = {
      id: 'REQ-1',
      docTypeId: 'vessel-class-cert',
      category: 'Statutory',
      title: 'Certificate of Class',
      subtype: 'Vessel',
      isMandatory: true,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending',
    };

    const wrongKeyDoc = createBaseMasterDoc({
      id: 'DOC-WRONG-1',
      docTypeId: 'vessel-load-line',
      title: 'Certificate of Class (Mislabeled Title)',
      vesselId: sampleVessel.id,
      targetObjectType: 'Vessel',
      targetObjectId: sampleVessel.id,
      verificationStatus: 'Verified',
      complianceState: 'Valid',
      expiryDate: '2027-12-31',
    });

    const exactKeyDoc = createBaseMasterDoc({
      id: 'DOC-EXACT-1',
      docTypeId: 'vessel-class-cert',
      title: 'Arbitrary Title But Matching Key',
      vesselId: sampleVessel.id,
      targetObjectType: 'Vessel',
      targetObjectId: sampleVessel.id,
      verificationStatus: 'Verified',
      complianceState: 'Valid',
      expiryDate: '2027-06-30',
    });

    const context: AssetMatchingContext = {
      documents: [wrongKeyDoc, exactKeyDoc],
      vessel: sampleVessel,
    };

    const match = findMatchingDocumentForRequirement(req, context);
    expect(match).toBeDefined();
    expect(match?.documentId).toBe('DOC-EXACT-1');
  });

  it('returns null if requirement has no docTypeId', () => {
    const req: AssuranceRequirement = {
      id: 'REQ-NO-KEY',
      category: 'Custom',
      title: 'Custom Specialized Inspection',
      subtype: 'Vessel',
      isMandatory: true,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending',
    };

    const doc = createBaseMasterDoc({
      id: 'DOC-1',
      docTypeId: 'vessel-class-cert',
      title: 'Custom Specialized Inspection',
      vesselId: sampleVessel.id,
    });

    const context: AssetMatchingContext = {
      documents: [doc],
      vessel: sampleVessel,
    };

    const match = findMatchingDocumentForRequirement(req, context);
    expect(match).toBeNull();
  });

  it('rejects expired vault documents (complianceState Expired or past expiryDate)', () => {
    const req: AssuranceRequirement = {
      id: 'REQ-1',
      docTypeId: 'vessel-class-cert',
      category: 'Statutory',
      title: 'Certificate of Class',
      subtype: 'Vessel',
      isMandatory: true,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending',
    };

    const expiredStateDoc = createBaseMasterDoc({
      id: 'DOC-EXP-1',
      docTypeId: 'vessel-class-cert',
      title: 'Certificate of Class',
      vesselId: sampleVessel.id,
      verificationStatus: 'Verified',
      complianceState: 'Expired',
      expiryDate: '2028-12-31',
    });

    const pastDateDoc = createBaseMasterDoc({
      id: 'DOC-EXP-2',
      docTypeId: 'vessel-class-cert',
      title: 'Certificate of Class',
      vesselId: sampleVessel.id,
      verificationStatus: 'Verified',
      complianceState: 'Valid',
      expiryDate: '2025-01-01', // in the past
    });

    const context: AssetMatchingContext = {
      documents: [expiredStateDoc, pastDateDoc],
      vessel: sampleVessel,
    };

    const match = findMatchingDocumentForRequirement(req, context);
    expect(match).toBeNull();
  });

  it('rejects unverified/pending vault documents', () => {
    const req: AssuranceRequirement = {
      id: 'REQ-1',
      docTypeId: 'vessel-class-cert',
      category: 'Statutory',
      title: 'Certificate of Class',
      subtype: 'Vessel',
      isMandatory: true,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending',
    };

    const pendingDoc = createBaseMasterDoc({
      id: 'DOC-PENDING-1',
      docTypeId: 'vessel-class-cert',
      title: 'Certificate of Class',
      vesselId: sampleVessel.id,
      verificationStatus: 'Pending',
      complianceState: 'Valid',
      expiryDate: '2028-12-31',
    });

    const context: AssetMatchingContext = {
      documents: [pendingDoc],
      vessel: sampleVessel,
    };

    const match = findMatchingDocumentForRequirement(req, context);
    expect(match).toBeNull();
  });

  it('selects the valid candidate with the latest expiry date', () => {
    const req: AssuranceRequirement = {
      id: 'REQ-1',
      docTypeId: 'vessel-class-cert',
      category: 'Statutory',
      title: 'Certificate of Class',
      subtype: 'Vessel',
      isMandatory: true,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending',
    };

    const earlierDoc = createBaseMasterDoc({
      id: 'DOC-EARLIER',
      docTypeId: 'vessel-class-cert',
      title: 'Class Certificate 2027',
      vesselId: sampleVessel.id,
      verificationStatus: 'Verified',
      complianceState: 'Valid',
      expiryDate: '2027-05-01',
    });

    const latestDoc = createBaseMasterDoc({
      id: 'DOC-LATEST',
      docTypeId: 'vessel-class-cert',
      title: 'Class Certificate 2029',
      vesselId: sampleVessel.id,
      verificationStatus: 'Verified',
      complianceState: 'Valid',
      expiryDate: '2029-10-15',
      currentVersion: 'v2.0',
    });

    const context: AssetMatchingContext = {
      documents: [earlierDoc, latestDoc],
      vessel: sampleVessel,
    };

    const match = findMatchingDocumentForRequirement(req, context);
    expect(match).toBeDefined();
    expect(match?.documentId).toBe('DOC-LATEST');
  });

  it('correctly scopes to vessel, crew, and equipment objects', () => {
    // 1. Vessel requirement only matches the target vessel
    const vesselReq: AssuranceRequirement = {
      id: 'REQ-V',
      docTypeId: 'vessel-class-cert',
      category: 'Statutory',
      title: 'Certificate of Class',
      subtype: 'Vessel',
      targetObjectId: sampleVessel.id,
      isMandatory: true,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending',
    };

    const otherVesselDoc = createBaseMasterDoc({
      id: 'DOC-VES-OTHER',
      docTypeId: 'vessel-class-cert',
      title: 'Class Certificate',
      vesselId: 'VESSEL-999',
      targetObjectType: 'Vessel',
      targetObjectId: 'VESSEL-999',
      verificationStatus: 'Verified',
      complianceState: 'Valid',
      expiryDate: '2028-01-01',
    });

    const matchOtherVessel = findMatchingDocumentForRequirement(vesselReq, {
      documents: [otherVesselDoc],
      vessel: sampleVessel,
    });
    expect(matchOtherVessel).toBeNull();

    // 2. Equipment requirement only matches target equipment
    const eqReq: AssuranceRequirement = {
      id: 'REQ-E',
      docTypeId: 'eq-lifting-register',
      category: 'Lifting Register',
      title: 'Lifting Appliances Register',
      subtype: 'Equipment',
      targetObjectId: 'EQ-005',
      isMandatory: true,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending',
    };

    const eqDoc = createBaseMasterDoc({
      id: 'DOC-EQ-005',
      docTypeId: 'eq-lifting-register',
      title: 'Lifting Appliances Register EQ-005',
      entityType: 'Equipment Certificate',
      targetObjectType: 'Equipment',
      targetObjectId: 'EQ-005',
      verificationStatus: 'Verified',
      complianceState: 'Valid',
      expiryDate: '2027-11-20',
    });

    const matchEq = findMatchingDocumentForRequirement(eqReq, {
      documents: [eqDoc],
      selectedEquipmentId: 'EQ-005',
    });
    expect(matchEq).toBeDefined();
    expect(matchEq?.documentId).toBe('DOC-EQ-005');

    // 3. Crew requirement matches STCW documents on crew member
    const crewReq: AssuranceRequirement = {
      id: 'REQ-C',
      docTypeId: 'crew-medical-cert',
      category: 'Medical',
      title: 'ENG1 Medical Fitness Certificate',
      subtype: 'Crew',
      targetObjectId: 'CREW-101',
      isMandatory: true,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending',
    };

    const stcwDoc: STCWDocumentItem = {
      id: 'STCW-ENG1-101',
      docTypeId: 'crew-medical-cert',
      title: 'ENG1 Seafarer Medical Fitness Certificate',
      layer: 'Layer 1 - Universal Core',
      stcwRegulation: 'STCW I/9',
      certificateNo: 'ENG1-2025-001',
      issuingAuthority: 'MCA UK',
      issueDate: '2025-02-10',
      expiryDate: '2027-02-10',
      verificationStatus: 'Verified',
    };

    const crewMember: CrewMember = {
      ...useMapStore.getState().crew[0],
      id: 'CREW-101',
      layer1CoreDocuments: [stcwDoc],
      layer2Endorsements: [],
    };

    const matchCrew = findMatchingDocumentForRequirement(crewReq, {
      documents: [],
      crew: [crewMember],
      selectedCrewId: 'CREW-101',
    });
    expect(matchCrew).toBeDefined();
    expect(matchCrew?.documentId).toBe('STCW-ENG1-101');
  });
});
