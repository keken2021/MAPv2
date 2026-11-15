/* 
  file summary: end-to-end integration tests verifying automatic document reuse across all object types (Vessel, Crew, and Equipment).
  responsibilities: verifies that addAssuranceSet fulfills matching valid tagged documents, leaves expired and pending documents unfulfilled, increases readiness score above baseline, and logs audit events.
  role in system: executed during vitest test runs for Task 8 / story 5483.
*/

import { describe, it, expect, beforeEach } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet, AssuranceRequirement } from '../types/assurance';
import { SUBTYPE_STANDARD_DOCS } from '../utils/assuranceTemplates';
import { generateUniqueAssuranceSetId, generateUniqueRequirementId } from '../utils/validation';

const initialState = useMapStore.getState();

describe('End-to-End Document Reuse across All Object Types (Vessel, Crew, Equipment)', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
    useMapStore.getState().setActivePersona('Administrator');
  });

  it('reuses valid statutory certificates on Vessel assurance sets, excluding expired and pending certificates', () => {
    const store = useMapStore.getState();
    const vessel = store.vessels.find((v) => v.id === 'VESSEL-001') || store.vessels[0];
    const uniqueId = generateUniqueAssuranceSetId(store.assuranceSets);

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

    const vesselSet: AssuranceSet = {
      id: uniqueId,
      title: `Standing Assurance Set - ${vessel.name}`,
      assuranceType: 'Vessel',
      assuranceObjects: [
        {
          id: vessel.id,
          type: 'vessel',
          name: vessel.name,
          identifier: vessel.imoNumber,
          ownerOrganization: vessel.registeredOwner || 'Northwind Marine Pty Ltd',
        },
      ],
      parties: [
        { organization: vessel.registeredOwner || 'Northwind Marine Pty Ltd', role: 'Requesting party' },
        { organization: vessel.registeredOwner || 'Northwind Marine Pty Ltd', role: 'Responding party' },
      ],
      startDate: '2026-11-01',
      deadline: '2026-11-01',
      endDate: '2027-11-01',
      dateHistory: [],
      createdBy: { userId: 'USR-101', name: 'User', persona: 'Administrator' },
      stage: 'Initiated',
      readinessScore: 10,
      verificationRequired: true,
      mandatoryInspectionRequired: false,
      formalApprovalRequired: true,
      inspectionCompleted: false,
      requirements,
    };

    store.addAssuranceSet(vesselSet);

    const savedSet = useMapStore.getState().assuranceSets.find((s) => s.id === uniqueId);
    expect(savedSet).toBeDefined();

    // 1. Valid certificate of class is reused and fulfilled
    const classSlot = savedSet?.requirements.find((r) => r.docTypeId === 'vessel-class-cert');
    expect(classSlot).toBeDefined();
    expect(classSlot?.documentId).toBeDefined();
    expect(classSlot?.reusedDocument).toBe(true);
    expect(classSlot?.isFulfilled).toBe(true);
    expect(classSlot?.verifierStatus).toBe('Verified');

    // 2. Expired load line certificate (MAP-VES-2026-STAT-00014) is not reused
    const loadLineSlot = savedSet?.requirements.find((r) => r.docTypeId === 'vessel-loadline-cert');
    expect(loadLineSlot).toBeDefined();
    expect(loadLineSlot?.documentId).toBeUndefined();
    expect(loadLineSlot?.reusedDocument).toBeFalsy();
    expect(loadLineSlot?.isFulfilled).toBe(false);

    // 3. Pending MLC certificate (MAP-VES-2026-STAT-00015) is not reused
    const mlcSlot = savedSet?.requirements.find((r) => r.docTypeId === 'vessel-mlc-cert');
    expect(mlcSlot).toBeDefined();
    expect(mlcSlot?.documentId).toBeUndefined();
    expect(mlcSlot?.reusedDocument).toBeFalsy();
    expect(mlcSlot?.isFulfilled).toBe(false);

    // 4. Readiness score is above initiated baseline (10%)
    expect(savedSet?.readinessScore).toBeGreaterThan(10);

    // 5. Audit event logged
    const audits = useMapStore.getState().auditEvents.filter(
      (e) => e.action === 'Auto-attached existing document' && e.targetAsset.startsWith(uniqueId)
    );
    expect(audits.length).toBeGreaterThan(0);
  });

  it('reuses valid STCW certificates on Crew assurance sets, excluding pending certificates', () => {
    const store = useMapStore.getState();
    const crewMember = store.crew.find((c) => c.id === 'CREW-104') || store.crew[0];
    const uniqueId = generateUniqueAssuranceSetId(store.assuranceSets);

    const requirements: AssuranceRequirement[] = SUBTYPE_STANDARD_DOCS.Crew.map((doc, idx) => ({
      id: generateUniqueRequirementId(uniqueId, idx),
      docTypeId: doc.id,
      category: doc.category,
      title: doc.title,
      description: doc.description,
      subtype: 'Crew',
      targetObjectId: crewMember.id,
      isMandatory: doc.isMandatory,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending',
    }));

    const crewSet: AssuranceSet = {
      id: uniqueId,
      title: `Qualification Passport - ${crewMember.fullName}`,
      assuranceType: 'Crew',
      assuranceObjects: [
        {
          id: crewMember.id,
          type: 'crew',
          name: crewMember.fullName,
          ownerOrganization: crewMember.organization || 'Northwind Marine Pty Ltd',
        },
      ],
      parties: [
        { organization: 'Northwind Marine Pty Ltd', role: 'Requesting party' },
        { organization: crewMember.organization || 'Northwind Marine Pty Ltd', role: 'Responding party' },
      ],
      startDate: '2026-11-01',
      deadline: '2026-11-01',
      endDate: '2027-11-01',
      dateHistory: [],
      createdBy: { userId: 'USR-101', name: 'User', persona: 'Administrator' },
      stage: 'Initiated',
      readinessScore: 10,
      verificationRequired: true,
      mandatoryInspectionRequired: false,
      formalApprovalRequired: true,
      inspectionCompleted: false,
      requirements,
    };

    store.addAssuranceSet(crewSet);

    const savedSet = useMapStore.getState().assuranceSets.find((s) => s.id === uniqueId);
    expect(savedSet).toBeDefined();

    // 1. Valid BOSIET training certificate is reused and fulfilled
    const bosietSlot = savedSet?.requirements.find((r) => r.docTypeId === 'crew-bosiet-training');
    expect(bosietSlot).toBeDefined();
    expect(bosietSlot?.documentId).toBeDefined();
    expect(bosietSlot?.reusedDocument).toBe(true);
    expect(bosietSlot?.isFulfilled).toBe(true);
    expect(bosietSlot?.verifierStatus).toBe('Verified');

    // 2. Pending ENG1 medical certificate (MAP-CRW-2026-MEDC-00404) is NOT reused
    const medicalSlot = savedSet?.requirements.find((r) => r.docTypeId === 'crew-eng1-medical');
    expect(medicalSlot).toBeDefined();
    expect(medicalSlot?.documentId).toBeUndefined();
    expect(medicalSlot?.reusedDocument).toBeFalsy();
    expect(medicalSlot?.isFulfilled).toBe(false);

    // 3. Readiness score is above initiated baseline (10%)
    expect(savedSet?.readinessScore).toBeGreaterThan(10);

    // 4. Audit events logged
    const audits = useMapStore.getState().auditEvents.filter(
      (e) => e.action === 'Auto-attached existing document' && e.targetAsset.startsWith(uniqueId)
    );
    expect(audits.length).toBeGreaterThan(0);
  });

  it('reuses valid equipment certificates on Equipment assurance sets, excluding expired certificates', () => {
    const store = useMapStore.getState();
    const itemValid = store.equipment.find((e) => e.id === 'EQ-005') || store.equipment[0];
    const uniqueIdValid = generateUniqueAssuranceSetId(store.assuranceSets);

    const validRequirements: AssuranceRequirement[] = SUBTYPE_STANDARD_DOCS.Equipment.map((doc, idx) => ({
      id: generateUniqueRequirementId(uniqueIdValid, idx),
      docTypeId: doc.id,
      category: doc.category,
      title: doc.title,
      description: doc.description,
      subtype: 'Equipment',
      targetObjectId: itemValid.id,
      isMandatory: doc.isMandatory,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending',
    }));

    const validEquipmentSet: AssuranceSet = {
      id: uniqueIdValid,
      title: `Technical Passport - ${itemValid.name}`,
      assuranceType: 'Equipment',
      assuranceObjects: [
        {
          id: itemValid.id,
          type: 'equipment',
          name: itemValid.name,
          ownerOrganization: itemValid.owningOrganization,
        },
      ],
      parties: [
        { organization: itemValid.owningOrganization, role: 'Requesting party' },
        { organization: itemValid.owningOrganization, role: 'Responding party' },
      ],
      startDate: '2026-11-01',
      deadline: '2026-11-01',
      endDate: '2027-11-01',
      dateHistory: [],
      createdBy: { userId: 'USR-101', name: 'User', persona: 'Administrator' },
      stage: 'Initiated',
      readinessScore: 10,
      verificationRequired: true,
      mandatoryInspectionRequired: false,
      formalApprovalRequired: true,
      inspectionCompleted: false,
      requirements: validRequirements,
    };

    store.addAssuranceSet(validEquipmentSet);

    const savedValidSet = useMapStore.getState().assuranceSets.find((s) => s.id === uniqueIdValid);
    expect(savedValidSet).toBeDefined();

    // 1. Lifting register certificate (MAP-EQP-2026-LIFT-00301) on EQ-005 is reused
    const liftSlot = savedValidSet?.requirements.find((r) => r.docTypeId === 'eq-lifting-register');
    expect(liftSlot).toBeDefined();
    expect(liftSlot?.documentId).toBe('MAP-EQP-2026-LIFT-00301');
    expect(liftSlot?.reusedDocument).toBe(true);
    expect(liftSlot?.isFulfilled).toBe(true);
    expect(liftSlot?.verifierStatus).toBe('Verified');
    expect(savedValidSet?.readinessScore).toBeGreaterThan(10);

    // 2. Equipment with expired document: EQ-008 Helideck has expired certificate MAP-EQP-2026-HELI-00304
    const itemExpired = store.equipment.find((e) => e.id === 'EQ-008') || store.equipment[1];
    const uniqueIdExpired = `${uniqueIdValid}-EXP`;

    const expiredRequirements: AssuranceRequirement[] = [
      {
        id: generateUniqueRequirementId(uniqueIdExpired, 0),
        docTypeId: 'eq-helideck-cert',
        category: 'Helideck Certification',
        title: 'Helideck Safety and Friction Certificate',
        subtype: 'Equipment',
        targetObjectId: itemExpired.id,
        isMandatory: true,
        isFulfilled: false,
        ocrConfidence: 0,
        verifierStatus: 'Pending',
      },
    ];

    const expiredEquipmentSet: AssuranceSet = {
      id: uniqueIdExpired,
      title: `Technical Passport - ${itemExpired.name}`,
      assuranceType: 'Equipment',
      assuranceObjects: [
        {
          id: itemExpired.id,
          type: 'equipment',
          name: itemExpired.name,
          ownerOrganization: itemExpired.owningOrganization,
        },
      ],
      parties: [
        { organization: itemExpired.owningOrganization, role: 'Requesting party' },
        { organization: itemExpired.owningOrganization, role: 'Responding party' },
      ],
      startDate: '2026-11-01',
      deadline: '2026-11-01',
      endDate: '2027-11-01',
      dateHistory: [],
      createdBy: { userId: 'USR-101', name: 'User', persona: 'Administrator' },
      stage: 'Initiated',
      readinessScore: 10,
      verificationRequired: true,
      mandatoryInspectionRequired: false,
      formalApprovalRequired: true,
      inspectionCompleted: false,
      requirements: expiredRequirements,
    };

    store.addAssuranceSet(expiredEquipmentSet);

    const savedExpiredSet = useMapStore.getState().assuranceSets.find((s) => s.id === uniqueIdExpired);
    expect(savedExpiredSet).toBeDefined();

    // Expired helideck cert is NOT reused
    const heliSlot = savedExpiredSet?.requirements.find((r) => r.docTypeId === 'eq-helideck-cert');
    expect(heliSlot).toBeDefined();
    expect(heliSlot?.documentId).toBeUndefined();
    expect(heliSlot?.reusedDocument).toBeFalsy();
    expect(heliSlot?.isFulfilled).toBe(false);
  });
});
