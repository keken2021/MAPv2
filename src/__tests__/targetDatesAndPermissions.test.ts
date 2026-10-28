/*
  file summary: unit tests for target dates on assurance sets and tasks, short-term date permissions, and date change history.
  responsibilities: tests target date boundary validation, short-term permission expiration, role access, and change history ledger in useMapStore.
  role in system: validates compliance with BRD V4.2 and prototype task 5195 requirements during vitest runs.
*/

import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateTaskTargetDate,
  validateAllTaskTargetDates,
  isDatePermissionActive,
  TASK_DATE_AFTER_SET_DATE,
  TASK_DATE_BEFORE_START,
} from '../utils/validation';
import {
  isClientUser,
  getUserActiveDatePermission,
  canUserChangeAssuranceDates,
  getAssuranceSetRoleActions,
} from '../utils/rbacHelpers';
import { useMapStore } from '../store/useMapStore';
import { MOCK_ASSURANCE_SETS } from '../store/mockData';
import { AssuranceSet, AssuranceRequirement } from '../types/assurance';
import { UserProfile } from '../types/user';

describe('Target Dates and Date Permission Validation', () => {
  const baseSet: AssuranceSet = {
    ...MOCK_ASSURANCE_SETS[0],
    id: 'AS-TEST-001',
    title: 'Test Assurance Campaign',
    vesselId: 'VESSEL-001',
    vesselName: 'Pacific Valour',
    serviceProviderOrg: 'Northwind Marine Pty Ltd',
    clientOrg: 'Chevron Australia Pty Ltd',
    charterer: 'Chevron Australia Pty Ltd',
    charterWindowStart: '2026-11-01',
    charterWindowEnd: '2027-04-30',
    targetDate: '2026-11-01',
    complianceDeadline: '2026-11-01',
    stage: 'Verification',
    readinessScore: 80,
    requirements: [
      {
        id: 'REQ-001-01',
        title: 'Dynamic Positioning Verification',
        targetDate: '2026-10-15',
        category: 'Statutory Certification',
        isMandatory: true,
        verifierStatus: 'Verified',
        isFulfilled: true,
        ocrConfidence: 95,
      },
      {
        id: 'REQ-001-02',
        title: 'Safety Equipment Certificate',
        targetDate: '2026-11-01',
        category: 'Safety Management',
        isMandatory: true,
        verifierStatus: 'Pending',
        isFulfilled: false,
        ocrConfidence: 0,
      },
    ],
    datePermissionGrants: [
      {
        id: 'DPG-001',
        userId: 'USR-CLIENT-01',
        userName: 'Sarah Jenkins',
        grantedBy: 'USR-ADMIN-01',
        grantedAt: '2026-10-25T08:00:00Z',
        expiresAt: '2026-10-29T18:00:00Z',
        reason: 'Pre-mobilization schedule adjustment',
      },
    ],
    targetDateHistory: [
      {
        id: 'TDH-001',
        setId: 'AS-TEST-001',
        scope: 'set',
        targetType: 'set',
        oldDate: '2026-10-25',
        newDate: '2026-11-01',
        changedBy: 'Sarah Jenkins',
        changedAt: '2026-10-25T08:30:00Z',
        reason: 'Vessel dry-dock delay',
      },
    ],
  };

  const clientUser: UserProfile = {
    id: 'USR-CLIENT-01',
    name: 'Sarah Jenkins',
    email: 'sarah.jenkins@chevron.test',
    organization: 'Chevron Australia Pty Ltd',
    roles: ['C Admin'],
    userType: 'Organization',
    departmentOrScope: 'Assurance Operations',
    status: 'Active',
    lastActive: '2026-10-28',
  };

  const otherClientUser: UserProfile = {
    id: 'USR-CLIENT-02',
    name: 'David Wong',
    email: 'david.wong@chevron.test',
    organization: 'Chevron Australia Pty Ltd',
    roles: ['C Admin'],
    userType: 'Organization',
    departmentOrScope: 'Assurance Operations',
    status: 'Active',
    lastActive: '2026-10-28',
  };

  const providerUser: UserProfile = {
    id: 'USR-PROVIDER-01',
    name: 'Frank Miller',
    email: 'frank.miller@northwind.test',
    organization: 'Northwind Marine Pty Ltd',
    roles: ['Administrator'],
    userType: 'Organization',
    departmentOrScope: 'Fleet Operations',
    status: 'Active',
    lastActive: '2026-10-28',
  };

  /**
    what: tests task target date boundary validation against set target date.
    how: rejects task dates after set date and accepts dates on or prior to set target date.
    with what file: src/__tests__/targetDatesAndPermissions.test.ts testing src/utils/validation.ts.
  */
  it('rejects a task target date that is strictly after the assurance set target date', () => {
    const setTargetDate = '2026-11-01';
    const taskDateAfter = '2026-11-02';
    const taskDateEqual = '2026-11-01';
    const taskDateBefore = '2026-10-20';

    expect(validateTaskTargetDate(taskDateAfter, setTargetDate)).toBe(TASK_DATE_AFTER_SET_DATE);
    expect(validateTaskTargetDate(taskDateEqual, setTargetDate)).toBeUndefined();
    expect(validateTaskTargetDate(taskDateBefore, setTargetDate)).toBeUndefined();
  });

  /**
    what: tests task target date boundary check against charter start date when provided.
    how: rejects dates before charter start date if contract start boundary is provided.
    with what file: src/__tests__/targetDatesAndPermissions.test.ts testing src/utils/validation.ts.
  */
  it('rejects task target dates before charter start date when charter start is specified', () => {
    const setTargetDate = '2026-11-30';
    const charterStart = '2026-11-01';
    const taskDateBeforeStart = '2026-10-31';
    const taskDateValid = '2026-11-15';

    expect(validateTaskTargetDate(taskDateBeforeStart, setTargetDate, charterStart)).toBe(TASK_DATE_BEFORE_START);
    expect(validateTaskTargetDate(taskDateValid, setTargetDate, charterStart)).toBeUndefined();
  });

  /**
    what: tests bulk validation across all requirements of an assurance set.
    how: identifies all requirements with target dates past the set target date.
    with what file: src/__tests__/targetDatesAndPermissions.test.ts testing src/utils/validation.ts.
  */
  it('validates a full array of tasks and identifies offending requirements', () => {
    const tasks: Array<{ id: string; title: string; targetDate?: string }> = [
      { id: 'REQ-1', title: 'Task 1', targetDate: '2026-10-15' },
      { id: 'REQ-2', title: 'Task 2', targetDate: '2026-11-05' },
      { id: 'REQ-3', title: 'Task 3', targetDate: '2026-11-01' },
      { id: 'REQ-4', title: 'Task 4', targetDate: undefined },
    ];
    const errors = validateAllTaskTargetDates(tasks, '2026-11-01');

    expect(errors['REQ-1']).toBeUndefined();
    expect(errors['REQ-2']).toBe(TASK_DATE_AFTER_SET_DATE);
    expect(errors['REQ-3']).toBeUndefined();
    expect(errors['REQ-4']).toBeUndefined();
  });

  /**
    what: tests short-term permission expiration checking.
    how: checks isDatePermissionActive against active vs expired timestamps.
    with what file: src/__tests__/targetDatesAndPermissions.test.ts testing src/utils/validation.ts.
  */
  it('determines if a date permission grant is active or expired', () => {
    const referenceNow = new Date('2026-10-28T12:00:00Z');

    const activeGrant = {
      userId: 'USR-CLIENT-01',
      userName: 'Sarah Jenkins',
      grantedBy: 'USR-ADMIN-01',
      grantedAt: '2026-10-27T08:00:00Z',
      expiresAt: '2026-10-28T18:00:00Z',
    };

    const expiredGrant = {
      userId: 'USR-CLIENT-01',
      userName: 'Sarah Jenkins',
      grantedBy: 'USR-ADMIN-01',
      grantedAt: '2026-10-26T08:00:00Z',
      expiresAt: '2026-10-27T18:00:00Z',
    };

    expect(isDatePermissionActive(activeGrant, referenceNow)).toBe(true);
    expect(isDatePermissionActive(expiredGrant, referenceNow)).toBe(false);
    expect(isDatePermissionActive(undefined, referenceNow)).toBe(false);
    expect(isDatePermissionActive({ expiresAt: 'invalid-date' }, referenceNow)).toBe(false);
  });

  /**
    what: tests client user authorization to change target dates.
    how: requires the user to be a client organization member and have an active grant.
    with what file: src/__tests__/targetDatesAndPermissions.test.ts testing src/utils/rbacHelpers.ts.
  */
  it('allows date modification only for client users holding an active grant', () => {
    const referenceNow = new Date('2026-10-28T12:00:00Z');

    // 1. Client user with active grant is authorized
    expect(isClientUser(clientUser, baseSet)).toBe(true);
    expect(getUserActiveDatePermission(clientUser, baseSet, referenceNow)).toBeDefined();
    expect(canUserChangeAssuranceDates(clientUser, baseSet, 'C Admin', referenceNow)).toBe(true);

    // 2. Client user without grant cannot change dates
    expect(isClientUser(otherClientUser, baseSet)).toBe(true);
    expect(getUserActiveDatePermission(otherClientUser, baseSet, referenceNow)).toBeUndefined();
    expect(canUserChangeAssuranceDates(otherClientUser, baseSet, 'C Admin', referenceNow)).toBe(false);

    // 3. Service provider user cannot change dates even if granted
    expect(isClientUser(providerUser, baseSet)).toBe(false);
    const setWithProviderGrant: AssuranceSet = {
      ...baseSet,
      datePermissionGrants: [
        {
          id: 'DPG-PROVIDER-01',
          userId: providerUser.id,
          userName: providerUser.name,
          grantedBy: 'USR-ADMIN-01',
          grantedAt: '2026-10-27T08:00:00Z',
          expiresAt: '2026-10-29T18:00:00Z',
        },
      ],
    };
    expect(canUserChangeAssuranceDates(providerUser, setWithProviderGrant, 'Administrator', referenceNow)).toBe(false);

    // 4. Client user with expired grant cannot change dates
    const expiredNow = new Date('2026-10-30T00:00:00Z');
    expect(canUserChangeAssuranceDates(clientUser, baseSet, 'C Admin', expiredNow)).toBe(false);
  });

  /**
    what: verifies getAssuranceSetRoleActions accurately returns canChangeDates flag.
    how: passes active grant vs ungranted user to getAssuranceSetRoleActions.
    with what file: src/__tests__/targetDatesAndPermissions.test.ts testing src/utils/rbacHelpers.ts.
  */
  it('computes canChangeDates flag in getAssuranceSetRoleActions', () => {
    const referenceNow = new Date('2026-10-28T12:00:00Z');

    const authorizedActions = getAssuranceSetRoleActions(
      baseSet,
      'C Admin',
      'Chevron Australia Pty Ltd',
      clientUser,
    );
    expect(authorizedActions.canChangeDates).toBe(true);

    const unauthorizedActions = getAssuranceSetRoleActions(
      baseSet,
      'C Admin',
      'Chevron Australia Pty Ltd',
      otherClientUser,
    );
    expect(unauthorizedActions.canChangeDates).toBe(false);
  });
});

