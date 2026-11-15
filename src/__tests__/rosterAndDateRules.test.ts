import { describe, expect, it, beforeEach } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import {
  OIL_CO_ORG,
  NORTHWIND_ORG,
  OIL_CO_LNG_PROJECT_ID,
  OIL_CO_PILOT_PROJECT,
} from '../store/oilCoLngPilotMockData';
import { UserProfile } from '../types/user';
import { getAssuranceSetRequestRecipients, getRequestRosterObjects } from '../utils/assuranceRequestHelpers';
import { AssuranceSet } from '../types/assurance';

const aOkonkwo: UserProfile = {
  id: 'USR-OIL-ADMIN',
  name: 'A. Okonkwo',
  email: 'a.okonkwo@oilcompany.example.com',
  roles: ['C Admin', 'Administrator'],
  userType: 'Organization',
  organization: OIL_CO_ORG,
  departmentOrScope: 'Operations',
  status: 'Active',
  lastActive: '2026-11-15 00:00 UTC',
};

const tOkada: UserProfile = {
  id: 'USR-NW-ADMIN',
  name: 'T. Okada',
  email: 't.okada@northwind.example.com',
  roles: ['Administrator'],
  userType: 'Organization',
  organization: NORTHWIND_ORG,
  departmentOrScope: 'Fleet',
  status: 'Active',
  lastActive: '2026-11-15 00:00 UTC',
};

const extAdmin: UserProfile = {
  id: 'USR-EXT-ADMIN',
  name: 'E. Admin',
  email: 'e.admin@external.example.com',
  roles: ['Administrator'],
  userType: 'Organization',
  organization: 'External Logistics Inc',
  departmentOrScope: 'Admin',
  status: 'Active',
  lastActive: '2026-11-15 00:00 UTC',
};

describe('Roster Modification Permission (Rule 9)', () => {
  beforeEach(() => {
    useMapStore.setState({
      projects: [OIL_CO_PILOT_PROJECT],
      users: [...useMapStore.getState().users, aOkonkwo, tOkada, extAdmin],
      auditEvents: [],
    });
  });

  it('allows project client (A. Okonkwo, Oil Company) to add and remove a roster asset', () => {
    useMapStore.setState({
      activePersona: 'C Admin',
      activeDemoOrganization: OIL_CO_ORG,
      activeSessionUserId: aOkonkwo.id,
    });

    const store = useMapStore.getState();
    const initialCount = store.projects[0].assetLinks.length;

    const addRes = store.addAssetToProject(OIL_CO_LNG_PROJECT_ID, {
      assetType: 'Vessel',
      assetId: 'VES-NEW-TEST',
      assetName: 'New Test Vessel',
      providerOrganization: OIL_CO_ORG,
      roleInProject: 'Support',
    });

    expect(addRes.success).toBe(true);
    const afterAdd = useMapStore.getState().projects[0];
    expect(afterAdd.assetLinks).toHaveLength(initialCount + 1);
    const addedLink = afterAdd.assetLinks.find((l) => l.assetId === 'VES-NEW-TEST');
    expect(addedLink).toBeDefined();

    const removeRes = useMapStore.getState().removeAssetFromProject(OIL_CO_LNG_PROJECT_ID, addedLink!.id);
    expect(removeRes?.success).toBe(true);
    const afterRemove = useMapStore.getState().projects[0];
    expect(afterRemove.assetLinks).toHaveLength(initialCount);
  });

  it('rejects roster modifications from a non-client vendor on the project (T. Okada, Northwind)', () => {
    useMapStore.setState({
      activePersona: 'Administrator',
      activeDemoOrganization: NORTHWIND_ORG,
      activeSessionUserId: tOkada.id,
    });

    const store = useMapStore.getState();
    const initialLinks = [...store.projects[0].assetLinks];

    const addRes = store.addAssetToProject(OIL_CO_LNG_PROJECT_ID, {
      assetType: 'Vessel',
      assetId: 'VES-UNAUTHORIZED-1',
      assetName: 'Unauthorized Vessel',
      providerOrganization: NORTHWIND_ORG,
    });

    expect(addRes.success).toBe(false);
    expect(addRes.message).toContain('Only the project\'s client organization may add roster assets');
    expect(useMapStore.getState().projects[0].assetLinks).toEqual(initialLinks);

    const firstLinkId = initialLinks[0].id;
    const removeRes = store.removeAssetFromProject(OIL_CO_LNG_PROJECT_ID, firstLinkId);
    expect(removeRes?.success).toBe(false);
    expect(removeRes?.message).toContain('Only the project\'s client organization may remove roster assets');
    expect(useMapStore.getState().projects[0].assetLinks).toEqual(initialLinks);
  });

  it('rejects roster modifications from an external administrator', () => {
    useMapStore.setState({
      activePersona: 'Administrator',
      activeDemoOrganization: 'External Logistics Inc',
      activeSessionUserId: extAdmin.id,
    });

    const store = useMapStore.getState();
    const addRes = store.addAssetToProject(OIL_CO_LNG_PROJECT_ID, {
      assetType: 'Vessel',
      assetId: 'VES-EXT-1',
      assetName: 'External Vessel',
      providerOrganization: 'External Logistics Inc',
    });

    expect(addRes.success).toBe(false);
  });
});

