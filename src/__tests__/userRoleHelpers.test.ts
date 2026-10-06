import { describe, expect, it } from 'vitest';
import {
  buildRolesFromForm,
  getAssuranceAssignmentWarnings,
  getEligibleVerifiers,
  getOperationalRoleOptions,
  getSegregationWarnings,
  hasBlockingAssuranceAssignmentConflict,
  splitRolesForForm,
  usersWithRole,
} from '../utils/userRoleHelpers';
import { MOCK_USERS } from '../store/mockData';

describe('userRoleHelpers', () => {
  it('should split and rebuild multi-role form state', () => {
    const split = splitRolesForForm(['Administrator', 'Submitter', 'Verifier']);
    expect(split.isPlatformAdmin).toBe(true);
    expect(split.operationalRoles).toEqual(['Submitter', 'Verifier']);

    const rebuilt = buildRolesFromForm(true, ['Verifier']);
    expect(rebuilt).toEqual(['Administrator', 'Verifier']);
  });

  it('should surface segregation warnings for risky role combinations', () => {
    const warnings = getSegregationWarnings(['Submitter', 'Verifier', 'Approver']);
    expect(warnings.length).toBeGreaterThanOrEqual(2);
    expect(warnings.some((w) => w.includes('Submitter and Verifier'))).toBe(true);
    expect(warnings.some((w) => w.includes('Verifier and Approver'))).toBe(true);
  });

  it('should filter users by operational role entitlement', () => {
    const submitters = usersWithRole(MOCK_USERS, 'Submitter');
    expect(submitters.some((u) => u.id === 'USR-102')).toBe(true);
    expect(submitters.every((u) => u.roles.includes('Submitter'))).toBe(true);
  });

  it('should detect assurance assignment segregation conflicts', () => {
    const warnings = getAssuranceAssignmentWarnings({
      submitterId: 'USR-102',
      verifierId: 'USR-102',
      approverId: 'USR-204',
    });
    expect(warnings.some((w) => w.includes('Submitter and Verifier'))).toBe(true);

    // Verifier and Approver can be the same user
    expect(
      hasBlockingAssuranceAssignmentConflict({
        verifierId: 'USR-202',
        approverId: 'USR-202',
      }),
    ).toBe(false);

    // Submitter cannot be the Approver
    expect(
      hasBlockingAssuranceAssignmentConflict({
        submitterId: 'USR-102',
        approverId: 'USR-102',
      }),
    ).toBe(true);
  });

  it('should list stakeholder operational roles without C Admin (one C Admin per organization)', () => {
    const allOptions = getOperationalRoleOptions(['Custom Auditor']);
    expect(allOptions.some((o) => o.role === 'C Admin')).toBe(false);
    expect(allOptions.some((o) => o.role === 'Submitter')).toBe(true);
    expect(allOptions.some((o) => o.role === 'Verifier')).toBe(true);
    expect(allOptions.some((o) => o.role === 'Inspector')).toBe(true);
    expect(allOptions.some((o) => o.role === 'Approver')).toBe(true);
    expect(allOptions.some((o) => o.role === 'Custom Auditor')).toBe(true);

    const filteredOptions = getOperationalRoleOptions(['Custom Auditor'], ['Submitter']);
    expect(filteredOptions.some((o) => o.role === 'Submitter')).toBe(false);
    expect(filteredOptions.some((o) => o.role === 'Verifier')).toBe(true);
  });

  it('should list C Admin users first followed by other verifiers for assurance set creation', () => {
    const eligibleVerifiers = getEligibleVerifiers(MOCK_USERS);
    expect(eligibleVerifiers.length).toBeGreaterThan(0);
    /* first users must have C Admin role */
    const firstCAdminIndex = eligibleVerifiers.findIndex((u) => u.roles.includes('C Admin'));
    expect(firstCAdminIndex).toBe(0);

    /* subsequent users must be verifiers without C Admin role */
    const otherVerifiers = eligibleVerifiers.slice(1);
    expect(otherVerifiers.every((u) => u.roles.includes('Verifier'))).toBe(true);
  });
});
