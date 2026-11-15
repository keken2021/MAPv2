/* 
  file summary: unit tests for asset-level assurance set creation across Vessel, Crew, Equipment, and Activity scopes.
  responsibilities: verifies direct asset ID persistence, internal deployment flag, vault auto-fulfillment, and conflict handling during self-assurance.
  role in system: executed during vitest test suite runs.
*/

import { describe, it, expect, beforeEach } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet, AssuranceRequirement } from '../types/assurance';
import { SUBTYPE_STANDARD_DOCS, EXISTING_ACTIVITIES } from '../utils/assuranceTemplates';
import { autoAttachDocumentsToRequirements } from '../utils/documentMatchingHelpers';
import { calculateAssuranceSetReadiness } from '../utils/readinessHelpers';
import { isInternalDeployment } from '../utils/setParties';
import {
  getSetVesselId,
  getSetCrewIds,
  getSetCrewNames,
  getSetEquipmentId,
  getSetEquipmentName,
} from '../utils/setObjects';
import {
  getOrganizationRoleCandidates,
  hasBlockingAssuranceAssignmentConflict,
} from '../utils/userRoleHelpers';

describe('Asset-Level Assurance Set Creation (Non-Project Scopes)', () => {
  beforeEach(() => {
    useMapStore.getState().setActivePersona('Administrator');
  });

  it('creates a focused Vessel Assurance Set with vesselId, internalDeployment, and auto-attached vault certificates', () => {
    const store = useMapStore.getState();
    const vessel = store.vessels.find((v) => v.id === 'VESSEL-001') || store.vessels[0];
    expect(vessel).toBeDefined();

    const rawRequirements: AssuranceRequirement[] = SUBTYPE_STANDARD_DOCS.Vessel.map((doc, idx) => ({
      id: `REQ-VES-${idx}`,
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

    const fulfilledRequirements = autoAttachDocumentsToRequirements(rawRequirements, {
      documents: store.documents,
      vessel,
      vessels: store.vessels,
      selectedVesselId: vessel.id,
      targetSubtype: 'Vessel',
    });

    const set: AssuranceSet = {
      id: 'MAP-VES-2026-STAT-TEST01',
      title: `Northwind Marine - ${vessel.name} Standing Passport`,
      assuranceType: 'Vessel',
      parties: [
        { organization: vessel.registeredOwner, role: 'Requesting party' },
        { organization: vessel.registeredOwner, role: 'Responding party' },
      ],
      assuranceObjects: [
        {
          id: vessel.id,
          type: 'vessel',
          name: vessel.name,
          ownerOrganization: vessel.registeredOwner,
          identifier: vessel.imoNumber,
        },
      ],
      startDate: '2026-11-01',
      endDate: '2027-11-01',
      deadline: '2026-11-01',
      stage: 'Initiated',
      readinessScore: 0,
      subtypes: ['Vessel'],
      visibility: 'organization',
      requirements: fulfilledRequirements,
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
    };

    const readiness = calculateAssuranceSetReadiness(set);
    set.readinessScore = readiness;

    expect(getSetVesselId(set)).toBe('VESSEL-001');
    expect(isInternalDeployment(set)).toBe(true);
    expect(set.requirements.some((r) => r.documentId && r.verifierStatus === 'Verified' && r.isFulfilled)).toBe(true);
    expect(set.requirements.some((r) => !r.isFulfilled)).toBe(true);
    expect(set.readinessScore).toBeGreaterThan(10);
  });

  it('creates a focused Crew Assurance Set with crewId and STCW auto-fulfillment', () => {
    const store = useMapStore.getState();
    const crewMember = store.crew.find((c) => c.id === 'CREW-101') || store.crew[0];
    expect(crewMember).toBeDefined();

    const rawRequirements: AssuranceRequirement[] = SUBTYPE_STANDARD_DOCS.Crew.map((doc, idx) => ({
      id: `REQ-CRW-${idx}`,
      docTypeId: doc.id,
      category: doc.category,
      title: doc.title,
      description: doc.description,
      subtype: 'Crew',
      isMandatory: doc.isMandatory,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending',
    }));

    const fulfilledRequirements = autoAttachDocumentsToRequirements(rawRequirements, {
      documents: store.documents,
      crew: store.crew,
      selectedCrewId: crewMember.id,
      targetSubtype: 'Crew',
    });

    const set: AssuranceSet = {
      id: 'MAP-CRW-2026-STCW-TEST01',
      title: `Northwind Marine - ${crewMember.fullName} Qualification Passport`,
      assuranceType: 'Crew',
      parties: [
        { organization: 'Northwind Marine Pty Ltd', role: 'Requesting party' },
        { organization: crewMember.organization || 'Northwind Marine Pty Ltd', role: 'Responding party' },
      ],
      assuranceObjects: [
        {
          id: crewMember.id,
          type: 'crew',
          name: crewMember.fullName,
          ownerOrganization: crewMember.organization || 'Northwind Marine Pty Ltd',
        },
      ],
      startDate: '2026-11-01',
      endDate: '2027-11-01',
      deadline: '2026-11-01',
      stage: 'Initiated',
      readinessScore: 0,
      subtypes: ['Crew'],
      visibility: 'organization',
      requirements: fulfilledRequirements,
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
    };

    const readiness = calculateAssuranceSetReadiness(set);
    set.readinessScore = readiness;

    expect(getSetCrewIds(set)).toContain('CREW-101');
    expect(getSetCrewNames(set)).toContain(crewMember.fullName);
    expect(isInternalDeployment(set)).toBe(true);
    expect(set.requirements.some((r) => r.documentId || r.linkedDocumentId)).toBe(true);
    expect(set.requirements.some((r) => r.isFulfilled && r.verifierStatus === 'Verified')).toBe(true);
    expect(set.requirements.some((r) => !r.isFulfilled)).toBe(true);
  });

  it('creates a focused Equipment Assurance Set with equipmentId and equipment vault matching', () => {
    const store = useMapStore.getState();
    const item = store.equipment.find((e) => e.id === 'EQ-007') || store.equipment[0];
    expect(item).toBeDefined();

    const rawRequirements: AssuranceRequirement[] = SUBTYPE_STANDARD_DOCS.Equipment.map((doc, idx) => ({
      id: `REQ-EQP-${idx}`,
      docTypeId: doc.id,
      category: doc.category,
      title: doc.title,
      description: doc.description,
      subtype: 'Equipment',
      isMandatory: doc.isMandatory,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending',
    }));

    const fulfilledRequirements = autoAttachDocumentsToRequirements(rawRequirements, {
      documents: store.documents,
      equipment: store.equipment,
      selectedEquipmentId: item.id,
      targetSubtype: 'Equipment',
    });

    const set: AssuranceSet = {
      id: 'MAP-EQP-2026-LIFT-TEST01',
      title: `Northwind Marine - ${item.name} Technical Passport`,
      assuranceType: 'Equipment',
      parties: [
        { organization: item.owningOrganization, role: 'Requesting party' },
        { organization: item.owningOrganization, role: 'Responding party' },
      ],
      assuranceObjects: [
        {
          id: item.id,
          type: 'equipment',
          name: item.name,
          ownerOrganization: item.owningOrganization,
        },
      ],
      startDate: '2026-11-01',
      endDate: '2027-11-01',
      deadline: '2026-11-01',
      stage: 'Initiated',
      readinessScore: 0,
      subtypes: ['Equipment'],
      visibility: 'organization',
      requirements: fulfilledRequirements,
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
    };

    expect(getSetEquipmentId(set)).toBe(item.id);
    expect(getSetEquipmentName(set)).toBe(item.name);
    expect(isInternalDeployment(set)).toBe(true);
  });



  it('allows provider staff to act as verifiers/approvers during internal deployment self-assurance without conflict block', () => {
    const store = useMapStore.getState();
    const verifiers = getOrganizationRoleCandidates(store.users, 'Northwind Marine Pty Ltd', 'Verifier');

    expect(verifiers.length).toBeGreaterThan(0);

    const hasConflict = hasBlockingAssuranceAssignmentConflict({
      verifierId: verifiers[0]?.id,
      approverId: verifiers[0]?.id,
      serviceProviderOrg: 'Northwind Marine Pty Ltd',
      internalDeployment: true,
      users: store.users,
    });

    expect(hasConflict).toBe(false);
  });
});
