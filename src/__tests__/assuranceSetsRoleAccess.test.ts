/*
  file summary: tests assurance sets page access and per-set role actions for workflow roles.
  responsibilities: verifies route access for submitter, verifier, inspector and approver, and that role actions apply only on assigned sets.
  role in system: covers isViewAccessibleToPersona and getAssuranceSetRoleActions in src/utils/rbacHelpers.ts.
*/

import { describe, expect, it } from 'vitest';
import {
  ASSURANCE_SETS_READ_ONLY_ROLES,
  getAssuranceSetRoleActions,
  isAssuranceSetAssignedToPersona,
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

  it('does not open projects to verifier, inspector or approver', () => {
    (['Verifier', 'Inspector', 'Approver'] as UserRolePersona[]).forEach((role) => {
      expect(isViewAccessibleToPersona('project', undefined, role, matrix)).toBe(false);
    });
  });

  it('keeps administrator and c admin access unchanged', () => {
    expect(isViewAccessibleToPersona('assurance-sets', undefined, 'Administrator', matrix)).toBe(true);
    expect(isViewAccessibleToPersona('create-assurance-set', undefined, 'Administrator', matrix)).toBe(true);
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
});
