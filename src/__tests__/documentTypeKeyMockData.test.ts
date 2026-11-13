import { describe, it, expect } from 'vitest';
import { MOCK_DOCUMENTS } from '../store/mockData';
import { MOCK_CREW } from '../store/crewMockData';
import { SUBTYPE_STANDARD_DOCS } from '../utils/assuranceTemplates';

describe('Document type key in mock data', () => {
  const allCatalogDocTypeIds = new Set<string>();
  Object.values(SUBTYPE_STANDARD_DOCS).forEach((docList) => {
    docList.forEach((doc) => allCatalogDocTypeIds.add(doc.id));
  });

  const crewCatalogDocTypeIds = new Set(
    SUBTYPE_STANDARD_DOCS.Crew.map((doc) => doc.id)
  );

  const vesselCatalogDocTypeIds = new Set(
    SUBTYPE_STANDARD_DOCS.Vessel.map((doc) => doc.id)
  );

  const equipmentCatalogDocTypeIds = new Set(
    SUBTYPE_STANDARD_DOCS.Equipment.map((doc) => doc.id)
  );

  it('checks every docTypeId in MOCK_DOCUMENTS exists in SUBTYPE_STANDARD_DOCS', () => {
    const docsWithKey = MOCK_DOCUMENTS.filter((doc) => Boolean(doc.docTypeId));
    expect(docsWithKey.length).toBeGreaterThan(0);

    docsWithKey.forEach((doc) => {
      expect(
        allCatalogDocTypeIds.has(doc.docTypeId!),
        `Document ${doc.id} has unknown docTypeId: ${doc.docTypeId}`
      ).toBe(true);

      if (doc.entityType === 'Vessel Certificate' && doc.docTypeId) {
        expect(
          vesselCatalogDocTypeIds.has(doc.docTypeId),
          `Vessel document ${doc.id} has non-vessel docTypeId: ${doc.docTypeId}`
        ).toBe(true);
      }

      if (doc.entityType === 'Equipment Certificate' && doc.docTypeId) {
        expect(
          equipmentCatalogDocTypeIds.has(doc.docTypeId),
          `Equipment document ${doc.id} has non-equipment docTypeId: ${doc.docTypeId}`
        ).toBe(true);
      }
    });
  });

  it('checks every docTypeId in MOCK_CREW certificates exists in SUBTYPE_STANDARD_DOCS.Crew', () => {
    let crewCertCount = 0;
    MOCK_CREW.forEach((member) => {
      const allCerts = [
        ...(member.layer1CoreDocuments || []),
        ...(member.layer2Endorsements || []),
      ];
      allCerts.forEach((cert) => {
        if (cert.docTypeId) {
          crewCertCount++;
          expect(
            crewCatalogDocTypeIds.has(cert.docTypeId),
            `Crew ${member.id} cert ${cert.id} has unknown docTypeId: ${cert.docTypeId}`
          ).toBe(true);
        }
      });
    });
    expect(crewCertCount).toBeGreaterThan(0);
  });

  it('ensures demo vessels have tagged documents including valid, pending, and expired', () => {
    const v1Docs = MOCK_DOCUMENTS.filter((d) => d.vesselId === 'VESSEL-001' && d.entityType === 'Vessel Certificate');
    const v1ValidKeys = v1Docs
      .filter((d) => d.verificationStatus === 'Verified' && d.complianceState !== 'Expired')
      .map((d) => d.docTypeId);
    expect(v1ValidKeys).toContain('vessel-class-cert');
    expect(v1ValidKeys).toContain('vessel-solas-cssec');
    expect(v1ValidKeys).toContain('vessel-iopp-cert');

    const v1Expired = v1Docs.find(
      (d) => d.complianceState === 'Expired' || new Date(d.expiryDate).getTime() < Date.now()
    );
    expect(v1Expired).toBeDefined();
    expect(v1Expired?.docTypeId).toBe('vessel-loadline-cert');

    const v1Pending = v1Docs.find((d) => d.verificationStatus === 'Pending');
    expect(v1Pending).toBeDefined();
    expect(v1Pending?.docTypeId).toBe('vessel-mlc-cert');

    const v12Docs = MOCK_DOCUMENTS.filter((d) => d.vesselId === 'VESSEL-012');
    expect(v12Docs.length).toBeGreaterThan(0);
    expect(v12Docs.every((d) => d.verificationStatus === 'Pending')).toBe(true);
  });

  it('ensures demo crew members have tagged certificates including valid and pending', () => {
    const c101 = MOCK_CREW.find((c) => c.id === 'CREW-101');
    expect(c101).toBeDefined();
    const c101Certs = [
      ...(c101!.layer1CoreDocuments || []),
      ...(c101!.layer2Endorsements || []),
    ];

    const c101ValidKeys = c101Certs
      .filter((c) => c.verificationStatus === 'Verified' && new Date(c.expiryDate).getTime() > Date.now())
      .map((c) => c.docTypeId);
    expect(c101ValidKeys).toContain('crew-stcw-coc');
    expect(c101ValidKeys).toContain('crew-eng1-medical');
    expect(c101ValidKeys).toContain('crew-bosiet-training');
    expect(c101ValidKeys).toContain('crew-dp-logbook');

    const c104 = MOCK_CREW.find((c) => c.id === 'CREW-104');
    const c104Certs = [
      ...(c104!.layer1CoreDocuments || []),
      ...(c104!.layer2Endorsements || []),
    ];
    const c104Pending = c104Certs.find((c) => c.verificationStatus === 'Pending');
    expect(c104Pending).toBeDefined();
    expect(c104Pending?.docTypeId).toBe('crew-eng1-medical');
  });
});
