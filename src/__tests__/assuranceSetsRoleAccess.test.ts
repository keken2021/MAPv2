/*
  file summary: tests assurance sets page access and per-set role actions for workflow roles.
  responsibilities: verifies route access for submitter, verifier, inspector and approver, and that role actions apply only on assigned sets.
  role in system: covers isViewAccessibleToPersona and getAssuranceSetRoleActions in src/utils/rbacHelpers.ts.
*/

import { describe, expect, it } from 'vitest';
import {
  ASSURANCE_SETS_READ_ONLY_ROLES,
  canEditAssuranceSetStakeholders,
  getAssuranceSetRoleActions,
  isAssuranceSetAssignedToPersona,
  isAssuranceSetCreatedByCAdmin,
  isViewAccessibleToPersona,
} from '../utils/rbacHelpers';
import { buildBrdRolePermissionDefaults } from '../utils/permissionDefaults';
import { MOCK_ASSURANCE_SETS } from '../store/mockData';
import { AssuranceSet } from '../types/assurance';
import { UserRolePersona } from '../types/audit';

const matrix = buildBrdRolePermissionDefaults();

describe('assurance sets page access for workflow roles', () => {
  it('opens the assurance sets route to all four workflow roles, with and without the matrix', () => {
    ASSURANCE_SETS_READ_ONLY_ROLES.forEach((role) => {
      expect(isViewAccessibleToPersona('assurance-sets', undefined, role)).toBe(true);
      expect(isViewAccessibleToPersona('assurance-sets', undefined, role, matrix)).toBe(true);
    });
  });

  it('keeps the creation wizard closed to all four workflow roles', () => {
    ASSURANCE_SETS_READ_ONLY_ROLES.forEach((role) => {
      expect(isViewAccessibleToPersona('create-assurance-set', undefined, role)).toBe(false);
      expect(isViewAccessibleToPersona('create-assurance-set', undefined, role, matrix)).toBe(false);
    });
  });

  it('opens read-only projects to verifier, inspector and approver', () => {
    (['Verifier', 'Inspector', 'Approver'] as UserRolePersona[]).forEach((role) => {
      expect(isViewAccessibleToPersona('project', undefined, role, matrix)).toBe(true);
    });
  });

  it('allows C Admin to create assurance sets while keeping creation closed to Administrator', () => {
    expect(isViewAccessibleToPersona('assurance-sets', undefined, 'Administrator', matrix)).toBe(true);
    expect(isViewAccessibleToPersona('create-assurance-set', undefined, 'Administrator', matrix)).toBe(false);
    expect(isViewAccessibleToPersona('create-assurance-set', undefined, 'C Admin', matrix)).toBe(true);
    expect(isViewAccessibleToPersona('project', undefined, 'C Admin', matrix)).toBe(true);
  });
});

