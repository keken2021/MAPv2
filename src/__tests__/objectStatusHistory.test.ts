/*
  file summary: object status history append and seed coverage (FR-49 / N8).
  responsibilities: asserts seeded history on operational objects and that recordObjectStatusChange appends without duplicates.
  role in system: covers useMapStore.recordObjectStatusChange and assuranceObjectMockData seeding.
*/

import { beforeEach, describe, expect, it } from 'vitest';
import { SEEDED_OPERATIONAL_OBJECTS } from '../store/assuranceObjectMockData';
import { useMapStore } from '../store/useMapStore';

describe('object status history', () => {
  beforeEach(() => {
    useMapStore.setState((state) => ({
      ...state,
      assuranceObjects: structuredClone(state.assuranceObjects),
      auditEvents: [],
    }));
  });

  it('seeds status history on operational assurance objects', () => {
    const storeObjects = useMapStore.getState().assuranceObjects;
    SEEDED_OPERATIONAL_OBJECTS.forEach((seed) => {
      const live = storeObjects.find((object) => object.id === seed.id);
      expect(live?.statusHistory?.length).toBeGreaterThan(0);
      expect(live?.statusHistory?.[0].newStatus).toBe('Uploaded');
    });
  });

  it('appends a status change and records an audit event', () => {
    const targetId = SEEDED_OPERATIONAL_OBJECTS[0].id;
    const before = useMapStore.getState().assuranceObjects.find((object) => object.id === targetId);
    const priorCount = before?.statusHistory?.length || 0;

    const res = useMapStore.getState().recordObjectStatusChange(
      targetId,
      'Internally verified',
      'A. Okonkwo',
      { note: 'Client self-check complete', clientOrganization: 'Oil Company' },
    );
    expect(res.success).toBe(true);

    const after = useMapStore.getState().assuranceObjects.find((object) => object.id === targetId);
    expect(after?.statusHistory?.length).toBe(priorCount + 1);
    const last = after?.statusHistory?.[after.statusHistory.length - 1];
    expect(last?.newStatus).toBe('Internally verified');
    expect(last?.changedBy).toBe('A. Okonkwo');
    expect(last?.note).toBe('Client self-check complete');

    const audit = useMapStore.getState().auditEvents.find((event) => event.action === 'Object Status Changed');
    expect(audit?.targetAsset).toBe(targetId);
  });

  it('skips appending when the new status matches the latest entry', () => {
    const targetId = SEEDED_OPERATIONAL_OBJECTS[0].id;
    useMapStore.getState().recordObjectStatusChange(targetId, 'Externally verified', 'Verifier');
    const mid = useMapStore.getState().assuranceObjects.find((object) => object.id === targetId);
    const midCount = mid?.statusHistory?.length || 0;

    const again = useMapStore.getState().recordObjectStatusChange(targetId, 'Externally verified', 'Verifier');
    expect(again.success).toBe(true);

    const after = useMapStore.getState().assuranceObjects.find((object) => object.id === targetId);
    expect(after?.statusHistory?.length).toBe(midCount);
  });
});
