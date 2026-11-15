/*
  file summary: tests assurance sets page access and per-set role actions for workflow roles.
  responsibilities: verifies route access for submitter, verifier, inspector and approver, and that role actions apply only on assigned sets.
  role in system: covers isViewAccessibleToPersona and getAssuranceSetRoleActions in src/utils/rbacHelpers.ts.
*/

import { describe, expect, it } from 'vitest';
import {
  ASSURANCE_SETS_READ_ONLY_ROLES,
  canEditAssuranceSetStakeholders,
  filterAssuranceSetsForSession,
  filterVesselsForPersona,
  getAssuranceSetRoleActions,
  isAssuranceSetAssignedToPersona,
  isAssuranceSetCreatedByCAdmin,
  isViewAccessibleToPersona,
} from '../utils/rbacHelpers';
import { MOCK_VESSELS } from '../store/mockData';
import { VesselInformation } from '../types/vessel';
import { buildBrdRolePermissionDefaults } from '../utils/permissionDefaults';
import { MOCK_ASSURANCE_SETS } from '../store/mockData';
import { AssuranceSet } from '../types/assurance';
import { UserRolePersona } from '../types/audit';
import { getSetVesselId } from '../utils/setObjects';

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
  const submitterUser = {
    id: 'USR-102',
    name: 'M. Chen',
    organization: 'Northwind Marine Pty Ltd',
    roles: ['Submitter' as const],
  };
  const verifierUser = {
    id: 'USR-202',
    name: 'A. Fontaine',
    organization: 'Southern Basin Energy Pty Ltd',
    roles: ['Verifier' as const],
  };
  const inspectorUser = {
    id: 'USR-203',
    name: 'N. Technical',
    organization: 'Southern Basin Energy Pty Ltd',
    roles: ['Inspector' as const],
  };
  const approverUser = {
    id: 'USR-204',
    name: 'P. Nardelli',
    organization: 'Southern Basin Energy Pty Ltd',
    roles: ['Approver' as const],
  };
  const adminUser = {
    id: 'USR-101',
    name: 'K. Osei',
    organization: 'Northwind Marine Pty Ltd',
    roles: ['Administrator' as const],
  };
  const cAdminUser = {
    id: 'USR-201',
    name: 'S. Basin',
    organization: 'Southern Basin Energy Pty Ltd',
    roles: ['C Admin' as const],
  };
  const roleUsers = {
    Submitter: submitterUser,
    Verifier: verifierUser,
    Inspector: inspectorUser,
    Approver: approverUser,
  } as const;

  const assignedSet: AssuranceSet = {
    ...baseSet,
    createdBy: {
      userId: 'USR-101',
      name: 'K. Osei',
      persona: 'Administrator',
    },
    submitters: [
      { organization: 'Northwind Marine Pty Ltd', assignee: 'M. Chen (Northwind Marine Pty Ltd)' },
    ],
    stakeholders: {
      verifierName: 'A. Fontaine (Southern Basin Energy Pty Ltd)',
      inspectorName: 'N. Technical (Southern Basin Energy Pty Ltd)',
      approverName: 'P. Nardelli (Southern Basin Energy Pty Ltd)',
    },
    mandatoryInspectionRequired: true,
    stage: 'Approval',
  };
  const unassignedSet: AssuranceSet = {
    ...baseSet,
    parties: [
      { organization: 'Meridian Marine Services Pty Ltd', role: 'Requesting party' },
      { organization: 'Meridian Marine Services Pty Ltd', role: 'Responding party' },
    ],
    createdBy: {
      userId: 'USR-MERIDIAN-ADMIN',
      name: 'Meridian Admin',
      persona: 'Administrator',
    },
    submitters: [],
    stakeholders: undefined,
  };

  it('grants each workflow role only its own action on an assigned set', () => {
    ASSURANCE_SETS_READ_ONLY_ROLES.forEach((role) => {
      const user = roleUsers[role as keyof typeof roleUsers];
      expect(isAssuranceSetAssignedToPersona(assignedSet, role, user.organization, user)).toBe(true);
    });

    expect(getAssuranceSetRoleActions(assignedSet, 'Submitter', submitterUser.organization, submitterUser)).toEqual({
      canManage: false, canUpload: true, canVerify: false, canInspect: false, canApprove: false, canChangeDates: false,
    });
    expect(getAssuranceSetRoleActions(assignedSet, 'Verifier', verifierUser.organization, verifierUser)).toEqual({
      canManage: false, canUpload: false, canVerify: true, canInspect: false, canApprove: false, canChangeDates: false,
    });
    expect(getAssuranceSetRoleActions(assignedSet, 'Inspector', inspectorUser.organization, inspectorUser)).toEqual({
      canManage: false, canUpload: false, canVerify: false, canInspect: true, canApprove: false, canChangeDates: false,
    });
    expect(getAssuranceSetRoleActions(assignedSet, 'Approver', approverUser.organization, approverUser)).toEqual({
      canManage: false, canUpload: false, canVerify: false, canInspect: false, canApprove: true, canChangeDates: false,
    });
  });

  it('grants no actions on a set the role is not assigned to', () => {
    ASSURANCE_SETS_READ_ONLY_ROLES.forEach((role) => {
      const user = roleUsers[role as keyof typeof roleUsers];
      expect(getAssuranceSetRoleActions(unassignedSet, role, user.organization, user)).toEqual({
        canManage: false, canUpload: false, canVerify: false, canInspect: false, canApprove: false, canChangeDates: false,
      });
    });
  });

  it('never lets a workflow role manage the set, and keeps manage rights for administrator and c admin', () => {
    ASSURANCE_SETS_READ_ONLY_ROLES.forEach((role) => {
      const user = roleUsers[role as keyof typeof roleUsers];
      expect(getAssuranceSetRoleActions(assignedSet, role, user.organization, user).canManage).toBe(false);
    });
    expect(getAssuranceSetRoleActions(assignedSet, 'Administrator', adminUser.organization, adminUser).canManage).toBe(true);
    const clientManagedSet: AssuranceSet = {
      ...assignedSet,
      parties: [
        { organization: 'Southern Basin Energy Pty Ltd', role: 'Requesting party' },
        { organization: 'Northwind Marine Pty Ltd', role: 'Responding party' },
      ],
      createdBy: {
        userId: 'USR-201',
        name: 'S. Basin',
        persona: 'C Admin',
      },
    };
    expect(getAssuranceSetRoleActions(clientManagedSet, 'C Admin', cAdminUser.organization, cAdminUser).canManage).toBe(true);
  });

  it('lets c admin verify, and never upload, on a set a c admin created', () => {
    const clientSet: AssuranceSet = {
      ...assignedSet,
      parties: [
        { organization: 'Southern Basin Energy Pty Ltd', role: 'Requesting party' },
        { organization: 'Northwind Marine Pty Ltd', role: 'Responding party' },
      ],
      createdBy: {
        userId: 'USR-201',
        name: 'S. Basin',
        persona: 'C Admin',
      },
    };
    expect(isAssuranceSetCreatedByCAdmin(clientSet)).toBe(true);
    expect(getAssuranceSetRoleActions(clientSet, 'C Admin', cAdminUser.organization, cAdminUser)).toEqual({
      canManage: true, canUpload: false, canVerify: true, canInspect: false, canApprove: false, canChangeDates: false,
    });

    const providerSet: AssuranceSet = {
      ...clientSet,
      parties: [
        { organization: 'Southern Basin Energy Pty Ltd', role: 'Requesting party' },
        { organization: 'Northwind Marine Pty Ltd', role: 'Responding party' },
      ],
      createdBy: {
        userId: 'USR-101',
        name: 'K. Osei',
        persona: 'Administrator',
      },
    };
    expect(isAssuranceSetCreatedByCAdmin(providerSet)).toBe(false);
    expect(getAssuranceSetRoleActions(providerSet, 'C Admin', cAdminUser.organization, cAdminUser).canVerify).toBe(false);
    expect(getAssuranceSetRoleActions(providerSet, 'C Admin', cAdminUser.organization, cAdminUser).canUpload).toBe(false);
  });

  it('strictly denies verification buttons/actions to service providers (Administrator and Submitter)', () => {
    // Administrator as vessel service provider
    const adminActions = getAssuranceSetRoleActions(assignedSet, 'Administrator', 'Northwind Marine Pty Ltd', adminUser);
    expect(adminActions.canVerify).toBe(false);
    expect(adminActions.canUpload).toBe(true);
    expect(adminActions.canManage).toBe(true);
    expect(adminActions.canApprove).toBe(false);
    expect(adminActions.canInspect).toBe(false);

    // Submitter as service provider
    const submitterActions = getAssuranceSetRoleActions(assignedSet, 'Submitter', 'Northwind Marine Pty Ltd', submitterUser);
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
      { id: 'USR-UNREL-1', name: 'Other Admin', organization: 'Unrelated Marine Services', roles: ['Administrator'] },
    );
    expect(unrelatedAdminActions).toEqual({
      canManage: false,
      canUpload: false,
      canVerify: false,
      canInspect: false,
      canApprove: false,
      canChangeDates: false,
    });

    const unrelatedClientAdminActions = getAssuranceSetRoleActions(
      assignedSet,
      'C Admin',
      'Unrelated Oil Corp',
      { id: 'USR-UNREL-2', name: 'Other C Admin', organization: 'Unrelated Oil Corp', roles: ['C Admin'] },
    );
    expect(unrelatedClientAdminActions).toEqual({
      canManage: false,
      canUpload: false,
      canVerify: false,
      canInspect: false,
      canApprove: false,
      canChangeDates: false,
    });
  });

  it('denies stakeholder reassignment to users who are not assigned stakeholders on the set', () => {
    const editableProviderSet: AssuranceSet = {
      ...assignedSet,
      clientWorkflowStage: undefined,
      stage: 'Initiated',
      approverDecision: 'Pending',
    };
    const editableClientSet: AssuranceSet = {
      ...editableProviderSet,
      parties: [
        { organization: 'Chevron Australia Pty Ltd', role: 'Requesting party' },
        { organization: 'Northwind Marine Pty Ltd', role: 'Responding party' },
      ],
      createdBy: {
        userId: 'USR-221',
        name: 'C. Henderson',
        persona: 'C Admin',
      },
    };
    const chevronCAdmin = {
      id: 'USR-221',
      name: 'C. Henderson',
      organization: 'Chevron Australia Pty Ltd',
      roles: ['C Admin' as const],
    };

    // Assigned admin / creator can edit stakeholders
    expect(canEditAssuranceSetStakeholders(editableProviderSet, 'Administrator', 'Northwind Marine Pty Ltd', adminUser)).toBe(true);
    expect(canEditAssuranceSetStakeholders(editableClientSet, 'C Admin', 'Chevron Australia Pty Ltd', chevronCAdmin)).toBe(true);

    // Same-org unassigned colleague and unrelated admin cannot edit stakeholders
    expect(canEditAssuranceSetStakeholders(editableProviderSet, 'Administrator', 'Northwind Marine Pty Ltd', {
      id: 'USR-104',
      name: 'E. Rostova',
      organization: 'Northwind Marine Pty Ltd',
      roles: ['Administrator'],
    })).toBe(false);
    expect(canEditAssuranceSetStakeholders(editableProviderSet, 'Administrator', 'Unrelated Marine', {
      id: 'USR-UNREL-1',
      name: 'Other Admin',
      organization: 'Unrelated Marine',
      roles: ['Administrator'],
    })).toBe(false);
    expect(canEditAssuranceSetStakeholders(editableClientSet, 'C Admin', 'Unrelated Corp', {
      id: 'USR-UNREL-2',
      name: 'Other C Admin',
      organization: 'Unrelated Corp',
      roles: ['C Admin'],
    })).toBe(false);

    // Workflow roles cannot edit stakeholders
    expect(canEditAssuranceSetStakeholders(editableProviderSet, 'Submitter', submitterUser.organization, submitterUser)).toBe(false);
    expect(canEditAssuranceSetStakeholders(editableProviderSet, 'Verifier', verifierUser.organization, verifierUser)).toBe(false);
    expect(canEditAssuranceSetStakeholders(editableProviderSet, 'Inspector', inspectorUser.organization, inspectorUser)).toBe(false);
    expect(canEditAssuranceSetStakeholders(editableProviderSet, 'Approver', approverUser.organization, approverUser)).toBe(false);
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
    expect(isAssuranceSetAssignedToPersona(assignedSet, 'Verifier', unassignedUser.organization, unassignedUser)).toBe(false);
    expect(isAssuranceSetAssignedToPersona(assignedSet, 'Verifier', undefined, unassignedUser)).toBe(false);
  });

  it('ensures two Verifiers of the same organization see different Assurance Sets lists', () => {
    const verifier1 = {
      id: 'USR-VER-1',
      name: 'A. Fontaine',
      organization: 'Bureau Veritas Inspectorate',
      roles: ['Verifier' as const],
    };
    const verifier2 = {
      id: 'USR-VER-2',
      name: 'J. Dupont',
      organization: 'Bureau Veritas Inspectorate',
      roles: ['Verifier' as const],
    };

    const setForVerifier1: AssuranceSet = {
      ...baseSet,
      id: 'SET-VER-1',
      stakeholders: {
        verifierName: 'A. Fontaine (Bureau Veritas Inspectorate)',
        verifierOrg: 'Bureau Veritas Inspectorate',
      },
    };
    const setForVerifier2: AssuranceSet = {
      ...baseSet,
      id: 'SET-VER-2',
      stakeholders: {
        verifierName: 'J. Dupont (Bureau Veritas Inspectorate)',
        verifierOrg: 'Bureau Veritas Inspectorate',
      },
    };
    const testSets = [setForVerifier1, setForVerifier2];

    const setsForV1 = filterAssuranceSetsForSession(testSets, 'Verifier', verifier1.organization, verifier1);
    const setsForV2 = filterAssuranceSetsForSession(testSets, 'Verifier', verifier2.organization, verifier2);

    expect(setsForV1.map((s) => s.id)).toEqual(['SET-VER-1']);
    expect(setsForV2.map((s) => s.id)).toEqual(['SET-VER-2']);
    expect(setsForV1).not.toEqual(setsForV2);
  });

  it('ensures a Submitter sees only vessels on their own sets', () => {
    const submitterChen = {
      id: 'USR-SUB-1',
      name: 'M. Chen',
      organization: 'Northwind Marine Pty Ltd',
      roles: ['Submitter' as const],
    };
    const submitterRamirez = {
      id: 'USR-SUB-2',
      name: 'E. Ramirez',
      organization: 'Northwind Marine Pty Ltd',
      roles: ['Submitter' as const],
    };

    const vesselA: VesselInformation = {
      id: 'VESSEL-001',
      name: 'MV Northwind Alpha',
      registeredOwner: 'Northwind Marine Pty Ltd',
    } as VesselInformation;
    const vesselB: VesselInformation = {
      id: 'VESSEL-002',
      name: 'MV Northwind Beta',
      registeredOwner: 'Northwind Marine Pty Ltd',
    } as VesselInformation;

    const setForChen: AssuranceSet = {
      ...baseSet,
      id: 'SET-SUB-1',
      assuranceObjects: [{ id: 'VESSEL-001', type: 'vessel', name: 'MV Northwind Alpha', ownerOrganization: 'Northwind Marine Pty Ltd' }],
      submitters: [{ organization: 'Northwind Marine Pty Ltd', assignee: 'M. Chen (Northwind Marine Pty Ltd)' }],
    };
    const setForRamirez: AssuranceSet = {
      ...baseSet,
      id: 'SET-SUB-2',
      assuranceObjects: [{ id: 'VESSEL-002', type: 'vessel', name: 'MV Northwind Beta', ownerOrganization: 'Northwind Marine Pty Ltd' }],
      submitters: [{ organization: 'Northwind Marine Pty Ltd', assignee: 'E. Ramirez (Northwind Marine Pty Ltd)' }],
    };
    const vessels = [vesselA, vesselB];
    const sets = [setForChen, setForRamirez];

    const chenVessels = filterVesselsForPersona(vessels, sets, 'Submitter', submitterChen.organization, submitterChen);
    const ramirezVessels = filterVesselsForPersona(vessels, sets, 'Submitter', submitterRamirez.organization, submitterRamirez);

    expect(chenVessels.map((v) => v.id)).toEqual(['VESSEL-001']);
    expect(ramirezVessels.map((v) => v.id)).toEqual(['VESSEL-002']);

    const mockChenVessels = filterVesselsForPersona(
      MOCK_VESSELS,
      MOCK_ASSURANCE_SETS,
      'Submitter',
      submitterChen.organization,
      submitterChen,
    );
    const chenAssignedSetVesselIds = new Set(
      MOCK_ASSURANCE_SETS
        .filter((s) => isAssuranceSetAssignedToPersona(s, 'Submitter', submitterChen.organization, submitterChen))
        .map((s) => getSetVesselId(s))
        .filter(Boolean),
    );
    expect(mockChenVessels.length).toBeGreaterThan(0);
    expect(mockChenVessels.every((v) => chenAssignedSetVesselIds.has(v.id))).toBe(true);
  });
});
