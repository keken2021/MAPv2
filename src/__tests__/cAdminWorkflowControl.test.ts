import { describe, expect, it, beforeEach } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { buildBrdRolePermissionDefaults } from '../utils/permissionDefaults';
import { getRoleScopeFlags } from '../utils/permissionHelpers';

describe('C Admin exclusive workflow control (Req 5)', () => {
  beforeEach(() => {
    useMapStore.getState().setActivePersona('C Admin');
  });

  it('grants C Admin approval and assurance completion permissions', () => {
    const matrix = buildBrdRolePermissionDefaults();
    const approval = getRoleScopeFlags(matrix, 'C Admin', 'approval_decisions');
    const completion = getRoleScopeFlags(matrix, 'C Admin', 'assurance_completion');

    expect(approval.read).toBe(true);
    expect(approval.update).toBe(true);
    expect(completion.read).toBe(true);
    expect(completion.update).toBe(true);
  });

  it('sendAssuranceForReview marks campaign in_review and advances stage from Initiated', () => {
    const store = useMapStore.getState();
    const setId = 'AS-2026-003';
    const target = store.assuranceSets.find((s) => s.id === setId);
    expect(target?.initiatorRole).toBe('C Admin · Client Created');
    expect(target?.stage).toBe('Initiated');

    store.sendAssuranceForReview(setId);

    const updated = useMapStore.getState().assuranceSets.find((s) => s.id === setId);
    expect(updated?.clientWorkflowStage).toBe('in_review');
    expect(updated?.sentForReviewAt).toBeTruthy();
    expect(updated?.stage).not.toBe('Initiated');

    const audit = useMapStore.getState().auditEvents[0];
    expect(audit.action).toContain('Client Sent Campaign for Review');
  });

  it('setClientApproval records client decision and updates workflow stage', () => {
    const store = useMapStore.getState();
    const setId = 'AS-2026-003';

    store.sendAssuranceForReview(setId);
    store.setClientApproval(setId, 'Approved', 'Client sign-off for unit test');

    const updated = useMapStore.getState().assuranceSets.find((s) => s.id === setId);
    expect(updated?.clientWorkflowStage).toBe('approved');
    expect(updated?.approverDecision).toBe('Approved');

    const audit = useMapStore.getState().auditEvents[0];
    expect(audit.action).toContain('Client Campaign Decision');
  });
});
