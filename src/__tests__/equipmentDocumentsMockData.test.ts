import { describe, it, expect } from 'vitest';
import { MOCK_DOCUMENTS } from '../store/mockData';
import { MOCK_EQUIPMENT } from '../store/equipmentMockData';
import { SUBTYPE_STANDARD_DOCS } from '../utils/assuranceTemplates';

describe('Equipment documents in mock data (Task 3)', () => {
  const equipmentCatalogDocTypeIds = new Set(
    SUBTYPE_STANDARD_DOCS.Equipment.map((doc) => doc.id)
  );

  const existingEquipmentIds = new Set(MOCK_EQUIPMENT.map((eq) => eq.id));

  const equipmentDocs = MOCK_DOCUMENTS.filter(
    (doc) => doc.targetObjectType === 'Equipment'
  );

  it('checks equipment documents exist and point at real equipment IDs and catalog IDs', () => {
    expect(equipmentDocs.length).toBeGreaterThanOrEqual(4);

    equipmentDocs.forEach((doc) => {
      expect(
        doc.targetObjectId,
        `Equipment document ${doc.id} must have a targetObjectId`
      ).toBeDefined();

      expect(
        existingEquipmentIds.has(doc.targetObjectId!),
        `Equipment document ${doc.id} points to non-existent equipment ${doc.targetObjectId}`
      ).toBe(true);

      expect(
        doc.docTypeId,
        `Equipment document ${doc.id} must have a docTypeId`
      ).toBeDefined();

      expect(
        equipmentCatalogDocTypeIds.has(doc.docTypeId!),
        `Equipment document ${doc.id} has invalid equipment catalog docTypeId: ${doc.docTypeId}`
      ).toBe(true);
    });
  });

  it('provides verified, valid documents for at least three equipment items', () => {
    const validVerifiedDocs = equipmentDocs.filter(
      (doc) =>
        doc.verificationStatus === 'Verified' &&
        doc.complianceState === 'Valid' &&
        new Date(doc.expiryDate).getTime() > Date.now()
    );

    const distinctEquipment = new Set(validVerifiedDocs.map((doc) => doc.targetObjectId));
    expect(distinctEquipment.size).toBeGreaterThanOrEqual(3);
    expect(distinctEquipment).toContain('EQ-005');
    expect(distinctEquipment).toContain('EQ-006');
    expect(distinctEquipment).toContain('EQ-007');
  });

  it('provides at least one expired equipment document to demonstrate non-reuse', () => {
    const expiredDoc = equipmentDocs.find(
      (doc) =>
        doc.complianceState === 'Expired' ||
        new Date(doc.expiryDate).getTime() < Date.now()
    );

    expect(expiredDoc).toBeDefined();
    expect(expiredDoc?.targetObjectId).toBe('EQ-008');
    expect(expiredDoc?.docTypeId).toBe('eq-helideck-cert');
  });
});

