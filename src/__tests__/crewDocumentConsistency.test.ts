/*
  file summary: unit test suite verifying consistency and accuracy between crew directory members and document library mock documents.
  responsibilities: validates matching certificate numbers, passport numbers, seaman book numbers, vessel assignments, and document uniqueness.
  role in system: guarantees stcw documentation accuracy across crewing and master document registers.
*/

import { describe, it, expect } from 'vitest';
import { MOCK_CREW } from '../store/crewMockData';
import { MOCK_DOCUMENTS, MOCK_VESSELS, MOCK_ASSURANCE_SETS } from '../store/mockData';
import { useMapStore } from '../store/useMapStore';

describe('crew directory and document library mock data consistency', () => {
  it('ensures all mock documents in document library have unique IDs and certificate numbers', () => {
    const ids = MOCK_DOCUMENTS.map((d) => d.id);
    const certNos = MOCK_DOCUMENTS.map((d) => d.certificateNo);

    const uniqueIds = new Set(ids);
    const uniqueCertNos = new Set(certNos);

    expect(uniqueIds.size).toBe(ids.length);
    expect(uniqueCertNos.size).toBe(certNos.length);
  });

  it('matches all 5 crew directory members to their respective documents in document library', () => {
    expect(MOCK_CREW.length).toBe(5);

    MOCK_CREW.forEach((member) => {
      /* check that crew member passport and seaman's book numbers are accurately matched in documents */
      const passportDoc = MOCK_DOCUMENTS.find(
        (d) => d.certificateNo === member.passportNo && d.entityType === 'Crew Certificate'
      );
      expect(passportDoc).toBeDefined();
      expect(passportDoc?.crewAttributes?.passportId).toBe(member.passportNo);
      expect(passportDoc?.crewAttributes?.crewName).toBe(member.fullName);

      const seamansBookDoc = MOCK_DOCUMENTS.find(
        (d) => d.certificateNo === member.seamansBookNo && d.entityType === 'Crew Certificate'
      );
      expect(seamansBookDoc).toBeDefined();
      expect(seamansBookDoc?.crewAttributes?.crewName).toBe(member.fullName);

      /* verify all layer 1 core documents exist in document library with identical details */
      member.layer1CoreDocuments.forEach((l1) => {
        const matchingDoc = MOCK_DOCUMENTS.find((d) => d.id === l1.id);
        expect(matchingDoc).toBeDefined();
        expect(matchingDoc?.certificateNo).toBe(l1.certificateNo);
        expect(matchingDoc?.issuingAuthority).toBe(l1.issuingAuthority);
        expect(matchingDoc?.expiryDate).toBe(l1.expiryDate);
        expect(matchingDoc?.crewAttributes?.crewName).toBe(member.fullName);
      });

      /* verify all layer 2 endorsements exist in document library with identical details */
      member.layer2Endorsements.forEach((l2) => {
        const matchingDoc = MOCK_DOCUMENTS.find((d) => d.id === l2.id);
        expect(matchingDoc).toBeDefined();
        expect(matchingDoc?.certificateNo).toBe(l2.certificateNo);
        expect(matchingDoc?.issuingAuthority).toBe(l2.issuingAuthority);
        expect(matchingDoc?.expiryDate).toBe(l2.expiryDate);
        expect(matchingDoc?.crewAttributes?.crewName).toBe(member.fullName);
      });
    });
  });

  it('ensures vessel assignments and vessel master names match between crew directory and vessels', () => {
    const alexanderWright = MOCK_CREW.find((c) => c.id === 'CREW-101');
    expect(alexanderWright).toBeDefined();
    expect(alexanderWright?.currentVesselId).toBe('VESSEL-001');

    const vessel001 = MOCK_VESSELS.find((v) => v.id === 'VESSEL-001');
    expect(vessel001).toBeDefined();
    expect(vessel001?.masterName).toBe(alexanderWright?.fullName);

    /* verify assurance set req-103 links to alexander wright master coc */
    const as001 = MOCK_ASSURANCE_SETS.find((a) => a.id === 'AS-2026-001');
    const req103 = as001?.requirements.find((r) => r.id === 'REQ-103');
    expect(req103).toBeDefined();
    expect(req103?.documentId).toBe('MAP-CRW-2026-STCW-00106');

    const doc106 = MOCK_DOCUMENTS.find((d) => d.id === 'MAP-CRW-2026-STCW-00106');
    expect(doc106).toBeDefined();
    expect(doc106?.crewAttributes?.crewName).toBe(alexanderWright?.fullName);
    expect(doc106?.certificateNo).toBe('CoC-II-2-0041');
  });

  it('automatically registers and stores new crew certificates into document library when registering crew or uploading documents in store', () => {
    /* test dynamic crew member registration */
    const newCrewMember = {
      id: 'CREW-NEW-999',
      fullName: 'Chief Off. Elena Rostova',
      rank: 'Chief Officer',
      nationality: 'Australian',
      organization: 'Northwind Marine Pty Ltd',
      seamansBookNo: 'SB-AU-999111',
      passportNo: 'PA-AU-999222',
      dateOfBirth: '1989-08-12',
      emergencyContact: '+61 400 999 888',
      currentVesselId: 'VESSEL-001',
      currentVesselName: 'MV Pacific Endeavour (IMO 9123456)',
      complianceStatus: 'Fully Compliant' as const,
      overallComplianceScore: 100,
      lastAuditedDate: '2026-09-24',
      assignments: [],
      layer1CoreDocuments: [
        {
          id: 'MAP-CRW-2026-IDNT-00777',
          title: 'Valid International Passport',
          layer: 'Layer 1 - Universal Core' as const,
          stcwRegulation: 'SOLAS / National Regs',
          certificateNo: 'PA-AU-999222',
          issuingAuthority: 'Australian Passport Office',
          issueDate: '2023-01-01',
          expiryDate: '2033-01-01',
          verificationStatus: 'Verified' as const,
          fileName: 'passport_elena_rostova.pdf',
          fileSizeBytes: 1400000,
        },
      ],
      layer2Endorsements: [],
    };

    useMapStore.getState().addCrewMember(newCrewMember);

    const storeDocs = useMapStore.getState().documents;
    const addedPassportDoc = storeDocs.find((d: any) => d.id === 'MAP-CRW-2026-IDNT-00777');
    expect(addedPassportDoc).toBeDefined();
    expect(addedPassportDoc?.certificateNo).toBe('PA-AU-999222');
    expect(addedPassportDoc?.crewAttributes?.crewName).toBe('Chief Off. Elena Rostova');
    expect(addedPassportDoc?.entityType).toBe('Crew Certificate');

    /* test dynamic crew certificate upload */
    const newDynamicCert = {
      id: 'MAP-CRW-2026-STCW-00778',
      title: 'Dynamic Positioning Advanced Certificate',
      layer: 'Layer 2 - Vessel Specific & Endorsements' as const,
      stcwRegulation: 'IMCA DP Advanced',
      certificateNo: 'DP-ADV-99881',
      issuingAuthority: 'The Nautical Institute',
      issueDate: '2024-05-01',
      expiryDate: '2029-05-01',
      verificationStatus: 'Verified' as const,
      fileName: 'dp_advanced_rostova.pdf',
      fileSizeBytes: 1900000,
    };

    useMapStore.getState().addCrewDocument('CREW-NEW-999', newDynamicCert);

    const updatedStoreDocs = useMapStore.getState().documents;
    const addedDynamicDoc = updatedStoreDocs.find((d: any) => d.id === 'MAP-CRW-2026-STCW-00778');
    expect(addedDynamicDoc).toBeDefined();
    expect(addedDynamicDoc?.certificateNo).toBe('DP-ADV-99881');
    expect(addedDynamicDoc?.crewAttributes?.crewName).toBe('Chief Off. Elena Rostova');

    /* test dynamic crew certificate update */
    const updatedDynamicCert = {
      ...newDynamicCert,
      certificateNo: 'DP-ADV-99881-REV1',
    };
    useMapStore.getState().updateCrewDocument('CREW-NEW-999', updatedDynamicCert);

    const reupdatedDocs = useMapStore.getState().documents;
    const updatedDoc = reupdatedDocs.find((d: any) => d.id === 'MAP-CRW-2026-STCW-00778');
    expect(updatedDoc?.certificateNo).toBe('DP-ADV-99881-REV1');

    /* test dynamic crew certificate deletion */
    useMapStore.getState().deleteCrewDocument('CREW-NEW-999', 'MAP-CRW-2026-STCW-00778');
    const finalDocs = useMapStore.getState().documents;
    expect(finalDocs.find((d: any) => d.id === 'MAP-CRW-2026-STCW-00778')).toBeUndefined();
  });
});

