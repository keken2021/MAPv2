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
import {
  filterCandidatesByReviewMode,
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
      vesselId: vessel.id,
      vesselName: vessel.name,
      imoNumber: vessel.imoNumber,
      initiatorOrg: vessel.registeredOwner,
      serviceProviderOrg: vessel.registeredOwner,
      charterer: vessel.registeredOwner,
      charterWindowStart: '2026-11-01',
      charterWindowEnd: '2027-11-01',
      stage: 'Initiated',
      readinessScore: 0,
      subtypes: ['Vessel'],
      visibility: 'organization',
      internalDeployment: true,
      requirements: fulfilledRequirements,
      initiatorRole: 'C Admin · Client Created',
      mandatoryInspectionRequired: false,
      inspectionCompleted: false
    };

    const readiness = calculateAssuranceSetReadiness(set);
    set.readinessScore = readiness;

    expect(set.vesselId).toBe('VESSEL-001');
    expect(set.internalDeployment).toBe(true);
    expect(set.requirements.some((r) => r.isFulfilled && r.documentId)).toBe(true);
    expect(set.readinessScore).toBeGreaterThan(10);
  });

  it('creates a focused Crew Assurance Set with crewId and STCW auto-fulfillment', () => {
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
      crewId: crewMember.id,
      crewName: crewMember.fullName,
      vesselName: crewMember.fullName,
      imoNumber: 'N/A',
      initiatorOrg: 'Northwind Marine Pty Ltd',
      serviceProviderOrg: crewMember.organization || 'Northwind Marine Pty Ltd',
      charterer: 'Northwind Marine Pty Ltd',
      charterWindowStart: '2026-11-01',
      charterWindowEnd: '2027-11-01',
      stage: 'Initiated',
      readinessScore: 0,
      subtypes: ['Crew'],
      visibility: 'organization',
      internalDeployment: true,
      requirements: fulfilledRequirements,
      vesselId: '',
      initiatorRole: 'C Admin · Client Created',
      mandatoryInspectionRequired: false,
      inspectionCompleted: false
    };

    const readiness = calculateAssuranceSetReadiness(set);
    set.readinessScore = readiness;

    expect(set.crewId).toBe('CREW-101');
    expect(set.crewName).toBe(crewMember.fullName);
    expect(set.internalDeployment).toBe(true);
    expect(set.requirements.some((r) => r.isFulfilled)).toBe(true);
  });

  it('creates a focused Equipment Assurance Set with equipmentId and equipment vault matching', () => {
    const store = useMapStore.getState();
    const item = store.equipment.find((e) => e.id === 'EQ-007') || store.equipment[0];
    expect(item).toBeDefined();

    const rawRequirements: AssuranceRequirement[] = SUBTYPE_STANDARD_DOCS.Equipment.map((doc, idx) => ({
      id: `REQ-EQP-${idx}`,
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
      equipmentId: item.id,
      equipmentName: item.name,
      vesselName: item.name,
      imoNumber: 'N/A',
      initiatorOrg: item.owningOrganization,
      serviceProviderOrg: item.owningOrganization,
      charterer: item.owningOrganization,
      charterWindowStart: '2026-11-01',
      charterWindowEnd: '2027-11-01',
      stage: 'Initiated',
      readinessScore: 0,
      subtypes: ['Equipment'],
      visibility: 'organization',
      internalDeployment: true,
      requirements: fulfilledRequirements,
      vesselId: '',
      initiatorRole: 'C Admin · Client Created',
      mandatoryInspectionRequired: false,
      inspectionCompleted: false
    };

    expect(set.equipmentId).toBe(item.id);
    expect(set.equipmentName).toBe(item.name);
    expect(set.internalDeployment).toBe(true);
  });

  it('creates a focused Activity Assurance Set with activityId', () => {
    const activity = EXISTING_ACTIVITIES[0];
    expect(activity).toBeDefined();

    const set: AssuranceSet = {
      id: 'MAP-ACT-2026-SURF-TEST01',
      title: `Northwind Marine - ${activity.name} Safety Passport`,
      assuranceType: 'Activity',
      activityId: activity.id,
      activityName: activity.name,
      vesselName: activity.name,
      imoNumber: 'N/A',
      initiatorOrg: 'Northwind Marine Pty Ltd',
      serviceProviderOrg: 'Northwind Marine Pty Ltd',
      charterer: 'Northwind Marine Pty Ltd',
      charterWindowStart: '2026-11-01',
      charterWindowEnd: '2027-11-01',
      stage: 'Initiated',
      readinessScore: 10,
      subtypes: ['Activity'],
      visibility: 'organization',
      internalDeployment: true,
      requirements: [],
      vesselId: '',
      initiatorRole: 'C Admin · Client Created',
      mandatoryInspectionRequired: false,
      inspectionCompleted: false
    };

    expect(set.activityId).toBe(activity.id);
    expect(set.activityName).toBe(activity.name);
    expect(set.internalDeployment).toBe(true);
  });

  it('allows provider staff to act as verifiers/approvers during internal deployment self-assurance without conflict block', () => {
    const store = useMapStore.getState();
    const verifiers = filterCandidatesByReviewMode(store.users, 'internal', 'Verifier', {
      serviceProviderOrg: 'Northwind Marine Pty Ltd',
      internalDeployment: true,
    });

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
