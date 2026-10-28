/*
  file summary: contract chain and organization groups on a project and its sets.
  responsibilities: verifies the chain, party groups, value, currency, multi-year dates, and the pending on-hire date.
  role in system: covers projectHelpers.ts, useMapStore.addProject, and the Oil Company LNG seed.
*/

import { beforeEach, describe, expect, it } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import {
  OIL_CO_LNG_PROJECT_ID,
  OIL_CO_ORG,
  OIL_CO_SS01_ID,
  NORTHWIND_ORG,
  MERIDIAN_ORG,
  XY_MARINE_ORG,
} from '../store/oilCoLngPilotMockData';
import {
  buildContractParties,
  contractPartyByRole,
  formatProjectValue,
  setOrganizationParties,
} from '../utils/projectHelpers';

const initialState = useMapStore.getState();

describe('contract chain and organization groups', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
  });

  it('saves the chain, groups, value, and dates, and leaves set dates unchanged', () => {
    const parties = buildContractParties({
      client: 'Oil Company',
      headContractor: 'Northwind Marine Pty Ltd',
      vendor: 'Meridian Shipyards',
      extraParties: [{ organization: 'XY Marine Assurance', group: 'Third party' }],
    });
    expect(contractPartyByRole(parties, 'client')?.organization).toBe('Oil Company');
    expect(contractPartyByRole(parties, 'head_contractor')?.group).toBe('Vendor');
    expect(parties.map((party) => party.group)).toEqual(['Client', 'Vendor', 'Vendor', 'Third party']);

    const before = useMapStore.getState().assuranceSets.find((set) => set.id === OIL_CO_SS01_ID);
    const result = useMapStore.getState().addProject({
      name: 'Contract Chain Test',
      projectType: 'Mixed / Composite',
      requestingOrganization: 'Oil Company',
      clientOperator: 'Oil Company',
      location: 'Aurora LNG Field',
      charterWindowStart: '2026-11-01',
      charterWindowEnd: '2027-12-31',
      operatorOrganization: 'Oil Company',
      contractParties: parties,
      projectValue: 240000000,
      currency: 'AUD',
      multiYearStart: '2026-11-01',
      multiYearEnd: '2029-10-31',
      onHireDate: '2026-11-15',
    });

    expect(result.success).toBe(true);
    const project = useMapStore.getState().projects.find((item) => item.id === result.projectId);
    expect(contractPartyByRole(project?.contractParties, 'vendor')?.organization).toBe('Meridian Shipyards');
    expect(formatProjectValue(project?.projectValue, project?.currency)).toBe('AUD 240,000,000');
    expect(project?.multiYearEnd).toBe('2029-10-31');
    expect(project?.onHireDate).toBe('2026-11-15');

    const after = useMapStore.getState().assuranceSets.find((set) => set.id === OIL_CO_SS01_ID);
    expect(after?.charterWindowStart).toBe(before?.charterWindowStart);
    expect(after?.charterWindowEnd).toBe(before?.charterWindowEnd);
  });

  it('shows the Oil Company LNG chain and each set organization group', () => {
    const project = useMapStore.getState().projects.find((item) => item.id === OIL_CO_LNG_PROJECT_ID);
    expect(contractPartyByRole(project?.contractParties, 'client')?.organization).toBe(OIL_CO_ORG);
    expect(contractPartyByRole(project?.contractParties, 'head_contractor')?.organization).toBe(NORTHWIND_ORG);
    expect(contractPartyByRole(project?.contractParties, 'vendor')?.organization).toBe(MERIDIAN_ORG);
    expect(project?.currency).toBe('AUD');
    expect(project?.onHireDate).toBe('2026-11-15');

    const set = useMapStore.getState().assuranceSets.find((item) => item.id === OIL_CO_SS01_ID);
    expect(setOrganizationParties(set!).map((party) => [party.organization, party.group])).toEqual([
      [OIL_CO_ORG, 'Client'],
      [NORTHWIND_ORG, 'Vendor'],
      [XY_MARINE_ORG, 'Third party'],
    ]);
  });
});
