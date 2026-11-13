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
  canEditProjectOrganizations,
  replaceChainParty,
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
      ['NOPSEMA', 'Third party'],
    ]);
  });
});

describe('canEditProjectOrganizations', () => {
  const project = {
    ownerOrganization: 'Oil Company',
    requestingOrganization: 'Oil Company',
    charterer: 'Oil Company',
  };

  it('client Administrator -> true', () => {
    expect(canEditProjectOrganizations(project, 'Administrator', 'Oil Company')).toBe(true);
    expect(canEditProjectOrganizations(project, 'C Admin', 'Oil Company')).toBe(true);
    expect(canEditProjectOrganizations(project, 'Administrator', 'oil company')).toBe(true);
  });

  it('vendor Administrator -> false', () => {
    expect(canEditProjectOrganizations(project, 'Administrator', 'Northwind Marine Pty Ltd')).toBe(false);
    expect(canEditProjectOrganizations(project, 'C Admin', 'Meridian Shipyards')).toBe(false);
  });

  it('Submitter -> false', () => {
    expect(canEditProjectOrganizations(project, 'Submitter', 'Oil Company')).toBe(false);
    expect(canEditProjectOrganizations(project, 'Verifier', 'Oil Company')).toBe(false);
    expect(canEditProjectOrganizations(project, 'Inspector', 'Oil Company')).toBe(false);
    expect(canEditProjectOrganizations(project, 'Approver', 'Oil Company')).toBe(false);
  });

  it('empty organization -> false', () => {
    expect(canEditProjectOrganizations(project, 'Administrator', '')).toBe(false);
    expect(canEditProjectOrganizations(project, 'Administrator', '   ')).toBe(false);
    expect(canEditProjectOrganizations(project, 'Administrator', undefined)).toBe(false);
    expect(canEditProjectOrganizations({ ownerOrganization: '', requestingOrganization: '' }, 'Administrator', 'Oil Company')).toBe(false);
    expect(canEditProjectOrganizations(null, 'Administrator', 'Oil Company')).toBe(false);
    expect(canEditProjectOrganizations(project, undefined, 'Oil Company')).toBe(false);
  });
});

describe('replaceChainParty', () => {
  const initialParties = [
    { organization: 'Oil Company', group: 'Client' as const, chainRole: 'client' as const },
    { organization: 'Northwind Marine Pty Ltd', group: 'Vendor' as const, chainRole: 'head_contractor' as const },
    { organization: 'Meridian Shipyards', group: 'Vendor' as const, chainRole: 'vendor' as const },
    { organization: 'Harbourline Terminals', group: 'Third party' as const },
  ];

  it('sets a role when previously unassigned', () => {
    const withoutVendor = initialParties.filter((p) => p.chainRole !== 'vendor');
    const result = replaceChainParty(withoutVendor, 'vendor', 'Pacific Towing');
    expect(contractPartyByRole(result, 'vendor')?.organization).toBe('Pacific Towing');
    expect(contractPartyByRole(result, 'vendor')?.group).toBe('Vendor');
  });

  it('changes a role, with the old holder moving to participating', () => {
    const result = replaceChainParty(initialParties, 'vendor', 'Pacific Towing');
    // new vendor set
    expect(contractPartyByRole(result, 'vendor')?.organization).toBe('Pacific Towing');
    // old vendor still in list but without chainRole
    const oldVendor = result.find((p) => p.organization === 'Meridian Shipyards');
    expect(oldVendor).toBeDefined();
    expect(oldVendor?.chainRole).toBeUndefined();
    expect(oldVendor?.group).toBe('Vendor');
    // client and head contractor remain
    expect(contractPartyByRole(result, 'client')?.organization).toBe('Oil Company');
    expect(contractPartyByRole(result, 'head_contractor')?.organization).toBe('Northwind Marine Pty Ltd');
  });

  it('clears a role, leaving the old holder in participating', () => {
    const result = replaceChainParty(initialParties, 'vendor', '');
    expect(contractPartyByRole(result, 'vendor')).toBeUndefined();
    const oldVendor = result.find((p) => p.organization === 'Meridian Shipyards');
    expect(oldVendor).toBeDefined();
    expect(oldVendor?.chainRole).toBeUndefined();
    expect(oldVendor?.group).toBe('Vendor');

    const result2 = replaceChainParty(initialParties, 'head_contractor', undefined);
    expect(contractPartyByRole(result2, 'head_contractor')).toBeUndefined();
    const oldHead = result2.find((p) => p.organization === 'Northwind Marine Pty Ltd');
    expect(oldHead).toBeDefined();
    expect(oldHead?.chainRole).toBeUndefined();
  });

  it('rejects client', () => {
    // role: client rejected
    const result1 = replaceChainParty(initialParties, 'client', 'Another Client');
    expect(result1).toEqual(initialParties);
    expect(contractPartyByRole(result1, 'client')?.organization).toBe('Oil Company');

    // assigning client organization to contractor role rejected
    const result2 = replaceChainParty(initialParties, 'vendor', 'Oil Company');
    expect(result2).toEqual(initialParties);
    expect(contractPartyByRole(result2, 'vendor')?.organization).toBe('Meridian Shipyards');
  });

  it('no duplicates when promoting an existing participating organization', () => {
    const result = replaceChainParty(initialParties, 'vendor', 'Harbourline Terminals');
    expect(contractPartyByRole(result, 'vendor')?.organization).toBe('Harbourline Terminals');
    // should not have two Harbourline entries
    const matches = result.filter((p) => p.organization === 'Harbourline Terminals');
    expect(matches).toHaveLength(1);
    expect(matches[0].chainRole).toBe('vendor');
    // old vendor Meridian Shipyards demoted to participating
    const oldVendor = result.find((p) => p.organization === 'Meridian Shipyards');
    expect(oldVendor).toBeDefined();
    expect(oldVendor?.chainRole).toBeUndefined();
  });
});
