/* 
  file summary: unit tests verifying automatic document attachment for chartered assets in assurance sets.
  responsibilities: tests that when creating or initiating assurance sets for chartered vessels, crew, and equipment, existing linked documents and certificates are automatically matched and attached to corresponding requirements.
  role in system: executed during vitest test runs.
*/

import { describe, it, expect, beforeEach } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet, AssuranceRequirement } from '../types/assurance';
import { SUBTYPE_STANDARD_DOCS } from '../utils/assuranceTemplates';
import {
  autoAttachDocumentsToRequirements,
  findMatchingDocumentForRequirement,
  getAssetAutoAttachSummary,
} from '../utils/documentMatchingHelpers';
import { generateUniqueAssuranceSetId, generateUniqueRequirementId } from '../utils/validation';

describe('Chartered Asset Document Auto-Attachment', () => {
  beforeEach(() => {
    useMapStore.getState().setActivePersona('Administrator');
  });

  it('automatically matches and attaches statutory certificates linked to a chartered vessel', () => {
    const store = useMapStore.getState();
    const vessel = store.vessels.find((v) => v.id === 'VESSEL-001') || store.vessels[0];
    expect(vessel).toBeDefined();

    const rawRequirements: AssuranceRequirement[] = SUBTYPE_STANDARD_DOCS.Vessel.map((doc, idx) => ({
      id: `REQ-VES-${idx}`,
      category: doc.category,
      title: doc.title,
      description: doc.description,
      subtype: 'Vessel',
      isMandatory: doc.isMandatory,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending',
    }));

    const attachedRequirements = autoAttachDocumentsToRequirements(rawRequirements, {
      documents: store.documents,
      vessel,
      vessels: store.vessels,
    });

    // Verify that standard vessel certificates were auto-attached
    const classReq = attachedRequirements.find((r) => r.title === 'Certificate of Class');
    expect(classReq).toBeDefined();
    expect(classReq?.documentId).toBeDefined();
    expect(classReq?.isFulfilled).toBe(true);
    expect(classReq?.ocrConfidence).toBeGreaterThan(0);

    const ioppReq = attachedRequirements.find((r) => r.title.includes('IOPP'));
    expect(ioppReq).toBeDefined();
    expect(ioppReq?.documentId).toBeDefined();
    expect(ioppReq?.isFulfilled).toBe(true);
  });

  it('automatically matches and attaches STCW credentials linked to a chartered crew member', () => {
    const store = useMapStore.getState();
    const crewMember = store.crew.find((c) => c.id === 'CREW-101') || store.crew[0];
    expect(crewMember).toBeDefined();

    const rawRequirements: AssuranceRequirement[] = SUBTYPE_STANDARD_DOCS.Crew.map((doc, idx) => ({
      id: `REQ-CRW-${idx}`,
      category: doc.category,
      title: doc.title,
      description: doc.description,
      subtype: 'Crew',
      isMandatory: doc.isMandatory,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending',
    }));

    const attachedRequirements = autoAttachDocumentsToRequirements(rawRequirements, {
      documents: store.documents,
      crew: store.crew,
      selectedCrewId: crewMember.id,
      targetSubtype: 'Crew',
    });

    const medicalReq = attachedRequirements.find((r) => r.title.includes('ENG1') || r.title.includes('Medical'));
    expect(medicalReq).toBeDefined();
    expect(medicalReq?.documentId).toBeDefined();
    expect(medicalReq?.isFulfilled).toBe(true);
    expect(medicalReq?.ocrConfidence).toBeGreaterThan(0);
  });

  it('auto-attaches documents when adding a new assurance set via store.addAssuranceSet', () => {
    const store = useMapStore.getState();
    const uniqueId = generateUniqueAssuranceSetId(store.assuranceSets);
    const vessel = store.vessels[0];

    const newSet: AssuranceSet = {
      id: uniqueId,
      title: `Auto Attach Vetting Test - ${vessel.name}`,
      assuranceType: 'Vessel',
      vesselId: vessel.id,
      vesselName: vessel.name,
      imoNumber: vessel.imoNumber,
      initiatorOrg: 'Northwind Marine Pty Ltd',
      initiatorRole: 'Vessel Provider Admin',
      charterWindowStart: '2026-11-01',
      charterWindowEnd: '2027-11-01',
      stage: 'Initiated',
      readinessScore: 10,
      verificationRequired: true,
      mandatoryInspectionRequired: false,
      formalApprovalRequired: true,
      inspectionCompleted: false,
      requirements: SUBTYPE_STANDARD_DOCS.Vessel.map((doc, idx) => ({
        id: generateUniqueRequirementId(uniqueId, idx),
        category: doc.category,
        title: doc.title,
        subtype: 'Vessel',
        isMandatory: doc.isMandatory,
        isFulfilled: false,
        ocrConfidence: 0,
        verifierStatus: 'Pending',
      })),
      createdByPersona: 'Administrator',
    };

    store.addAssuranceSet(newSet);

    const savedSet = useMapStore.getState().assuranceSets.find((s) => s.id === uniqueId);
    expect(savedSet).toBeDefined();
    expect(savedSet?.requirements.some((r) => r.isFulfilled && r.documentId)).toBe(true);
    expect(savedSet?.readinessScore).toBeGreaterThan(10);
  });

  it('provides a detailed summary report of auto-attached documents for UI presentation', () => {
    const store = useMapStore.getState();
    const vessel = store.vessels.find((v) => v.id === 'VESSEL-001') || store.vessels[0];

    const rawRequirements: AssuranceRequirement[] = SUBTYPE_STANDARD_DOCS.Vessel.map((doc, idx) => ({
      id: `REQ-SUM-${idx}`,
      category: doc.category,
      title: doc.title,
      subtype: 'Vessel',
      isMandatory: doc.isMandatory,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending',
    }));

    const summary = getAssetAutoAttachSummary(rawRequirements, {
      documents: store.documents,
      vessel,
      vessels: store.vessels,
    });

    expect(summary.totalCount).toBe(rawRequirements.length);
    expect(summary.autoAttachedCount).toBeGreaterThan(0);
    expect(summary.attachedDetails.length).toBe(summary.autoAttachedCount);
    expect(summary.attachedDetails[0].docId).toBeTruthy();
    expect(summary.attachedDetails[0].ocrConfidence).toBeGreaterThan(0);
  });

  it('leaves requirements unfulfilled if the chartered asset has no matching documents', () => {
    const store = useMapStore.getState();

    const emptyRequirements: AssuranceRequirement[] = [
      {
        id: 'REQ-EMPTY-1',
        category: 'Statutory Certificate',
        title: 'Nonexistent Special Deep Sea Certificate 9999',
        subtype: 'Vessel',
        isMandatory: true,
        isFulfilled: false,
        ocrConfidence: 0,
        verifierStatus: 'Pending',
      },
    ];

    const attached = autoAttachDocumentsToRequirements(emptyRequirements, {
      documents: store.documents,
      selectedVesselId: 'VESSEL-NONEXISTENT',
    });

    expect(attached[0].isFulfilled).toBe(false);
    expect(attached[0].documentId).toBeUndefined();
    expect(attached[0].ocrConfidence).toBe(0);
  });
});
