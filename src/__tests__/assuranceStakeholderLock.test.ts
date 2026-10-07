import { describe, expect, it } from 'vitest';
import {
  canEditAssuranceSetStakeholders,
  getAssuranceSetStakeholderLockReason,
  isAssuranceSetStakeholderAssignmentLocked,
} from '../utils/rbacHelpers';
import { AssuranceSet } from '../types/assurance';
import { useMapStore } from '../store/useMapStore';
import { MOCK_ASSURANCE_SETS } from '../store/mockData';

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
      ),
    ).toBe(true);

    expect(
      canEditAssuranceSetStakeholders(
        { stage: 'Validation', clientWorkflowStage: undefined },
        'C Admin',
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
    const inpex = MOCK_ASSURANCE_SETS.find((s) => s.id === 'AS-2026-003')!;
    const chevron = MOCK_ASSURANCE_SETS.find((s) => s.id === 'AS-2026-001')!;

    expect(canEditAssuranceSetStakeholders(woodside, 'Administrator')).toBe(false);
    expect(canEditAssuranceSetStakeholders(inpex, 'Administrator')).toBe(true);
    expect(canEditAssuranceSetStakeholders(chevron, 'C Admin')).toBe(false);
  });

  it('store updateAssuranceStakeholder rejects locked campaigns', () => {
    useMapStore.getState().setActivePersona('Administrator');
    const locked = MOCK_ASSURANCE_SETS.find((s) => s.id === 'AS-2026-004') as AssuranceSet;
    const editable = MOCK_ASSURANCE_SETS.find((s) => s.id === 'AS-2026-003') as AssuranceSet;

    const blocked = useMapStore.getState().updateAssuranceStakeholder(
      locked.id,
      'Verifier',
      'S. Basin (Southern Basin Energy Pty Ltd)',
    );
    expect(blocked.success).toBe(false);
    expect(blocked.message).toContain('approved or certified');

    const allowed = useMapStore.getState().updateAssuranceStakeholder(
      editable.id,
      'Verifier',
      'S. Basin (Southern Basin Energy Pty Ltd)',
    );
    expect(allowed.success).toBe(true);
  });
});
