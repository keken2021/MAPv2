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
});