describe('assurance set role actions', () => {
  const baseSet = MOCK_ASSURANCE_SETS[0];
  const assignedSet: AssuranceSet = {
    ...baseSet,
    initiatorOrg: 'Northwind Marine Pty Ltd',
    assignedSubmitter: 'M. Chen (Northwind Marine Pty Ltd)',
    assignedVerifier: 'A. Fontaine (Southern Basin Energy Pty Ltd)',
    assignedInspector: 'N. Technical (Southern Basin Energy Pty Ltd)',
    assignedApprover: 'P. Nardelli (Southern Basin Energy Pty Ltd)',
    mandatoryInspectionRequired: true,
    stage: 'Approval',
  };
  const unassignedSet: AssuranceSet = {
    ...baseSet,
    initiatorOrg: 'Meridian Marine Services Pty Ltd',
    assignedSubmitter: undefined,
    assignedVerifier: undefined,
    assignedInspector: undefined,
    assignedApprover: undefined,
  };

  it('grants each workflow role only its own action on an assigned set', () => {
    ASSURANCE_SETS_READ_ONLY_ROLES.forEach((role) => {
      expect(isAssuranceSetAssignedToPersona(assignedSet, role)).toBe(true);
    });

    expect(getAssuranceSetRoleActions(assignedSet, 'Submitter')).toEqual({
      canManage: false, canUpload: true, canVerify: false, canInspect: false, canApprove: false,
    });
    expect(getAssuranceSetRoleActions(assignedSet, 'Verifier')).toEqual({
      canManage: false, canUpload: false, canVerify: true, canInspect: false, canApprove: false,
    });
    expect(getAssuranceSetRoleActions(assignedSet, 'Inspector')).toEqual({
      canManage: false, canUpload: false, canVerify: false, canInspect: true, canApprove: false,
    });
    expect(getAssuranceSetRoleActions(assignedSet, 'Approver')).toEqual({
      canManage: false, canUpload: false, canVerify: false, canInspect: false, canApprove: true,
    });
  });

  it('grants no actions on a set the role is not assigned to', () => {
    ASSURANCE_SETS_READ_ONLY_ROLES.forEach((role) => {
      expect(getAssuranceSetRoleActions(unassignedSet, role)).toEqual({
        canManage: false, canUpload: false, canVerify: false, canInspect: false, canApprove: false,
      });
    });
  });

  it('never lets a workflow role manage the set, and keeps manage rights for administrator and c admin', () => {
    ASSURANCE_SETS_READ_ONLY_ROLES.forEach((role) => {
      expect(getAssuranceSetRoleActions(assignedSet, role).canManage).toBe(false);
    });
    expect(getAssuranceSetRoleActions(assignedSet, 'Administrator').canManage).toBe(true);
    expect(getAssuranceSetRoleActions(assignedSet, 'C Admin').canManage).toBe(true);
  });

  it('lets c admin verify, and never upload, on a set a c admin created', () => {
    const clientSet: AssuranceSet = {
      ...assignedSet,
      initiatorOrg: 'Southern Basin Energy Pty Ltd',
      initiatorRole: 'C Admin · Client Created',
      createdByPersona: 'C Admin',
    };
    expect(isAssuranceSetCreatedByCAdmin(clientSet)).toBe(true);
    expect(getAssuranceSetRoleActions(clientSet, 'C Admin')).toEqual({
      canManage: true, canUpload: false, canVerify: true, canInspect: false, canApprove: false,
    });

    const providerSet: AssuranceSet = {
      ...clientSet,
      initiatorRole: 'Vessel Provider Admin',
      createdByPersona: 'Administrator',
    };
    expect(isAssuranceSetCreatedByCAdmin(providerSet)).toBe(false);
    expect(getAssuranceSetRoleActions(providerSet, 'C Admin').canVerify).toBe(false);
    expect(getAssuranceSetRoleActions(providerSet, 'C Admin').canUpload).toBe(false);
  });

  it('strictly denies verification buttons/actions to service providers (Administrator and Submitter)', () => {
    // Administrator as vessel service provider
    const adminActions = getAssuranceSetRoleActions(assignedSet, 'Administrator', 'Northwind Marine Pty Ltd');
    expect(adminActions.canVerify).toBe(false);
    expect(adminActions.canUpload).toBe(true);
    expect(adminActions.canManage).toBe(true);
    expect(adminActions.canApprove).toBe(false);
    expect(adminActions.canInspect).toBe(false);

    // Submitter as service provider
    const submitterActions = getAssuranceSetRoleActions(assignedSet, 'Submitter', 'Northwind Marine Pty Ltd');
    expect(submitterActions.canVerify).toBe(false);
    expect(submitterActions.canUpload).toBe(true);
    expect(submitterActions.canManage).toBe(false);
    expect(submitterActions.canApprove).toBe(false);
    expect(submitterActions.canInspect).toBe(false);
  });

  it('denies all actions to administrators and client admins who are not stakeholders on the assurance set', () => {
    const unrelatedAdminActions = getAssuranceSetRoleActions(
      assignedSet,
      'Administrator',
      'Unrelated Marine Services',
    );
    expect(unrelatedAdminActions).toEqual({
      canManage: false,
      canUpload: false,
      canVerify: false,
      canInspect: false,
      canApprove: false,
    });

    const unrelatedClientAdminActions = getAssuranceSetRoleActions(
      assignedSet,
      'C Admin',
      'Unrelated Oil Corp',
    );
    expect(unrelatedClientAdminActions).toEqual({
      canManage: false,
      canUpload: false,
      canVerify: false,
      canInspect: false,
      canApprove: false,
    });
  });

  it('denies stakeholder reassignment to users who are not assigned stakeholders on the set', () => {
    const editableSet: AssuranceSet = {
      ...assignedSet,
      clientWorkflowStage: undefined,
      stage: 'Initiated',
      approverDecision: 'Pending',
    };

    // Assigned admin can edit stakeholders
    expect(canEditAssuranceSetStakeholders(editableSet, 'Administrator', 'Northwind Marine Pty Ltd')).toBe(true);
    expect(canEditAssuranceSetStakeholders(editableSet, 'C Admin', 'Chevron Australia Pty Ltd')).toBe(true);

    // Unrelated admin cannot edit stakeholders
    expect(canEditAssuranceSetStakeholders(editableSet, 'Administrator', 'Unrelated Marine')).toBe(false);
    expect(canEditAssuranceSetStakeholders(editableSet, 'C Admin', 'Unrelated Corp')).toBe(false);

    // Workflow roles cannot edit stakeholders
    expect(canEditAssuranceSetStakeholders(editableSet, 'Submitter')).toBe(false);
    expect(canEditAssuranceSetStakeholders(editableSet, 'Verifier')).toBe(false);
    expect(canEditAssuranceSetStakeholders(editableSet, 'Inspector')).toBe(false);
    expect(canEditAssuranceSetStakeholders(editableSet, 'Approver')).toBe(false);
  });

  it('evaluates fine-grained user stakeholder match when user profile is supplied', () => {
    const assignedUser = {
      id: 'USR-201',
      name: 'A. Fontaine',
      organization: 'Southern Basin Energy Pty Ltd',
      roles: ['Verifier' as const],
    };
    const unassignedUser = {
      id: 'USR-999',
      name: 'Different Verifier',
      organization: 'Southern Basin Energy Pty Ltd',
      roles: ['Verifier' as const],
    };

    expect(isAssuranceSetAssignedToPersona(assignedSet, 'Verifier', undefined, assignedUser)).toBe(true);
    expect(isAssuranceSetAssignedToPersona(assignedSet, 'Verifier', 'Unrelated Org', unassignedUser)).toBe(false);
  });
});
