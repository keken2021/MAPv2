import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { CreateAssuranceSetView } from '../views/CreateAssuranceSetView';
import { clickNext } from './assuranceWizardTestHelpers';
import { AssuranceRequirement } from '../types/assurance';

const initialState = useMapStore.getState();

describe('Assurance Set - One Upload Task Per Party (Task 5305 / 5c-02)', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
    useMapStore.setState({
      isAuthenticated: true,
      activePersona: 'C Admin',
      activeDemoOrganization: 'Chevron Australia Pty Ltd',
      activeSessionUserId: 'USR-CHEV-01',
      users: [
        ...initialState.users,
        {
          id: 'USR-OHL-01',
          name: 'J. Ocean',
          email: 'j.ocean@oceanic.com',
          roles: ['Submitter'],
          userType: 'Organization',
          organization: 'Oceanic Horizon Logistics Pty Ltd',
          departmentOrScope: 'Operations',
          status: 'Active',
          lastActive: '2026-10-29 08:00 UTC',
        },
        {
          id: 'USR-CHEV-01',
          name: 'C. Administrator',
          email: 'admin@chevron.com',
          roles: ['Administrator', 'C Admin'],
          userType: 'Organization',
          organization: 'Chevron Australia Pty Ltd',
          departmentOrScope: 'Operations',
          status: 'Active',
          lastActive: '2026-11-03 08:00 UTC',
        },
      ],
    });
  });

  it('creates one independent upload task per selected party', () => {
    const testSetId = 'AS-TEST-INDEPENDENT-001';
    useMapStore.setState((prev) => ({
      ...prev,
      activePersona: 'C Admin',
      activeDemoOrganization: 'Chevron Australia Pty Ltd',
      activeSessionUserId: 'USR-CHEV-01',
      assuranceSets: [
        ...prev.assuranceSets,
        {
          id: testSetId,
          title: 'Task 5305 Independent Tasks Set',
          stage: 'Initiated',
          initiatorOrg: 'Chevron Australia Pty Ltd',
          initiatorRole: 'C Admin · Client Created',
          createdByUserId: 'USR-CHEV-01',
          createdByName: 'C. Administrator',
          createdByPersona: 'C Admin',
          clientOrg: 'Chevron Australia Pty Ltd',
          charterer: 'Chevron Australia Pty Ltd',
          serviceProviderOrg: 'Oceanic Horizon Logistics Pty Ltd',
          requirements: [],
          mandatoryInspectionRequired: false,
          formalApprovalRequired: true,
          readinessScore: 0,
          assuranceType: 'Vessel',
        } as unknown as import('../types/assurance').AssuranceSet,
      ],
    }));

    const result = useMapStore.getState().addAssuranceTask(testSetId, {
      title: 'Certificate of Class',
      category: 'Statutory Certificate',
      responsibleParties: ['Oceanic Horizon Logistics Pty Ltd', 'Chevron Australia Pty Ltd'],
    });
    expect(result.success).toBe(true);

    const sets = useMapStore.getState().assuranceSets;
    const createdSet = sets.find((s) => s.id === testSetId);
    expect(createdSet).toBeDefined();

    // Find all upload tasks created for Certificate of Class
    const classTasks = (createdSet?.requirements || []).filter((r: AssuranceRequirement) =>
      r.title.includes('Certificate of Class'),
    );

    // Expect exactly TWO independent upload tasks
    expect(classTasks).toHaveLength(2);

    // Both tasks have distinct IDs
    expect(classTasks[0].id).not.toBe(classTasks[1].id);

    // One task is assigned to Oceanic Horizon Logistics, the other to Chevron Australia
    const parties = classTasks.map((t) => t.responsibleParty || t.assignedSubmitter);
    expect(parties).toContain('Oceanic Horizon Logistics Pty Ltd');
    expect(parties).toContain('Chevron Australia Pty Ltd');

    // Both tasks share the same requirement group ID
    expect(classTasks[0].requirementGroupId).toBeDefined();
    expect(classTasks[0].requirementGroupId).toBe(classTasks[1].requirementGroupId);

    // Both tasks start in Pending status and unfulfilled
    expect(classTasks[0].verifierStatus).toBe('Pending');
    expect(classTasks[0].isFulfilled).toBe(false);
    expect(classTasks[1].verifierStatus).toBe('Pending');
    expect(classTasks[1].isFulfilled).toBe(false);
  });

  it('keeps requirement open when one party task is done, and completes only when all are done', () => {
    const setId = 'AS-TEST-COMPLETION-001';
    useMapStore.setState((prev) => ({
      ...prev,
      activePersona: 'C Admin',
      activeDemoOrganization: 'Chevron Australia Pty Ltd',
      activeSessionUserId: 'USR-CHEV-01',
      assuranceSets: [
        ...prev.assuranceSets,
        {
          id: setId,
          title: 'Task 5305 Completion Test Set',
          stage: 'Initiated',
          initiatorOrg: 'Chevron Australia Pty Ltd',
          initiatorRole: 'C Admin · Client Created',
          createdByUserId: 'USR-CHEV-01',
          createdByName: 'C. Administrator',
          createdByPersona: 'C Admin',
          clientOrg: 'Chevron Australia Pty Ltd',
          charterer: 'Chevron Australia Pty Ltd',
          serviceProviderOrg: 'Oceanic Horizon Logistics Pty Ltd',
          requirements: [],
          mandatoryInspectionRequired: false,
          formalApprovalRequired: true,
          readinessScore: 0,
          assuranceType: 'Vessel',
        } as unknown as import('../types/assurance').AssuranceSet,
      ],
    }));

    const result = useMapStore.getState().addAssuranceTask(setId, {
      title: 'Certificate of Class',
      category: 'Statutory Certificate',
      responsibleParties: ['Oceanic Horizon Logistics Pty Ltd', 'Chevron Australia Pty Ltd'],
    });
    expect(result.success).toBe(true);

    const store = useMapStore.getState();
    const createdSet = store.assuranceSets.find((s) => s.id === setId);
    expect(createdSet).toBeDefined();

    const classTasks = createdSet!.requirements.filter((r) =>
      r.title.includes('Certificate of Class'),
    );
    expect(classTasks).toHaveLength(2);

    const task1 = classTasks[0];
    const task2 = classTasks[1];

    // Initial state: both pending, requirement is NOT done
    expect(useMapStore.getState().isRequirementDone(setId, task1.id)).toBe(false);
    expect(useMapStore.getState().isRequirementDone(setId, 'Certificate of Class')).toBe(false);

    let status = useMapStore.getState().getRequirementCompletionStatus(setId, 'Certificate of Class');
    expect(status.totalTasks).toBe(2);
    expect(status.completedTasks).toBe(0);
    expect(status.pendingTasks).toBe(2);
    expect(status.isDone).toBe(false);

    // Complete task 1 only
    useMapStore.getState().updateRequirementStatus(setId, task1.id, 'Verified');

    // Requirement must STAY OPEN because task 2 is still pending
    expect(useMapStore.getState().isRequirementDone(setId, task1.id)).toBe(false);
    expect(useMapStore.getState().isRequirementDone(setId, 'Certificate of Class')).toBe(false);

    status = useMapStore.getState().getRequirementCompletionStatus(setId, 'Certificate of Class');
    expect(status.totalTasks).toBe(2);
    expect(status.completedTasks).toBe(1);
    expect(status.pendingTasks).toBe(1);
    expect(status.isDone).toBe(false);

    // Verify task 1 is verified but task 2 is still pending
    const setAfterFirstVerify = useMapStore.getState().assuranceSets.find((s) => s.id === setId);
    const updatedTask1 = setAfterFirstVerify?.requirements.find((r) => r.id === task1.id);
    const updatedTask2 = setAfterFirstVerify?.requirements.find((r) => r.id === task2.id);
    expect(updatedTask1?.verifierStatus).toBe('Verified');
    expect(updatedTask1?.isFulfilled).toBe(true);
    expect(updatedTask2?.verifierStatus).toBe('Pending');
    expect(updatedTask2?.isFulfilled).toBe(false);

    // Complete task 2
    useMapStore.getState().updateRequirementStatus(setId, task2.id, 'Verified');

    // Now requirement is DONE because both parties completed their upload tasks
    expect(useMapStore.getState().isRequirementDone(setId, task1.id)).toBe(true);
    expect(useMapStore.getState().isRequirementDone(setId, task2.id)).toBe(true);
    expect(useMapStore.getState().isRequirementDone(setId, 'Certificate of Class')).toBe(true);

    status = useMapStore.getState().getRequirementCompletionStatus(setId, 'Certificate of Class');
    expect(status.totalTasks).toBe(2);
    expect(status.completedTasks).toBe(2);
    expect(status.pendingTasks).toBe(0);
    expect(status.isDone).toBe(true);
  });

  it('generates independent upload tasks when addAssuranceTask is called with multiple responsible parties', () => {
    const testSetId = 'AS-TEST-MULTI-PARTY-001';
    useMapStore.setState((prev) => ({
      ...prev,
      activePersona: 'C Admin',
      activeDemoOrganization: 'Chevron Australia Pty Ltd',
      activeSessionUserId: 'USR-CHEV-01',
      assuranceSets: [
        ...prev.assuranceSets,
        {
          id: testSetId,
          title: 'Direct Multi Party Test Set',
          stage: 'Initiated',
          initiatorOrg: 'Chevron Australia Pty Ltd',
          initiatorRole: 'C Admin · Client Created',
          createdByUserId: 'USR-CHEV-01',
          createdByName: 'C. Administrator',
          createdByPersona: 'C Admin',
          clientOrg: 'Chevron Australia Pty Ltd',
          charterer: 'Chevron Australia Pty Ltd',
          serviceProviderOrg: 'Oceanic Horizon Logistics Pty Ltd',
          requirements: [],
          mandatoryInspectionRequired: false,
          formalApprovalRequired: true,
          readinessScore: 0,
          assuranceType: 'Vessel',
        } as unknown as import('../types/assurance').AssuranceSet,
      ],
    }));

    const result = useMapStore.getState().addAssuranceTask(testSetId, {
      title: 'Joint Bunker Safety Inspection Report',
      category: 'Operational',
      responsibleParties: ['Oceanic Horizon Logistics Pty Ltd', 'Chevron Australia Pty Ltd'],
    });

    expect(result.success).toBe(true);

    const updatedSet = useMapStore.getState().assuranceSets.find((s) => s.id === testSetId);
    const bunkerTasks = (updatedSet?.requirements || []).filter((r) =>
      r.title === 'Joint Bunker Safety Inspection Report',
    );

    expect(bunkerTasks).toHaveLength(2);
    expect(bunkerTasks[0].id).not.toBe(bunkerTasks[1].id);
    expect(bunkerTasks[0].responsibleParty).toBe('Oceanic Horizon Logistics Pty Ltd');
    expect(bunkerTasks[1].responsibleParty).toBe('Chevron Australia Pty Ltd');
    expect(bunkerTasks[0].requirementGroupId).toBe(bunkerTasks[1].requirementGroupId);

    // Requirement is open
    expect(useMapStore.getState().isRequirementDone(testSetId, 'Joint Bunker Safety Inspection Report')).toBe(false);

    // Verify first task
    useMapStore.getState().updateRequirementStatus(testSetId, bunkerTasks[0].id, 'Verified');
    expect(useMapStore.getState().isRequirementDone(testSetId, 'Joint Bunker Safety Inspection Report')).toBe(false);

    // Verify second task
    useMapStore.getState().updateRequirementStatus(testSetId, bunkerTasks[1].id, 'Verified');
    expect(useMapStore.getState().isRequirementDone(testSetId, 'Joint Bunker Safety Inspection Report')).toBe(true);
  });
});
