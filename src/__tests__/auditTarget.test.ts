/*
  file summary: tests that audit events store structured targets covering domain entities, and that closing a finding records the closed date.
  responsibilities: covers date changes, task edits, exports, finding closure, target formatting, target inference, and target search.
  role in system: covers src/types/audit.ts and src/store/useMapStore.ts.
*/

import { beforeEach, describe, expect, it } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet } from '../types/assurance';
import {
  AuditEventTarget,
  AuditTrailEvent,
  auditEventMatchesSearch,
  formatAuditTarget,
  inferAuditTarget,
} from '../types/audit';

const initialState = useMapStore.getState();

describe('audit targets and finding closed date', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
  });

  it('stores a structured target on every seeded audit event', () => {
    const validKinds: AuditEventTarget['kind'][] = [
      'set',
      'stage',
      'object',
      'requirement',
      'document',
      'task',
      'stakeholder',
      'party',
      'finding',
      'date',
    ];
    for (const event of useMapStore.getState().auditEvents) {
      expect(validKinds).toContain(event.target.kind);
      expect(event.target.setId.length).toBeGreaterThan(0);
      if (event.target.kind === 'task') {
        expect(event.target.taskId.length).toBeGreaterThan(0);
      }
      if (event.target.kind === 'date') {
        expect(event.target.dateField.length).toBeGreaterThan(0);
      }
      if (event.targetAsset.includes('AS-2026-005')) {
        expect(event.target.setId).toBe('AS-2026-005');
      }
    }
  });

  it('records a date change, a task edit and an export with a structured target', () => {
    useMapStore.setState({
      activePersona: 'C Admin',
      activeDemoOrganization: 'Chevron Australia Pty Ltd',
      activeSessionUserId: 'USR-221',
    });
    const store = useMapStore.getState();
    const set = store.assuranceSets.find((item) => item.requirements.length > 0);
    expect(set).toBeDefined();
    const current = set as AssuranceSet;
    const task = current.requirements[0];

    const nextDeadline = current.complianceDeadline === '2027-01-15' ? '2027-02-15' : '2027-01-15';
    store.updateAssuranceSet({
      ...current,
      complianceDeadline: nextDeadline,
      requirements: current.requirements.map((item) =>
        item.id === task.id ? { ...item, title: `${item.title} revised` } : item,
      ),
    });
    store.logExport({
      screen: 'Audit trail',
      format: 'CSV',
      setId: current.id,
      detail: '1 event',
    });

    const events = useMapStore.getState().auditEvents;
    const dateChange = events.find((event) => event.action === 'Changed date');
    const taskEdit = events.find((event) => event.action === 'Edited task');
    const exported = events.find((event) => event.action === 'Exported data');

    expect(dateChange?.target).toEqual({
      kind: 'date',
      setId: current.id,
      dateField: 'complianceDeadline',
    });
    expect(dateChange?.fieldDelta?.newValue).toBe(nextDeadline);
    expect(taskEdit?.target).toEqual({
      kind: 'task',
      setId: current.id,
      taskId: task.id,
    });
    expect(exported?.target).toEqual({ kind: 'set', setId: current.id });
  });

  it('records an added task and a removed task', () => {
    useMapStore.setState({
      activePersona: 'C Admin',
      activeDemoOrganization: 'Chevron Australia Pty Ltd',
      activeSessionUserId: 'USR-221',
    });
    const store = useMapStore.getState();
    const set = store.assuranceSets.find((item) => item.requirements.length > 0) as AssuranceSet;
    const kept = set.requirements[0];
    const addedId = `${set.id}-TASK-NEW`;

    store.updateAssuranceSet({
      ...set,
      requirements: [
        ...set.requirements.slice(1),
        {
          id: addedId,
          category: 'Custom Requirement',
          title: 'Berthing procedure',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 0,
          verifierStatus: 'Pending',
        },
      ],
    });

    const events = useMapStore.getState().auditEvents;
    expect(events.find((event) => event.action === 'Added task')?.target).toEqual({
      kind: 'task',
      setId: set.id,
      taskId: addedId,
    });
    expect(events.find((event) => event.action === 'Removed task')?.target).toEqual({
      kind: 'task',
      setId: set.id,
      taskId: kept.id,
    });
  });

  it('sets the closed date when a finding is closed and clears it when the finding is opened', () => {
    useMapStore.setState({
      activePersona: 'Inspector',
      activeDemoOrganization: 'Bureau Veritas Inspectorate',
      activeSessionUserId: 'USR-203',
    });
    const openFinding = useMapStore.getState().capaItems.find((item) => item.status === 'Open');
    expect(openFinding).toBeDefined();
    expect(openFinding?.closedDate).toBeUndefined();

    useMapStore.getState().updateCapaStatus(openFinding!.id, 'Verified & Closed', 'Rectified.');

    const closed = useMapStore.getState().capaItems.find((item) => item.id === openFinding!.id);
    expect(closed?.status).toBe('Verified & Closed');
    expect(closed?.closedDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const closeEvent = useMapStore.getState().auditEvents.find((event) => event.action === 'Closed finding');
    expect(closeEvent?.target.kind).toBe('date');
    if (closeEvent?.target.kind === 'date') {
      expect(closeEvent.target.dateField).toBe('closedDate');
      expect(closeEvent.target.setId.length).toBeGreaterThan(0);
    }

    useMapStore.getState().updateCapaStatus(openFinding!.id, 'Open');
    const reopened = useMapStore.getState().capaItems.find((item) => item.id === openFinding!.id);
    expect(reopened?.closedDate).toBeUndefined();
  });

  it('keeps a closed date already stored on a seeded finding', () => {
    const closed = useMapStore.getState().capaItems.find((item) => item.id === 'CAPA-114');
    expect(closed?.status).toBe('Verified & Closed');
    expect(closed?.closedDate).toBe('2026-09-15T03:05:00.000Z');
  });

  describe('formatAuditTarget with all 10 domain entity kinds', () => {
    it('formats set target', () => {
      expect(formatAuditTarget({ kind: 'set', setId: 'AS-2026-001' })).toBe('Set AS-2026-001');
      expect(formatAuditTarget({ kind: 'set', setId: 'multiple' })).toBe('Several sets');
    });

    it('formats stage target', () => {
      expect(formatAuditTarget({ kind: 'stage', setId: 'AS-2026-001', stage: 'Planning' })).toBe(
        'Stage Planning · Set AS-2026-001',
      );
    });

    it('formats object target', () => {
      expect(
        formatAuditTarget({
          kind: 'object',
          setId: 'AS-2026-001',
          objectId: 'VESSEL-001',
          objectName: 'Pacific Pioneer',
        }),
      ).toBe('Object VESSEL-001 · Set AS-2026-001');
    });

    it('formats requirement target', () => {
      expect(
        formatAuditTarget({
          kind: 'requirement',
          setId: 'AS-2026-001',
          requirementId: 'REQ-001',
          title: 'Hull Inspection',
        }),
      ).toBe('Requirement REQ-001 · Set AS-2026-001');
    });

    it('formats document target with and without version', () => {
      expect(
        formatAuditTarget({
          kind: 'document',
          setId: 'AS-2026-001',
          documentId: 'DOC-501',
          version: 'v2.1',
        }),
      ).toBe('Document DOC-501 (v2.1) · Set AS-2026-001');

      expect(
        formatAuditTarget({
          kind: 'document',
          setId: 'AS-2026-001',
          documentId: 'DOC-501',
        }),
      ).toBe('Document DOC-501 · Set AS-2026-001');
    });

    it('formats task target', () => {
      expect(formatAuditTarget({ kind: 'task', setId: 'AS-2026-001', taskId: 'TASK-101' })).toBe(
        'Task TASK-101 · Set AS-2026-001',
      );
    });

    it('formats stakeholder target with role and userId', () => {
      expect(
        formatAuditTarget({
          kind: 'stakeholder',
          setId: 'AS-2026-001',
          userId: 'USR-004',
          role: 'Verifier',
        }),
      ).toBe('Stakeholder Verifier · USR-004 · Set AS-2026-001');

      expect(
        formatAuditTarget({
          kind: 'stakeholder',
          setId: 'AS-2026-001',
        }),
      ).toBe('Stakeholder · Set AS-2026-001');
    });

    it('formats party target with organization and partyRole', () => {
      expect(
        formatAuditTarget({
          kind: 'party',
          setId: 'AS-2026-001',
          organization: 'North Sea Marine',
          partyRole: 'Service Provider',
        }),
      ).toBe('Party North Sea Marine · Service Provider · Set AS-2026-001');

      expect(
        formatAuditTarget({
          kind: 'party',
          setId: 'AS-2026-001',
        }),
      ).toBe('Party · Set AS-2026-001');
    });

    it('formats finding target', () => {
      expect(formatAuditTarget({ kind: 'finding', setId: 'AS-2026-001', findingId: 'CAPA-108' })).toBe(
        'Finding CAPA-108 · Set AS-2026-001',
      );
    });

    it('formats date target with and without taskId', () => {
      expect(
        formatAuditTarget({
          kind: 'date',
          setId: 'AS-2026-001',
          dateField: 'complianceDeadline',
          taskId: 'TASK-001',
        }),
      ).toBe('Date Compliance deadline · Task TASK-001 · Set AS-2026-001');

      expect(
        formatAuditTarget({
          kind: 'date',
          setId: 'AS-2026-001',
          dateField: 'closedDate',
        }),
      ).toBe('Date Closed date · Set AS-2026-001');
    });
  });

  describe('inferAuditTarget for exhaustive domain entities', () => {
    it('infers stage target', () => {
      const target = inferAuditTarget({
        action: 'Transitioned stage',
        targetAsset: 'AS-2026-001',
        fieldDelta: { fieldName: 'stage', oldValue: 'Planning', newValue: 'Active' },
      });
      expect(target).toEqual({ kind: 'stage', setId: 'AS-2026-001', stage: 'Active' });
    });

    it('infers finding target', () => {
      const target = inferAuditTarget({
        action: 'Logged finding CAPA-201',
        targetAsset: 'AS-2026-001 CAPA-201',
      });
      expect(target).toEqual({ kind: 'finding', setId: 'AS-2026-001', findingId: 'CAPA-201' });
    });

    it('infers document target', () => {
      const target = inferAuditTarget({
        action: 'Uploaded document v1.0',
        targetAsset: 'AS-2026-001 MAP-DOC-001 v1.0',
        documentStatusDelta: { documentId: 'MAP-DOC-001', newStatus: 'Submitted' },
      });
      expect(target).toEqual({
        kind: 'document',
        setId: 'AS-2026-001',
        documentId: 'MAP-DOC-001',
        version: 'v1.0',
      });
    });

    it('infers requirement target', () => {
      const target = inferAuditTarget({
        action: 'Updated requirement',
        targetAsset: 'AS-2026-001 REQ-402',
      });
      expect(target).toEqual({ kind: 'requirement', setId: 'AS-2026-001', requirementId: 'REQ-402' });
    });

    it('infers stakeholder target', () => {
      const target = inferAuditTarget({
        action: 'Assigned stakeholder Verifier',
        targetAsset: 'AS-2026-001 USR-005',
      });
      expect(target).toEqual({
        kind: 'stakeholder',
        setId: 'AS-2026-001',
        userId: 'USR-005',
        role: 'Verifier',
      });
    });

    it('infers party target', () => {
      const target = inferAuditTarget({
        action: 'Added party service provider',
        targetAsset: 'AS-2026-001 Party Atlantic Ops',
      });
      expect(target).toEqual({
        kind: 'party',
        setId: 'AS-2026-001',
        organization: 'Atlantic Ops',
        partyRole: 'service provider',
      });
    });

    it('infers object target', () => {
      const target = inferAuditTarget({
        action: 'Assigned vessel object',
        targetAsset: 'AS-2026-001 VESSEL-002',
      });
      expect(target).toEqual({ kind: 'object', setId: 'AS-2026-001', objectId: 'VESSEL-002' });
    });
  });

  describe('auditEventMatchesSearch with domain targets', () => {
    const baseEvent: AuditTrailEvent = {
      id: 'AUD-TEST-1',
      timestampUtc: '2026-11-04T10:00:00Z',
      action: 'Updated document',
      targetAsset: 'DOC-901',
      userRole: 'Submitter',
      userId: 'USR-001',
      organization: 'Marine Corp',
      target: {
        kind: 'document',
        setId: 'AS-2026-001',
        documentId: 'DOC-901',
        version: 'v3.0',
      },
    };

    it('matches by documentId and version without fallthrough', () => {
      expect(auditEventMatchesSearch(baseEvent, 'DOC-901')).toBe(true);
      expect(auditEventMatchesSearch(baseEvent, 'v3.0')).toBe(true);
      expect(auditEventMatchesSearch(baseEvent, 'AS-2026-001')).toBe(true);
      expect(auditEventMatchesSearch(baseEvent, 'Marine Corp')).toBe(true);
      expect(auditEventMatchesSearch(baseEvent, 'nonexistent')).toBe(false);
    });

    it('matches finding and stage targets', () => {
      const findingEvent: AuditTrailEvent = {
        ...baseEvent,
        target: { kind: 'finding', setId: 'AS-2026-002', findingId: 'CAPA-999' },
      };
      expect(auditEventMatchesSearch(findingEvent, 'CAPA-999')).toBe(true);
      expect(auditEventMatchesSearch(findingEvent, 'finding')).toBe(true);

      const stageEvent: AuditTrailEvent = {
        ...baseEvent,
        target: { kind: 'stage', setId: 'AS-2026-002', stage: 'Verification' },
      };
      expect(auditEventMatchesSearch(stageEvent, 'Verification')).toBe(true);
    });
  });
});
