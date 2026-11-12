/*
  file summary: tests that every audit event names the signed-in user, not a placeholder account.
  responsibilities: verifies that a review action records the session user's id, persona and organization, and that no placeholder id is written.
  role in system: covers useMapStore.ts (logAuditEvent, getSessionActor); gap review finding E8.
*/

import { beforeEach, describe, expect, it } from 'vitest';
import { useMapStore } from '../store/useMapStore';

const initialState = useMapStore.getState();

describe('audit actor', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
  });

  it('records the signed-in verifier on a verification', () => {
    useMapStore.setState({
      activePersona: 'Verifier',
      activeDemoOrganization: 'Bureau Veritas Inspectorate',
      activeSessionUserId: 'USR-202',
    });
    const set = useMapStore.getState().assuranceSets.find((s) => s.requirements.some((r) => r.documentId))!;
    const req = set.requirements.find((r) => r.documentId)!;

    useMapStore.getState().verifyDocument(req.documentId!, 'Verified', 'Checked.', undefined, req.id, set.id);

    const [latest] = useMapStore.getState().auditEvents;
    expect(latest.userId).toBe('USR-202');
    expect(latest.userRole).toBe('Verifier');
    expect(latest.organization).toBe('Bureau Veritas Inspectorate');
  });

  it('never writes a placeholder id', () => {
    useMapStore.getState().logAuditEvent({ action: 'Test', targetAsset: 'Test' });
    const [latest] = useMapStore.getState().auditEvents;
    expect(latest.userId).not.toMatch(/^USR-(CURRENT|ADMIN|VERIFY|APPROVE|SUBMIT|CADMIN|INSPEC)/);
  });

  it('logs an automated System Transition event with Approach A session actor attribution when condition is met', () => {
    useMapStore.setState({
      activePersona: 'Verifier',
      activeDemoOrganization: 'Bureau Veritas Inspectorate',
      activeSessionUserId: 'USR-244',
    });

    const store = useMapStore.getState();
    const set = store.assuranceSets.find(
      (s) => s.stage === 'Verification' && s.requirements.length > 0 && s.assignedVerifier?.includes('S. Girard'),
    )!;
    expect(set).toBeDefined();

    // Verify all requirements on this set to complete the Verification stage
    for (const req of set.requirements) {
      useMapStore.getState().updateRequirementStatus(set.id, req.id, 'Verified', 'Verified for test.');
    }

    const events = useMapStore.getState().auditEvents;
    const transitionEvent = events.find((e) => e.action.startsWith('System Transition:'));
    expect(transitionEvent).toBeDefined();
    expect(transitionEvent?.target.kind).toBe('stage');
    expect(transitionEvent?.target.setId).toBe(set.id);
    expect(transitionEvent?.fieldDelta?.fieldName).toBe('Stage');
    expect(transitionEvent?.fieldDelta?.oldValue).toBe('Verification');
    expect(transitionEvent?.userId).toBe('USR-244');
    expect(transitionEvent?.userRole).toBe('Verifier');
    expect(transitionEvent?.organization).toBe('Bureau Veritas Inspectorate');
  });

  it('logs field-level deltas for stakeholder reassignment', () => {
    useMapStore.setState({
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: 'USR-101',
    });

    const set = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-2026-002')!;
    const prevSubmitter = set.assignedSubmitter || 'Unassigned';
    const nextSubmitter = 'M. Chen (Northwind Marine Pty Ltd)';

    useMapStore.getState().updateAssuranceSet({
      ...set,
      assignedSubmitter: nextSubmitter,
    });

    const events = useMapStore.getState().auditEvents;
    const reassignEvent = events.find(
      (e) => (e.action === 'Reassigned stakeholder' || e.action === 'Assigned stakeholder') && e.target.kind === 'stakeholder',
    );
    expect(reassignEvent).toBeDefined();
    expect(reassignEvent?.fieldDelta).toEqual({
      fieldName: 'Submitter',
      oldValue: prevSubmitter,
      newValue: nextSubmitter,
    });
    expect(reassignEvent?.userId).toBe('USR-101');
  });

  it('logs field-level deltas for task exemption', () => {
    useMapStore.setState({
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: 'USR-101',
    });

    const set = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-2026-002' && s.requirements.length > 0)!;
    const task = set.requirements[0];

    useMapStore.getState().exemptAssuranceTasks(set.id, [task.id], 'Drydock waiver', 'K. Osei', '2027-04-01');

    const events = useMapStore.getState().auditEvents;
    const exemptEvent = events.find((e) => e.action === 'Exempted task' && e.target.kind === 'task');
    expect(exemptEvent).toBeDefined();
    expect(exemptEvent?.fieldDelta?.fieldName).toBe('Exemption');
    expect(exemptEvent?.fieldDelta?.newValue).toContain('2027-04-01');
    expect(exemptEvent?.userId).toBe('USR-101');
  });

  it('logs field-level deltas for document revision uploads', () => {
    useMapStore.setState({
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: 'USR-101',
    });

    const doc = useMapStore.getState().documents.find((d) => d.id === 'MAP-VES-2026-STAT-00005')!;
    const newVersion = 'v3.5';

    useMapStore.getState().addDocumentVersion(
      doc.id,
      newVersion,
      'revised_cert.pdf',
      2048,
      'Annual renewal',
    );

    const events = useMapStore.getState().auditEvents;
    const revisionEvent = events.find(
      (e) => e.action === `Uploaded Document Revision ${newVersion}` && e.target.kind === 'document',
    );
    expect(revisionEvent).toBeDefined();
    expect(revisionEvent?.fieldDelta?.fieldName).toBe('Version');
    expect(revisionEvent?.fieldDelta?.newValue).toBe(newVersion);
    expect(revisionEvent?.userId).toBe('USR-101');
  });
});
