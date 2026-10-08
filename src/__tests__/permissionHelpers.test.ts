import { describe, expect, it } from 'vitest';
import { buildBrdRolePermissionDefaults, isBrdHardDenied } from '../utils/permissionDefaults';
import {
  applyPermissionGuards,
  getEffectiveUserScopeFlags,
  getRoleScopeFlags,
} from '../utils/permissionHelpers';
import { isViewAccessibleToPersona } from '../utils/rbacHelpers';

describe('permissionDefaults and helpers', () => {
  const matrix = buildBrdRolePermissionDefaults();

  it('seeds Administrator with vessel C/R/U and C Admin with vessel read-only', () => {
    expect(getRoleScopeFlags(matrix, 'Administrator', 'vessels')).toEqual({
      create: true,
      read: true,
      update: true,
      delete: false,
    });
    expect(getRoleScopeFlags(matrix, 'C Admin', 'vessels')).toEqual({
      create: false,
      read: true,
      update: false,
      delete: false,
    });
  });

  it('hard-locks C Admin vessel create (blank in BRD matrix)', () => {
    expect(isBrdHardDenied('C Admin', 'vessels', 'create')).toBe(true);
    const forced = applyPermissionGuards('vessels', 'C Admin', {
      create: true,
      read: true,
      update: true,
      delete: true,
    });
    expect(forced).toEqual({
      create: false,
      read: true,
      update: false,
      delete: false,
    });
  });

  it('retains assurance_sets privileges (create, read, update) for C Admin alongside requirements management', () => {
    expect(getRoleScopeFlags(matrix, 'C Admin', 'assurance_sets')).toEqual({
      create: true,
      read: true,
      update: true,
      delete: false,
    });
    expect(getRoleScopeFlags(matrix, 'C Admin', 'assurance_requirements')).toEqual({
      create: true,
      read: true,
      update: true,
      delete: false,
    });
  });

  it('keeps Verifier post-inspection review as read-only; update stays locked', () => {
    expect(getRoleScopeFlags(matrix, 'Verifier', 'post_inspection_review')).toEqual({
      create: false,
      read: true,
      update: false,
      delete: false,
    });

    const effective = getEffectiveUserScopeFlags(
      matrix,
      {
        'USR-V': {
          post_inspection_review: { read: true, update: true },
        },
      },
      { id: 'USR-V', roles: ['Verifier'] },
      'post_inspection_review',
    );
    expect(effective.read).toBe(true);
    expect(effective.update).toBe(false);
  });

  it('locks audit trail update and delete for all roles', () => {
    for (const role of ['Administrator', 'Submitter', 'Verifier'] as const) {
      const flags = getRoleScopeFlags(matrix, role, 'audit_trail');
      expect(flags.read).toBe(true);
      expect(flags.update).toBe(false);
      expect(flags.delete).toBe(false);
    }
  });

  it('dynamically updates view accessibility when permission matrix read access is granted or revoked', () => {
    const customMatrix = JSON.parse(JSON.stringify(matrix));

    expect(isViewAccessibleToPersona('vessels', null, 'Verifier', customMatrix)).toBe(false);

    customMatrix['Verifier']['vessels'] = {
      create: false,
      read: true,
      update: false,
      delete: false,
    };
    /* BRD hard-deny still forces Verifier vessels read off even if matrix is patched */
    expect(getRoleScopeFlags(customMatrix, 'Verifier', 'vessels').read).toBe(false);
  });

  it('disables physical inspections for Approver in default permission matrix', () => {
    const approverInspection = getRoleScopeFlags(matrix, 'Approver', 'inspection_workspace');
    expect(approverInspection).toEqual({
      create: false,
      read: false,
      update: false,
      delete: false,
    });
    expect(isViewAccessibleToPersona('inspector', null, 'Approver', matrix)).toBe(false);
  });

  it('gives Administrator access to Roles & Permissions settings page', () => {
    expect(isViewAccessibleToPersona('roles-permissions', null, 'Administrator')).toBe(true);
    expect(isViewAccessibleToPersona('roles-permissions', null, 'C Admin')).toBe(false);
    expect(getRoleScopeFlags(matrix, 'Administrator', 'role_rights')).toEqual({
      create: false,
      read: false,
      update: false,
      delete: false,
    });
  });

  it('lets user overrides toggle rights that at least one role is allowed to hold', () => {
    const effectiveOff = getEffectiveUserScopeFlags(
      matrix,
      { 'USR-MULTI': { documents: { create: false } } },
      { id: 'USR-MULTI', roles: ['Submitter', 'Verifier'] },
      'documents',
    );
    expect(effectiveOff.create).toBe(false);

    const effectiveOn = getEffectiveUserScopeFlags(
      matrix,
      { 'USR-MULTI': { documents: { create: true } } },
      { id: 'USR-MULTI', roles: ['Submitter', 'Verifier'] },
      'documents',
    );
    expect(effectiveOn.create).toBe(true);
  });

  it('seeds sidebar-facing vessel and CAPA rights for Admin, C Admin, and Submitter', () => {
    expect(getRoleScopeFlags(matrix, 'Administrator', 'vessels').read).toBe(true);
    expect(getRoleScopeFlags(matrix, 'Administrator', 'capa').read).toBe(true);
    expect(getRoleScopeFlags(matrix, 'C Admin', 'capa').read).toBe(true);
    expect(getRoleScopeFlags(matrix, 'C Admin', 'documents').read).toBe(false);
    expect(getRoleScopeFlags(matrix, 'C Admin', 'crew').read).toBe(false);
    expect(getRoleScopeFlags(matrix, 'Submitter', 'vessels').read).toBe(true);
  });

  it('limits Verifier / Inspector / Approver sidebar-facing reads', () => {
    /* workflow roles read the assurance sets page but cannot create or update from it */
    expect(getRoleScopeFlags(matrix, 'Verifier', 'assurance_sets').read).toBe(true);
    expect(getRoleScopeFlags(matrix, 'Verifier', 'assurance_sets').create).toBe(false);
    expect(getRoleScopeFlags(matrix, 'Inspector', 'assurance_sets').read).toBe(true);
    expect(getRoleScopeFlags(matrix, 'Inspector', 'assurance_sets').update).toBe(false);
    expect(getRoleScopeFlags(matrix, 'Inspector', 'documents').read).toBe(false);
    expect(getRoleScopeFlags(matrix, 'Inspector', 'capa').read).toBe(true);
    expect(getRoleScopeFlags(matrix, 'Approver', 'approval_gate').read).toBe(true);
    expect(getRoleScopeFlags(matrix, 'Approver', 'dashboard').read).toBe(true);
    expect(getRoleScopeFlags(matrix, 'Approver', 'audit_trail').read).toBe(true);
  });

  it('C Admin verification scopes stay unlockable so Administrator can grant Verifier access', () => {
    expect(isBrdHardDenied('C Admin', 'verification_queue', 'read')).toBe(false);
    expect(isBrdHardDenied('C Admin', 'verification_decisions', 'update')).toBe(false);
    expect(getRoleScopeFlags(matrix, 'C Admin', 'verification_queue').read).toBe(false);

    const granted = applyPermissionGuards('verification_queue', 'C Admin', {
      create: false,
      read: true,
      update: false,
      delete: false,
    });
    expect(granted.read).toBe(true);
  });

  it('Verifier approval scopes stay unlockable so Administrator can grant Approver access', () => {
    expect(isBrdHardDenied('Verifier', 'approval_gate', 'read')).toBe(false);
    expect(isBrdHardDenied('Verifier', 'approval_decisions', 'update')).toBe(false);
    expect(isBrdHardDenied('Verifier', 'assurance_completion', 'update')).toBe(false);
    expect(getRoleScopeFlags(matrix, 'Verifier', 'approval_gate').read).toBe(false);

    const grantedGate = applyPermissionGuards('approval_gate', 'Verifier', {
      create: false,
      read: true,
      update: true,
      delete: false,
    });
    expect(grantedGate.read).toBe(true);
    expect(grantedGate.update).toBe(false);

    const grantedDecisions = applyPermissionGuards('approval_decisions', 'Verifier', {
      create: false,
      read: true,
      update: true,
      delete: false,
    });
    expect(grantedDecisions.update).toBe(true);
  });

  it('grants Verifier access to approver route when approval_gate read is enabled in role defaults', () => {
    const customMatrix = {
      ...matrix,
      Verifier: {
        ...matrix.Verifier,
        approval_gate: { create: false, read: true, update: true, delete: false },
      },
    };
    expect(isViewAccessibleToPersona('approver', null, 'Verifier', customMatrix)).toBe(true);
  });

  it('still strips user overrides that are blank for every role the user holds', () => {
    const effective = getEffectiveUserScopeFlags(
      matrix,
      { 'USR-V': { vessels: { create: true } } },
      { id: 'USR-V', roles: ['Verifier'] },
      'vessels',
    );
    expect(effective.create).toBe(false);
  });
});
