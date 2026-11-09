import { describe, expect, it } from 'vitest';
import {
  ASSURANCE_SET_STATUS_RULES,
  compareAssuranceSetStage,
  compareWorstFirst,
  getAssuranceSetStatus,
  getNextExpiry,
  getPartyRoles,
} from '../utils/assuranceSetStatus';
import { useMapStore } from '../store/useMapStore';
import type { AssuranceRequirement, AssuranceSet } from '../types/assurance';
import type { CapaItem } from '../types/capa';
import type { MasterDocument } from '../types/document';

const TODAY = new Date('2026-11-02T12:00:00');

function task(overrides: Partial<AssuranceRequirement> = {}): AssuranceRequirement {
  return {
    id: 'R1',
    category: 'Statutory Certificate',
    title: 'Safety Certificate',
    isMandatory: true,
    isFulfilled: true,
    ocrConfidence: 100,
    verifierStatus: 'Verified',
    ...overrides,
  } as AssuranceRequirement;
}

function set(overrides: Partial<AssuranceSet> = {}): AssuranceSet {
  return {
    id: 'AS-1',
    title: 'Test set',
    vesselId: 'V-1',
    vesselName: 'MV Test',
    imoNumber: '1',
    initiatorOrg: 'Client Co',
    initiatorRole: 'Client Admin',
    charterWindowStart: '2026-01-01',
    charterWindowEnd: '2026-12-01',
    complianceDeadline: '2026-12-01',
    stage: 'Approved',
    approverDecision: 'Approved',
    readinessScore: 100,
    requirements: [task()],
    mandatoryInspectionRequired: false,
    inspectionCompleted: false,
    ...overrides,
  } as AssuranceSet;
}

const document = (id: string, expiryDate?: string) => ({ id, expiryDate }) as MasterDocument;

function finding(overrides: Partial<CapaItem> = {}): CapaItem {
  return {
    id: 'F1',
    vesselName: 'MV Test',
    vesselId: 'V-1',
    checklistItemTitle: 'Item',
    title: 'Finding',
    findingDescription: 'A finding',
    owner: 'Owner',
    dueDate: '2026-12-20',
    status: 'Open',
    evidences: [],
    createdDate: '2026-10-01',
    ...overrides,
  };
}

const status = (s: AssuranceSet, documents: MasterDocument[] = [], capa: CapaItem[] = []) =>
  getAssuranceSetStatus(s, documents, capa, TODAY);

