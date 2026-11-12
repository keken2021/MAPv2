import { beforeEach, describe, expect, it } from 'vitest';
import { MOCK_ASSURANCE_SETS, MOCK_USERS } from '../store/mockData';
import { useMapStore } from '../store/useMapStore';
import { filterAssuranceSetsForSession, getAssuranceSetRoleActions } from '../utils/rbacHelpers';
import { getSessionUserForPersona } from '../utils/userRoleHelpers';
import { isProjectAccessibleToUser } from '../utils/projectHelpers';
import { isOwnUpload } from '../utils/uploadOwnership';
import type { Project } from '../types/project';

/* ADR 0037: S. Girard is Verifier for Bureau Veritas and Inspector for Northwind, kept apart */
const BV = 'Bureau Veritas Inspectorate';
const NW = 'Northwind Marine Pty Ltd';
const BV_SETS = ['AS-2026-002', 'AS-2026-006', 'AS-2026-028', 'AS-2026-029'];
const NW_SET = 'AS-2026-010';

const sessionUser = (persona: 'Verifier' | 'Inspector', organization: string) =>
  getSessionUserForPersona(persona, MOCK_USERS, { organization })!;

const initialState = useMapStore.getState();

describe('organization separation for a person in two organizations', () => {
  beforeEach(() => useMapStore.setState(initialState, true));

  it('picks S. Girard in both organizations, as two different records', () => {
    const bv = sessionUser('Verifier', BV);
    const nw = sessionUser('Inspector', NW);
    expect(bv.id).toBe('USR-244');
    expect(nw.id).toBe('USR-250');
  });

  it('with Bureau Veritas active, she sees and can verify her Bureau Veritas sets and not her Northwind set', () => {
    const bv = sessionUser('Verifier', BV);
    const visible = filterAssuranceSetsForSession(MOCK_ASSURANCE_SETS, 'Verifier', BV, bv, MOCK_USERS).map((s) => s.id);
    expect(visible).toEqual(expect.arrayContaining(BV_SETS));
    expect(visible).not.toContain(NW_SET);
    const set = MOCK_ASSURANCE_SETS.find((s) => s.id === 'AS-2026-002')!;
    expect(getAssuranceSetRoleActions(set, 'Verifier', BV, bv).canVerify).toBe(true);
  });

  it('with Northwind active, she sees her Northwind set only, and none of the Bureau Veritas ones', () => {
    const nw = sessionUser('Inspector', NW);
    const visible = filterAssuranceSetsForSession(MOCK_ASSURANCE_SETS, 'Inspector', NW, nw, MOCK_USERS).map((s) => s.id);
    expect(visible).toEqual([NW_SET]);
    for (const id of BV_SETS) {
      const set = MOCK_ASSURANCE_SETS.find((s) => s.id === id)!;
      expect(filterAssuranceSetsForSession([set], 'Verifier', NW, nw, MOCK_USERS)).toEqual([]);
    }
  });

  it('keeps notifications with the membership they were sent to', () => {
    const notifications = useMapStore.getState().notifications;
    const forBv = notifications.filter((n) => n.recipientUserId === 'USR-244');
    expect(forBv.every((n) => n.recipientUserId !== 'USR-250')).toBe(true);
    useMapStore.getState().pushNotification({
      type: 'review_requested',
      subject: 'Review',
      recipientUserId: 'USR-244',
      assuranceSetId: 'AS-2026-002',
    } as Parameters<ReturnType<typeof useMapStore.getState>['pushNotification']>[0]);
    const after = useMapStore.getState().notifications;
    expect(after.filter((n) => n.recipientUserId === 'USR-250' && n.assuranceSetId === 'AS-2026-002')).toEqual([]);
    expect(after.some((n) => n.recipientUserId === 'USR-244' && n.assuranceSetId === 'AS-2026-002')).toBe(true);
  });

  it('does not treat a Bureau Veritas upload as hers while Northwind is active', () => {
    const upload = { uploadedBy: 'S. Girard', uploadedByUserId: 'USR-244' };
    expect(isOwnUpload(upload, sessionUser('Verifier', BV))).toBe(true);
    expect(isOwnUpload(upload, sessionUser('Inspector', NW))).toBe(false);
  });

  it('gives project access only through the membership named on a child set', () => {
    const projectWith = (setId: string): Project =>
      ({
        id: 'P-T',
        name: 'T',
        assetLinks: [{ id: 'L1', projectId: 'P-T', assetType: 'Vessel', assetId: 'V', assetName: 'V', providerOrganization: NW, assuranceSetId: setId, addedAt: '', addedByPersona: 'C Admin' }],
        stakeholderUserIds: [],
      }) as unknown as Project;
    const sets = MOCK_ASSURANCE_SETS;
    const nw = sessionUser('Inspector', NW);
    const bv = sessionUser('Verifier', BV);
    expect(isProjectAccessibleToUser(projectWith('AS-2026-002'), 'Inspector', MOCK_USERS, sets, NW, nw)).toBe(false);
    expect(isProjectAccessibleToUser(projectWith('AS-2026-002'), 'Verifier', MOCK_USERS, sets, BV, bv)).toBe(true);
  });
});
