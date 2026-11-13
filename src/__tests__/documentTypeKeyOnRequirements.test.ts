/*
  file summary: tests that new assurance set slots carry docTypeId when built from the catalog, and custom slots carry no key.
  responsibilities: verifies docTypeId is present on standard catalog requirements and absent on specialized / custom slots.
  role in system: covers Task 1 of auto-attach existing documents feature; src/types/assurance.ts and src/views/CreateAssuranceSetView.tsx.
*/

import { describe, it, expect } from 'vitest';
import { SUBTYPE_STANDARD_DOCS } from '../utils/assuranceTemplates';
import type { AssuranceRequirement } from '../types/assurance';

describe('Document type key on new set slots (Task 1)', () => {
  it('assigns docTypeId to every slot built from SUBTYPE_STANDARD_DOCS for Vessel, Crew, and Equipment', () => {
    const vesselSlots: AssuranceRequirement[] = SUBTYPE_STANDARD_DOCS.Vessel.map((doc, idx) => ({
      id: `REQ-VES-${idx}`,
      category: doc.category,
      title: doc.title,
      description: doc.description,
      subtype: doc.subtype,
      docTypeId: doc.id,
      isMandatory: doc.isMandatory,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending',
    }));

    const crewSlots: AssuranceRequirement[] = SUBTYPE_STANDARD_DOCS.Crew.map((doc, idx) => ({
      id: `REQ-CRW-${idx}`,
      category: doc.category,
      title: doc.title,
      description: doc.description,
      subtype: doc.subtype,
      docTypeId: doc.id,
      isMandatory: doc.isMandatory,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending',
    }));

    const eqSlots: AssuranceRequirement[] = SUBTYPE_STANDARD_DOCS.Equipment.map((doc, idx) => ({
      id: `REQ-EQP-${idx}`,
      category: doc.category,
      title: doc.title,
      description: doc.description,
      subtype: doc.subtype,
      docTypeId: doc.id,
      isMandatory: doc.isMandatory,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending',
    }));

    expect(vesselSlots.length).toBeGreaterThan(0);
    expect(crewSlots.length).toBeGreaterThan(0);
    expect(eqSlots.length).toBeGreaterThan(0);

    vesselSlots.forEach((slot, i) => {
      expect(slot.docTypeId).toBe(SUBTYPE_STANDARD_DOCS.Vessel[i].id);
      expect(slot.docTypeId).toBeTruthy();
    });

    crewSlots.forEach((slot, i) => {
      expect(slot.docTypeId).toBe(SUBTYPE_STANDARD_DOCS.Crew[i].id);
      expect(slot.docTypeId).toBeTruthy();
    });

    eqSlots.forEach((slot, i) => {
      expect(slot.docTypeId).toBe(SUBTYPE_STANDARD_DOCS.Equipment[i].id);
      expect(slot.docTypeId).toBeTruthy();
    });
  });

  it('ensures custom / specialized slots carry no docTypeId key', () => {
    const customSlot: AssuranceRequirement = {
      id: 'REQ-CUSTOM-001',
      category: 'Operational Plan',
      title: 'Site-Specific SIMOPS Matrix & Safety Zone Procedure',
      description: 'Custom bespoke bridging document required for specific offshore installation campaign.',
      subtype: 'Vessel',
      isMandatory: true,
      isSpecialized: true,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending',
    };

    expect(customSlot.isSpecialized).toBe(true);
    expect(customSlot.docTypeId).toBeUndefined();
  });
});
