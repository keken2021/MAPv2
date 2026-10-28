/*
  file summary: tests that audit events store a set, task or date target, and that closing a finding records the closed date.
  responsibilities: covers date changes, task edits, exports and finding closure.
  role in system: covers src/types/audit.ts and src/store/useMapStore.ts.
*/

import { beforeEach, describe, expect, it } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet } from '../types/assurance';

const initialState = useMapStore.getState();

describe('audit targets and finding closed date', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
  });

  it('stores a structured target on every seeded audit event', () => {
    for (const event of useMapStore.getState().auditEvents) {
      expect(['set', 'task', 'date']).toContain(event.target.kind);
      expect(event.target.setId.length).toBeGreaterThan(0);
      if (event.target.kind === 'task') {
        expect(event.target.taskId.length).toBeGreaterThan(0);
      }
      if (event.target.kind === 'date') {
        expect(event.target.dateField.length).toBeGreaterThan(0);
      }
      if (event.targetAsset.includes('AS-2026-005')) {
        expect(event.target).toEqual({ kind: 'set', setId: 'AS-2026-005' });
      }
    }
  });

  it('records a date change, a task edit and an export with a structured target', () => {
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
});