describe('status rule', () => {
  it('reads Go and Done for a fully closed set with nothing open', () => {
    const result = status(set());
    expect(result.status).toBe('Go');
    expect(result.attention).toBe('done');
    expect(result.blockingItems).toBe(0);
  });

  it('reads Conditional and On track for an open set that only awaits a stage', () => {
    const result = status(set({ stage: 'Verification', approverDecision: undefined }));
    expect(result.status).toBe('Conditional');
    expect(result.attention).toBe('on_track');
  });

  it.each([
    ['a rejected required task', set({ requirements: [task({ verifierStatus: 'Rejected', isFulfilled: false })] }), [], []],
    ['a correction on a required task', set({ requirements: [task({ verifierStatus: 'Correction Requested', isFulfilled: false })] }), [], []],
    ['a required task past its target date', set({ stage: 'Validation', approverDecision: undefined, requirements: [task({ verifierStatus: 'Pending', isFulfilled: false, targetDate: '2026-10-01' })] }), [], []],
    ['a passed compliance deadline', set({ stage: 'Validation', approverDecision: undefined, complianceDeadline: '2026-10-01' }), [], []],
    ['an approver return', set({ stage: 'Approval', approverDecision: 'Returned for Correction' }), [], []],
    ['an expired required certificate', set({ requirements: [task({ documentId: 'D1' })] }), [document('D1', '2026-10-01')], []],
    ['a finding that needs rectification', set(), [], [finding({ status: 'Rectification Required' })]],
    ['an unresolved finding past its due date', set(), [], [finding({ dueDate: '2026-10-01' })]],
  ])('reads No-go on %s', (_label, s, documents, capa) => {
    const result = status(s as AssuranceSet, documents as MasterDocument[], capa as CapaItem[]);
    expect(result.status).toBe('No-go');
    expect(result.attention).toBe('needs_attention');
  });

  it.each([
    ['a certificate inside the warning period', set({ charterWindowEnd: '2026-11-10', requirements: [task({ documentId: 'D1' })] }), [document('D1', '2026-12-01')], []],
    ['a certificate that ends before the contract', set({ charterWindowEnd: '2028-01-01', requirements: [task({ documentId: 'D1' })] }), [document('D1', '2027-06-01')], []],
    ['an expired optional certificate', set({ requirements: [task({ isMandatory: false, documentId: 'D1' })] }), [document('D1', '2026-10-01')], []],
    ['an unresolved finding still in date', set(), [], [finding()]],
    ['a partial closure', set({ closureType: 'partial' }), [], []],
  ])('reads Conditional and Needs attention on %s', (_label, s, documents, capa) => {
    const result = status(s as AssuranceSet, documents as MasterDocument[], capa as CapaItem[]);
    expect(result.status).toBe('Conditional');
    expect(result.attention).toBe('needs_attention');
  });

  it('never reads green with one red area, however ready the set is', () => {
    const closed = set({
      readinessScore: 100,
      requirements: [task({ documentId: 'D1' }), task({ id: 'R2', documentId: 'D2' })],
    });
    const documents = [document('D1', '2028-01-01'), document('D2', '2026-10-01')];
    expect(status(closed, documents).status).toBe('No-go');
    expect(status(closed, documents).attention).toBe('needs_attention');
  });

  it('ignores an exempted task', () => {
    const exempted = task({
      verifierStatus: 'Rejected',
      exemption: { reason: 'Waived', grantedBy: 'Client', newDate: '2027-01-01' },
    });
    expect(status(set({ requirements: [exempted] })).status).toBe('Go');
  });

  it('gives a cancelled set no status', () => {
    const result = status(set({ stage: 'Cancelled', approverDecision: undefined }));
    expect(result.status).toBeNull();
    expect(result.attention).toBeNull();
  });

  it('counts blocking items once, keeps findings apart, and says why', () => {
    const result = status(
      set({ stage: 'Approval', approverDecision: 'Rejected', requirements: [task({ verifierStatus: 'Rejected', isFulfilled: false, documentId: 'D1' })] }),
      [document('D1', '2026-10-01')],
      [finding(), finding({ id: 'F2', status: 'Rectification Required' })],
    );
    expect(result.blockingItems).toBe(2);
    expect(result.openFindings).toBe(2);
    expect(result.blockingFindings).toBe(1);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('keeps the warning period in the rules block', () => {
    expect(ASSURANCE_SET_STATUS_RULES.expirySoonDays).toBe(90);
  });
});

describe('next expiry', () => {
  it('picks the nearest date across certificates and inspection reports', () => {
    const s = set({
      requirements: [
        task({ documentId: 'D1' }),
        task({ id: 'R2', title: 'Inspection report', inspectionReport: { source: 'Other', reportDate: '2026-01-15', validityMonths: 6 } }),
      ],
    });
    const next = getNextExpiry(s, [document('D1', '2027-05-01')]);
    expect(next?.label).toBe('Inspection report');
    expect(next?.date).toBe('2026-07-15');
  });

  it('returns undefined when no date is recorded', () => {
    expect(getNextExpiry(set(), [])).toBeUndefined();
  });
});

describe('party roles', () => {
  it('shows both roles when one organization is client and provider', () => {
    const s = set({ clientOrg: 'Northwind Marine', serviceProviderOrg: 'Northwind Marine' });
    expect(getPartyRoles(s, { organization: 'Northwind Marine' }).roles).toEqual(['client', 'provider']);
  });

  it('reads the set parties and lists the others', () => {
    const s = set({
      parties: [
        { organization: 'Oil Co', group: 'Client' },
        { organization: 'Vendor Co', group: 'Vendor' },
        { organization: 'Review Co', group: 'Third party' },
      ],
    });
    expect(getPartyRoles(s, { organization: 'Review Co' }).roles).toEqual(['reviewing']);
    expect(getPartyRoles(s, { organization: 'Review Co' }).otherParties).toEqual(expect.arrayContaining(['Oil Co', 'Vendor Co']));
  });

  it('reads Reviewing from the named reviewer of the set', () => {
    const s = set({ clientOrg: 'Oil Co', assignedVerifier: 'A. Fontaine (Bureau Veritas)' });
    expect(getPartyRoles(s, { organization: 'Elsewhere', name: 'A. Fontaine' }).roles).toEqual(['reviewing']);
  });
});

describe('order', () => {
  const row = (id: string, s: 'No-go' | 'Conditional' | 'Go' | null, readiness: number) => ({
    set: set({ id }),
    status: s,
    readiness,
  });

  it('puts No-go first, then Conditional, Go and no status, least ready first in a group', () => {
    const rows = [row('D', 'Go', 100), row('C', 'Conditional', 40), row('A', 'No-go', 80), row('B', 'No-go', 10), row('E', null, 0)];
    expect([...rows].sort(compareWorstFirst).map((r) => r.set.id)).toEqual(['B', 'A', 'C', 'D', 'E']);
  });

  it('orders stages along the pipeline', () => {
    expect(compareAssuranceSetStage('Initiated', 'Approval')).toBeLessThan(0);
    expect(compareAssuranceSetStage('Certified', 'Verification')).toBeGreaterThan(0);
  });
});

describe('optional tasks closed as not done at set close', () => {
  it('closes open optional tasks as Not Done and logs audit events when a set is approved or partially closed, while open mandatory tasks block closure', () => {
    const initialSets = useMapStore.getState().assuranceSets;
    const initialEvents = useMapStore.getState().auditEvents;

    try {
      const testSet: AssuranceSet = set({
        id: 'AS-CLOSE-OPT-01',
        stage: 'Approval',
        approverDecision: undefined,
        readinessScore: 70,
        requirements: [
          task({ id: 'REQ-MAND-1', title: 'Mandatory Class Cert', isMandatory: true, isFulfilled: false, verifierStatus: 'Pending' }),
          task({ id: 'REQ-OPT-1', title: 'Optional Tug Bollard Pull Note', isMandatory: false, isFulfilled: false, verifierStatus: 'Pending' }),
        ],
      });

      useMapStore.setState({ assuranceSets: [testSet, ...initialSets] });

      /* open mandatory task blocks both partial closure and approver closure */
      const blockedPartial = useMapStore.getState().partiallyCloseAssuranceSet('AS-CLOSE-OPT-01', 'Client Admin');
      expect(blockedPartial.success).toBe(false);

      useMapStore.getState().setApproverDecision('AS-CLOSE-OPT-01', 'Approved', 'Attempted early approval');
      const stillOpen = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-CLOSE-OPT-01')!;
      expect(stillOpen.approverDecision).toBeUndefined();
      expect(stillOpen.requirements.find((r) => r.id === 'REQ-OPT-1')?.verifierStatus).toBe('Pending');

      /* verify the mandatory task, leaving the optional task open */
      useMapStore.setState({
        assuranceSets: useMapStore.getState().assuranceSets.map((s) =>
          s.id === 'AS-CLOSE-OPT-01'
            ? {
                ...s,
                requirements: s.requirements.map((r) =>
                  r.id === 'REQ-MAND-1' ? { ...r, verifierStatus: 'Verified', isFulfilled: true, documentId: 'DOC-1' } : r,
                ),
              }
            : s,
        ),
      });

      useMapStore.getState().setApproverDecision('AS-CLOSE-OPT-01', 'Approved', 'Approved with optional open');
      const closedSet = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-CLOSE-OPT-01')!;
      expect(closedSet.approverDecision).toBe('Approved');
      expect(closedSet.stage).toBe('Approved');

      const closedOpt = closedSet.requirements.find((r) => r.id === 'REQ-OPT-1')!;
      expect(closedOpt.verifierStatus).toBe('Not Done');
      expect(closedOpt.isFulfilled).toBe(false);
      expect(closedOpt.notes).toBe('Closed as not done upon set closure.');

      const notDoneAudit = useMapStore.getState().auditEvents.find(
        (e) =>
          e.action === 'Task Closed - Not Done' &&
          e.target.kind === 'set' &&
          e.target.setId === 'AS-CLOSE-OPT-01' &&
          e.target.requirementId === 'REQ-OPT-1',
      );
      expect(notDoneAudit).toBeDefined();
    } finally {
      useMapStore.setState({ assuranceSets: initialSets, auditEvents: initialEvents });
    }
  });
});