describe('Map Store Date Permissions and Target Date History Ledger', () => {
  beforeEach(() => {
    const existing = useMapStore.getState().assuranceSets[0];
    const testSet: AssuranceSet = {
      ...existing,
      id: 'AS-STORE-001',
      title: 'Store Test Campaign',
      targetDate: '2026-11-01',
      complianceDeadline: '2026-11-01',
      requirements: [
        {
          ...existing.requirements[0],
          id: 'REQ-STORE-01',
          title: 'Rig Move Plan Review',
          targetDate: '2026-10-20',
        },
      ],
      datePermissionGrants: [],
      targetDateHistory: [],
    };
    useMapStore.setState({
      assuranceSets: [testSet],
    });
  });

  /**
    what: tests granting and revoking short-term date permissions in the store.
    how: executes grantDatePermission and revokeDatePermission, checking the set grant list.
    with what file: src/__tests__/targetDatesAndPermissions.test.ts testing src/store/useMapStore.ts.
  */
  it('grants and revokes short-term date permissions for named client users', () => {
    const store = useMapStore.getState();

    // Grant permission for 24 hours
    store.grantDatePermission('AS-STORE-001', {
      userId: 'USR-CLIENT-02',
      userName: 'David Wong',
      grantedBy: 'Sarah Jenkins',
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      reason: 'Urgent task date alignment',
    });

    let currentSet = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-STORE-001');
    expect(currentSet?.datePermissionGrants).toHaveLength(1);
    expect(currentSet?.datePermissionGrants?.[0].userName).toBe('David Wong');
    expect(currentSet?.datePermissionGrants?.[0].reason).toBe('Urgent task date alignment');

    // Revoke permission
    useMapStore.getState().revokeDatePermission('AS-STORE-001', 'USR-CLIENT-02');

    currentSet = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-STORE-001');
    expect(currentSet?.datePermissionGrants).toHaveLength(0);
  });

  /**
    what: tests updating a task target date and ledger generation in targetDateHistory.
    how: calls updateTaskTargetDate and asserts that requirement targetDate is updated and exactly one history row is added.
    with what file: src/__tests__/targetDatesAndPermissions.test.ts testing src/store/useMapStore.ts.
  */
  it('updates task target date and records exactly one entry in the history ledger', () => {
    const store = useMapStore.getState();

    store.updateTaskTargetDate(
      'AS-STORE-001',
      'REQ-STORE-01',
      '2026-10-28',
      'Sarah Jenkins',
      'Subcontractor readiness confirmed',
    );

    const currentSet = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-STORE-001');
    const req = currentSet?.requirements.find((r) => r.id === 'REQ-STORE-01');
    expect(req?.targetDate).toBe('2026-10-28');

    // Exactly one history row recorded
    expect(currentSet?.targetDateHistory).toHaveLength(1);
    const historyEntry = currentSet?.targetDateHistory?.[0];
    expect(historyEntry).toMatchObject({
      targetType: 'task',
      requirementId: 'REQ-STORE-01',
      oldDate: '2026-10-20',
      newDate: '2026-10-28',
      changedBy: 'Sarah Jenkins',
      reason: 'Subcontractor readiness confirmed',
    });
    expect(historyEntry?.changedAt).toBeDefined();
  });

  /**
    what: tests updating set target date via updateAssuranceSet records a set history row.
    how: updates set targetDate and asserts history ledger captures the old date, new date, and who.
    with what file: src/__tests__/targetDatesAndPermissions.test.ts testing src/store/useMapStore.ts.
  */
  it('records a history row when set target date is changed via updateAssuranceSet', () => {
    const store = useMapStore.getState();

    const initialSet = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-STORE-001')!;
    store.updateAssuranceSet({
      ...initialSet,
      targetDate: '2026-11-15',
    });

    const currentSet = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-STORE-001');
    expect(currentSet?.targetDate).toBe('2026-11-15');

    expect(currentSet?.targetDateHistory).toHaveLength(1);
    const historyEntry = currentSet?.targetDateHistory?.[0];
    expect(historyEntry?.targetType).toBe('set');
    expect(historyEntry?.oldDate).toBe('2026-11-01');
    expect(historyEntry?.newDate).toBe('2026-11-15');
  });
});
