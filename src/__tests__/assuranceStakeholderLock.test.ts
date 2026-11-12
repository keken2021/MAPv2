import { describe, expect, it } from 'vitest';
import {
  canEditAssuranceSetStakeholders,
  getAssuranceSetStakeholderLockReason,
  isAssuranceSetStakeholderAssignmentLocked,
} from '../utils/rbacHelpers';
import { AssuranceSet } from '../types/assurance';
import { useMapStore } from '../store/useMapStore';
import { MOCK_ASSURANCE_SETS, MOCK_USERS } from '../store/mockData';
import { UserProfile } from '../types/user';

const northwindAdmin = MOCK_USERS.find((u) => u.id === 'USR-101')!;
const sbeCAdmin = MOCK_USERS.find((u) => u.id === 'USR-201')!;
const chevronCAdmin = MOCK_USERS.find((u) => u.id === 'USR-221')!;
const woodsideApprover = MOCK_USERS.find((u) => u.id === 'USR-220' && u.organization === 'Woodside Energy Ltd')!;
const inpexCAdmin: UserProfile = {
  id: 'USR-INPEX-CADMIN',
  name: 'I. Takahashi',
  email: 'i.takahashi@inpex.test',
  roles: ['C Admin'],
  userType: 'Organization',
  organization: 'Inpex Operations Australia',
  departmentOrScope: 'Asset Governance',
  status: 'Active',
  lastActive: '2026-10-01 09:00 UTC',
};

describe('assurance set stakeholder assignment lock', () => {
  it('locks Approved and Certified pipeline stages', () => {
    expect(
      isAssuranceSetStakeholderAssignmentLocked({
        stage: 'Approved',
        clientWorkflowStage: undefined,
      }),
    ).toBe(true);
    expect(
      isAssuranceSetStakeholderAssignmentLocked({
        stage: 'Certified',
        clientWorkflowStage: undefined,
      }),
    ).toBe(true);
  });

  it('locks client workflow stages after draft', () => {
    expect(
      getAssuranceSetStakeholderLockReason({
        stage: 'Initiated',
        clientWorkflowStage: 'in_review',
      }),
    ).toContain('under review');

    expect(
      isAssuranceSetStakeholderAssignmentLocked({
        stage: 'Approval',
        clientWorkflowStage: 'pending_approval',
      }),
    ).toBe(true);

    expect(
      isAssuranceSetStakeholderAssignmentLocked({
        stage: 'Verification',
        clientWorkflowStage: 'approved',
      }),
    ).toBe(true);
  });

  it('allows edits on active campaigns in draft or without client workflow stage', () => {
    expect(
      canEditAssuranceSetStakeholders(
        { stage: 'Initiated', clientWorkflowStage: 'draft' },
        'Administrator',
        'Northwind Marine Pty Ltd',
        northwindAdmin,
      ),
    ).toBe(true);

    expect(
      canEditAssuranceSetStakeholders(
        { stage: 'Validation', clientWorkflowStage: undefined },
        'C Admin',
        'Southern Basin Energy Pty Ltd',
        sbeCAdmin,
      ),
    ).toBe(true);
  });

  it('allows reassignment when campaign was returned for correction', () => {
    expect(
      canEditAssuranceSetStakeholders(
        {
          stage: 'Approval',
          clientWorkflowStage: 'in_review',
          approverDecision: 'Returned for Correction',
        },
        'Administrator',
        'Northwind Marine Pty Ltd',
        northwindAdmin,
      ),
    ).toBe(true);
  });

  it('denies non-admin personas regardless of stage', () => {
    expect(
      canEditAssuranceSetStakeholders({ stage: 'Initiated' }, 'Submitter'),
    ).toBe(false);
  });

  it('locks Woodside approved mock set and open Inpex initiated set correctly', () => {
    const woodside = MOCK_ASSURANCE_SETS.find((s) => s.id === 'AS-2026-004')!;
    const inpex: AssuranceSet = {
      ...MOCK_ASSURANCE_SETS.find((s) => s.id === 'AS-2026-003')!,
      createdByUserId: inpexCAdmin.id,
      createdByName: inpexCAdmin.name,
      createdByPersona: 'C Admin',
    };
    const chevron = MOCK_ASSURANCE_SETS.find((s) => s.id === 'AS-2026-001')!;

    expect(
      canEditAssuranceSetStakeholders(woodside, 'Administrator', 'Woodside Energy Ltd', woodsideApprover),
    ).toBe(false);
    expect(
      canEditAssuranceSetStakeholders(inpex, 'C Admin', 'Inpex Operations Australia', inpexCAdmin),
    ).toBe(true);
    expect(
      canEditAssuranceSetStakeholders(inpex, 'Administrator', 'Northwind Marine Pty Ltd', northwindAdmin),
    ).toBe(false);
    expect(
      canEditAssuranceSetStakeholders(chevron, 'C Admin', 'Chevron Australia Pty Ltd', chevronCAdmin),
    ).toBe(false);
  });

  it('store updateAssuranceStakeholder rejects locked campaigns', () => {
    const initialState = useMapStore.getState();
    try {
      const locked = MOCK_ASSURANCE_SETS.find((s) => s.id === 'AS-2026-004') as AssuranceSet;
      const editable = MOCK_ASSURANCE_SETS.find((s) => s.id === 'AS-2026-003') as AssuranceSet;

      useMapStore.setState({
        users: [...initialState.users, inpexCAdmin],
        assuranceSets: initialState.assuranceSets.map((s) =>
          s.id === editable.id
            ? {
                ...s,
                createdByUserId: inpexCAdmin.id,
                createdByName: inpexCAdmin.name,
                createdByPersona: 'C Admin',
              }
            : s,
        ),
        activePersona: 'Administrator',
        activeDemoOrganization: 'Northwind Marine Pty Ltd',
        activeSessionUserId: 'USR-101',
      });

      const blocked = useMapStore.getState().updateAssuranceStakeholder(
        locked.id,
        'Verifier',
        'S. Basin (Southern Basin Energy Pty Ltd)',
      );
      expect(blocked.success).toBe(false);
      expect(blocked.message).toContain('approved or certified');

      useMapStore.setState({
        activePersona: 'C Admin',
        activeDemoOrganization: 'Inpex Operations Australia',
        activeSessionUserId: inpexCAdmin.id,
      });
      const allowed = useMapStore.getState().updateAssuranceStakeholder(
        editable.id,
        'Verifier',
        'K. Tanabe (Inpex Operations Australia)',
      );
      expect(allowed.success).toBe(true);
    } finally {
      useMapStore.setState(initialState, true);
    }
  });
});
