/* 
  file summary: unit tests verifying that reused verified documents count as done with audit logging.
  responsibilities: tests that addAssuranceSet marks reused slots as fulfilled and Verified, recalculates readiness upwards, and logs one 'Auto-attached existing document' audit event per reused slot.
  role in system: executed during vitest test runs for Task 5 / story 5483.
*/

import { describe, it, expect, beforeEach } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet, AssuranceRequirement } from '../types/assurance';
import { SUBTYPE_STANDARD_DOCS } from '../utils/assuranceTemplates';
import { generateUniqueAssuranceSetId, generateUniqueRequirementId } from '../utils/validation';

const initialState = useMapStore.getState();

describe('Reused document counts as done with audit logging', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
    useMapStore.getState().setActivePersona('Administrator');
  });

  it('marks reused valid slots as Verified and fulfilled, leaves expired slots unfulfilled, and logs audit events', () => {
    const store = useMapStore.getState();
    const vessel = store.vessels.find((v) => v.id === 'VESSEL-001') || store.vessels[0];
    const uniqueId = generateUniqueAssuranceSetId(store.assuranceSets);

    const initialAuditCount = store.auditEvents.length;

    const requirements: AssuranceRequirement[] = SUBTYPE_STANDARD_DOCS.Vessel.map((doc, idx) => ({
      id: generateUniqueRequirementId(uniqueId, idx),
      docTypeId: doc.id,
      category: doc.category,
      title: doc.title,
      description: doc.description,
      subtype: 'Vessel',
      isMandatory: doc.isMandatory,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending',
    }));

    const newSet: AssuranceSet = {
      id: uniqueId,
      title: `Standing Assurance Set - ${vessel.name}`,
      assuranceType: 'Vessel',
      vesselId: vessel.id,
      vesselName: vessel.name,
      imoNumber: vessel.imoNumber,
      initiatorOrg: vessel.registeredOwner || 'Northwind Marine Pty Ltd',
      initiatorRole: 'C Admin · Client Created',
      serviceProviderOrg: vessel.registeredOwner || 'Northwind Marine Pty Ltd',
      charterer: vessel.registeredOwner || 'Northwind Marine Pty Ltd',
      charterWindowStart: '2026-11-01',
      complianceDeadline: '2026-11-01',
      charterWindowEnd: '2027-11-01',
      stage: 'Initiated',
      readinessScore: 10,
      verificationRequired: true,
      mandatoryInspectionRequired: false,
      formalApprovalRequired: true,
      inspectionCompleted: false,
      requirements,
      createdByPersona: 'Administrator',
    };

    store.addAssuranceSet(newSet);

    const savedSet = useMapStore.getState().assuranceSets.find((s) => s.id === uniqueId);
    expect(savedSet).toBeDefined();

    // 1. Reused slot: Certificate of Class (has valid verified document on file)
    const classSlot = savedSet?.requirements.find((r) => r.docTypeId === 'vessel-class-cert');
    expect(classSlot).toBeDefined();
    expect(classSlot?.documentId).toBeDefined();
    expect(classSlot?.reusedDocument).toBe(true);
    expect(classSlot?.isFulfilled).toBe(true);
    expect(classSlot?.verifierStatus).toBe('Verified');

    // 2. Expired slot: Load Line Certificate (MAP-VES-2026-STAT-00014 is expired)
    const loadLineSlot = savedSet?.requirements.find((r) => r.docTypeId === 'vessel-loadline-cert');
    expect(loadLineSlot).toBeDefined();
    expect(loadLineSlot?.documentId).toBeUndefined();
    expect(loadLineSlot?.reusedDocument).toBeFalsy();
    expect(loadLineSlot?.isFulfilled).toBe(false);

    // 3. Readiness score increased beyond initiated baseline (10%)
    expect(savedSet?.readinessScore).toBeGreaterThan(10);

    // 4. Audit trail logged "Auto-attached existing document" for reused slots
    const updatedAuditEvents = useMapStore.getState().auditEvents;
    const autoAttachAudits = updatedAuditEvents.filter(
      (e) => e.action === 'Auto-attached existing document' && e.targetAsset.startsWith(uniqueId)
    );

    const reusedCount = savedSet?.requirements.filter((r) => r.reusedDocument).length || 0;
    expect(reusedCount).toBeGreaterThan(0);
    expect(autoAttachAudits.length).toBe(reusedCount);

    const classAudit = autoAttachAudits.find((e) => e.targetAsset.includes(classSlot!.title));
    expect(classAudit).toBeDefined();
    expect(classAudit?.justificationNotes).toContain(classSlot?.documentId);
    expect(classAudit?.justificationNotes).toContain(savedSet?.id);
  });
});