describe('Project Link Date Adjustment (Rule 2)', () => {
  const project = OIL_CO_PILOT_PROJECT; // window: 2026-11-01 to 2027-12-31

  const baseSet: AssuranceSet = {
    id: 'AS-TEST-DATES',
    title: 'Date Test Set',
    startDate: '2026-11-15',
    endDate: '2027-06-01',
    deadline: '2026-11-10',
    stage: 'Initiated',
    readinessScore: 0,
    mandatoryInspectionRequired: false,
    inspectionCompleted: false,
    assuranceObjects: [
      {
        id: 'VES-TEST-DATE',
        type: 'vessel',
        name: 'Date Test Vessel',
        ownerOrganization: OIL_CO_ORG,
        identifier: 'IMO-0000000',
      },
    ],
    createdBy: {
      userId: aOkonkwo.id,
      name: aOkonkwo.name,
      persona: 'C Admin',
    },
    requirements: [],
    parties: [
      { organization: OIL_CO_ORG, role: 'Requesting party' },
      { organization: OIL_CO_ORG, role: 'Responding party' },
    ],
  };

  beforeEach(() => {
    useMapStore.setState({
      projects: [project],
      assuranceSets: [baseSet],
      vessels: [{ id: 'VES-TEST-DATE', name: 'Date Test Vessel', imoNumber: 'IMO-0000000', status: 'Available for Charter', owner: OIL_CO_ORG } as any],
      users: [aOkonkwo],
      activePersona: 'C Admin',
      activeDemoOrganization: OIL_CO_ORG,
      activeSessionUserId: aOkonkwo.id,
      auditEvents: [],
    });
  });

  it('attaches without adjusting dates when already inside project window', () => {
    const res = useMapStore.getState().attachAssuranceSetToProject('AS-TEST-DATES', OIL_CO_LNG_PROJECT_ID);
    expect(res.success).toBe(true);
    const updated = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-TEST-DATES');
    expect(updated?.startDate).toBe('2026-11-15');
    expect(updated?.endDate).toBe('2027-06-01');
    expect(updated?.deadline).toBe('2026-11-10');
    expect(useMapStore.getState().auditEvents.some((e) => e.action === 'Adjusted Assurance Set Dates to Project Window')).toBe(false);
  });

  it('clamps overlapping dates and moves compliance deadline on or before new start', () => {
    useMapStore.setState({
      assuranceSets: [
        {
          ...baseSet,
          startDate: '2026-08-01', // before project start (2026-11-01)
          endDate: '2028-06-01',   // after project end (2027-12-31)
          deadline: '2026-11-15', // after clamped start (2026-11-01)
        },
      ],
    });

    const res = useMapStore.getState().attachAssuranceSetToProject('AS-TEST-DATES', OIL_CO_LNG_PROJECT_ID);
    expect(res.success).toBe(true);

    const updated = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-TEST-DATES');
    expect(updated?.startDate).toBe('2026-11-01');
    expect(updated?.endDate).toBe('2027-12-31');
    expect(updated?.deadline).toBe('2026-11-01'); // clamped to new start

    const dateHistory = updated?.dateHistory;
    expect(dateHistory).toBeDefined();
    expect(dateHistory?.length).toBe(3);

    const auditEvents = useMapStore.getState().auditEvents;
    expect(auditEvents.filter((e) => e.action === 'Adjusted Assurance Set Dates to Project Window')).toHaveLength(3);
  });

  it('clamps fully outside dates into project window', () => {
    useMapStore.setState({
      assuranceSets: [
        {
          ...baseSet,
          startDate: '2025-01-01',
          endDate: '2025-06-01',
          deadline: '2024-12-31',
        },
      ],
    });

    const res = useMapStore.getState().attachAssuranceSetToProject('AS-TEST-DATES', OIL_CO_LNG_PROJECT_ID);
    expect(res.success).toBe(true);

    const updated = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-TEST-DATES');
    expect(updated?.startDate).toBe('2026-11-01');
    expect(updated?.endDate).toBe('2026-11-01');
    expect(updated?.deadline).toBe('2024-12-31'); // already <= 2026-11-01
  });
});

describe('In-Project Requests (Rule 5)', () => {
  it('allows any organization on the project to request a set from any other organization on it, including project client', () => {
    const users = [aOkonkwo, tOkada];
    const project = OIL_CO_PILOT_PROJECT;

    // Northwind requests from Oil Company (project client)
    const nwRecipients = getAssuranceSetRequestRecipients(users, project, NORTHWIND_ORG, tOkada.id);
    expect(nwRecipients.some((u) => u.organization === OIL_CO_ORG && u.id === aOkonkwo.id)).toBe(true);

    // Request form offers only recipient roster assets (Oil Company's roster assets)
    const rosterForOilCo = getRequestRosterObjects(project, OIL_CO_ORG);
    expect(rosterForOilCo.every((link) => link.providerOrganization === OIL_CO_ORG)).toBe(true);
    expect(rosterForOilCo.some((link) => link.assetId === 'VES-OILCO-BUNKER-BARGE')).toBe(true);
    expect(rosterForOilCo.some((link) => link.assetName.includes('Northwind'))).toBe(false);
  });
});
