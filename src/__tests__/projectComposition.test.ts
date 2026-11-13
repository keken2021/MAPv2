import { describe, expect, it } from 'vitest';
import { AssuranceSet } from '../types/assurance';
import { CrewMember } from '../types/crew';
import { EquipmentAsset } from '../types/equipment';
import { Project } from '../types/project';
import { VesselInformation } from '../types/vessel';
import {
  filterCrewForProjectComposition,
  filterEquipmentForProjectComposition,
  filterVesselsForProjectComposition,
  getEligibleAssuranceSetsForAsset,
  getLinkableProjectAssets,
  getProjectIncludedOrganizations,
  isAssetCharteredOrRented,
  isCrewOwnedByOrganization,
  isOrganizationIncludedInProject,
  isVesselOwnedByOrganization,
  requiresAssuranceSetForAssetLink,
} from '../utils/projectHelpers';

const northwindVessel: VesselInformation = {
  id: 'V-NW',
  name: 'Northwind Vessel',
  registeredOwner: 'Northwind Marine Pty Ltd',
  technicalManager: 'Northwind Marine Pty Ltd',
  ismCompany: 'Northwind Marine Pty Ltd',
} as VesselInformation;

const externalVessel: VesselInformation = {
  id: 'V-EXT',
  name: 'External Vessel',
  registeredOwner: 'AquaClean Marine Services Pty Ltd',
  technicalManager: 'AquaClean Marine Services Pty Ltd',
  ismCompany: 'AquaClean Marine Services Pty Ltd',
} as VesselInformation;

const northwindCrew: CrewMember = {
  id: 'C-NW',
  fullName: 'Northwind Crew',
  organization: 'Northwind Marine Pty Ltd',
} as CrewMember;

const externalCrew: CrewMember = {
  id: 'C-EXT',
  fullName: 'External Crew',
  organization: 'AquaClean Marine Services Pty Ltd',
} as CrewMember;

const northwindEquipment: EquipmentAsset = {
  id: 'E-NW',
  name: 'Northwind Pump',
  owningOrganization: 'Northwind Marine Pty Ltd',
} as EquipmentAsset;

describe('project composition org scoping', () => {
  it('identifies organization ownership for vessels and crew', () => {
    expect(isVesselOwnedByOrganization(northwindVessel, 'Northwind Marine Pty Ltd')).toBe(true);
    expect(isVesselOwnedByOrganization(externalVessel, 'Northwind Marine Pty Ltd')).toBe(false);
    expect(isCrewOwnedByOrganization(northwindCrew, 'Northwind Marine Pty Ltd')).toBe(true);
  });

  it('filters to own-org assets by default for administrator', () => {
    const filtered = filterVesselsForProjectComposition(
      [northwindVessel, externalVessel],
      'Administrator',
      'Northwind Marine Pty Ltd',
      [],
      false,
    );
    expect(filtered.map((v) => v.id)).toEqual(['V-NW']);
  });

  it('includes external assets when toggle is enabled', () => {
    const filtered = filterVesselsForProjectComposition(
      [northwindVessel, externalVessel],
      'Administrator',
      'Northwind Marine Pty Ltd',
      [],
      true,
    );
    expect(filtered).toHaveLength(2);
  });

  it('filters crew and equipment to requesting organization', () => {
    expect(
      filterCrewForProjectComposition([northwindCrew, externalCrew], 'Northwind Marine Pty Ltd', false).map(
        (c) => c.id,
      ),
    ).toEqual(['C-NW']);

    expect(
      filterEquipmentForProjectComposition([northwindEquipment], 'Northwind Marine Pty Ltd', false).map(
        (e) => e.id,
      ),
    ).toEqual(['E-NW']);
  });

  it('requires assurance sets only for cross-org links', () => {
    expect(requiresAssuranceSetForAssetLink('Northwind Marine Pty Ltd', 'Northwind Marine Pty Ltd')).toBe(
      false,
    );
    expect(requiresAssuranceSetForAssetLink('Northwind Marine Pty Ltd', 'AquaClean Marine Services Pty Ltd')).toBe(
      true,
    );
  });

  it('scopes assurance sets to requesting org for same-org assets', () => {
    const sets = [
      {
        id: 'AS-OWN',
        vesselId: 'V-NW',
        initiatorOrg: 'Northwind Marine Pty Ltd',
        requirements: [],
      },
      {
        id: 'AS-OTHER',
        vesselId: 'V-NW',
        initiatorOrg: 'Chevron Australia Pty Ltd',
        requirements: [],
      },
    ] as unknown as AssuranceSet[];

    const eligible = getEligibleAssuranceSetsForAsset('Vessel', 'V-NW', sets, {
      requestingOrganization: 'Northwind Marine Pty Ltd',
      providerOrganization: 'Northwind Marine Pty Ltd',
    });

    expect(eligible.map((s) => s.id)).toEqual(['AS-OWN']);
  });

  it('lists linkable assets only when chartered and eligible assurance sets exist', () => {
    const assuranceSets = [
      {
        id: 'AS-EXT-CHARTER',
        vesselId: 'V-EXT',
        initiatorOrg: 'AquaClean Marine Services Pty Ltd',
        visibility: 'public',
        requirements: [],
      },
      {
        id: 'AS-EXT-DRAFT',
        vesselId: 'V-UNCHARTERED',
        initiatorOrg: 'AquaClean Marine Services Pty Ltd',
        visibility: 'draft',
        requirements: [],
      },
    ] as unknown as AssuranceSet[];

    expect(isAssetCharteredOrRented('Vessel', 'V-EXT', assuranceSets)).toBe(true);
    expect(isAssetCharteredOrRented('Vessel', 'V-UNCHARTERED', assuranceSets)).toBe(true);

    const linkable = getLinkableProjectAssets({
      vessels: [externalVessel, { ...externalVessel, id: 'V-UNCHARTERED', name: 'Unchartered External' }],
      crew: [],
      equipment: [],
      assuranceSets,
      requestingOrganization: 'Northwind Marine Pty Ltd',
    });

    expect(linkable).toHaveLength(1);
    expect(linkable[0].assetId).toBe('V-EXT');
    expect(linkable[0].eligibleAssuranceSets.map((s) => s.id)).toEqual(['AS-EXT-CHARTER']);
  });

  it('offers only orphaned assurance sets when projects are given', () => {
    const secondVessel = { ...externalVessel, id: 'V-EXT-2', name: 'External Vessel Two' };
    const assuranceSets = [
      { id: 'AS-ORPHAN', vesselId: 'V-EXT', visibility: 'public', requirements: [] },
      { id: 'AS-ROSTERED', vesselId: 'V-EXT', visibility: 'public', requirements: [] },
      { id: 'AS-STAMPED', vesselId: 'V-EXT', visibility: 'public', projectId: 'PRJ-B', requirements: [] },
      { id: 'AS-TAKEN', vesselId: 'V-EXT-2', visibility: 'public', requirements: [] },
    ] as unknown as AssuranceSet[];
    const projects = [
      { id: 'PRJ-A', assetLinks: [{ assetType: 'Vessel', assetId: 'V-OTHER', assuranceSetId: 'AS-ROSTERED' }] },
      { id: 'PRJ-B', assetLinks: [{ assetType: 'Vessel', assetId: 'V-EXT-2', assuranceSetId: 'AS-TAKEN' }] },
    ] as unknown as Project[];
    const input = {
      vessels: [externalVessel, secondVessel],
      crew: [],
      equipment: [],
      assuranceSets,
      requestingOrganization: 'Northwind Marine Pty Ltd',
    };

    const linkable = getLinkableProjectAssets({ ...input, orphanedAmongProjects: projects });

    /* the second vessel has no orphaned set left, so it is not listed */
    expect(linkable.map((a) => a.assetId)).toEqual(['V-EXT']);
    expect(linkable[0].eligibleAssuranceSets.map((s) => s.id)).toEqual(['AS-ORPHAN']);

    /* without projects the list is unchanged */
    expect(getLinkableProjectAssets(input).map((a) => a.assetId)).toEqual(['V-EXT', 'V-EXT-2']);
  });

  it('limits linkable assets to allowed provider organizations', () => {
    const otherProviderVessel = {
      ...externalVessel,
      id: 'V-OTHER-PROV',
      name: 'Other Provider Vessel',
      registeredOwner: 'Harbourline Terminals Pty Ltd',
      technicalManager: 'Harbourline Terminals Pty Ltd',
      ismCompany: 'Harbourline Terminals Pty Ltd',
    };
    const assuranceSets = [
      {
        id: 'AS-AQUA',
        vesselId: 'V-EXT',
        visibility: 'public',
        charterWindowStart: '2026-12-01',
        charterWindowEnd: '2027-01-15',
        requirements: [],
      },
      {
        id: 'AS-HARBOUR',
        vesselId: 'V-OTHER-PROV',
        visibility: 'public',
        charterWindowStart: '2026-12-01',
        charterWindowEnd: '2027-01-15',
        requirements: [],
      },
    ] as unknown as AssuranceSet[];

    const linkable = getLinkableProjectAssets({
      vessels: [externalVessel, otherProviderVessel],
      crew: [],
      equipment: [],
      assuranceSets,
      requestingOrganization: 'Oil Company',
      allowedProviderOrganizations: ['AquaClean Marine Services Pty Ltd'],
    });

    expect(linkable.map((a) => a.assetId)).toEqual(['V-EXT']);
  });

  it('keeps only assets whose eligible sets fall inside the project window', () => {
    const assuranceSets = [
      {
        id: 'AS-IN',
        vesselId: 'V-EXT',
        visibility: 'public',
        charterWindowStart: '2026-12-01',
        charterWindowEnd: '2027-01-15',
        requirements: [],
      },
      {
        id: 'AS-OUT',
        vesselId: 'V-EXT-2',
        visibility: 'public',
        charterWindowStart: '2026-10-01',
        charterWindowEnd: '2027-06-01',
        requirements: [],
      },
    ] as unknown as AssuranceSet[];
    const secondVessel = { ...externalVessel, id: 'V-EXT-2', name: 'External Vessel Two' };

    const linkable = getLinkableProjectAssets({
      vessels: [externalVessel, secondVessel],
      crew: [],
      equipment: [],
      assuranceSets,
      requestingOrganization: 'Oil Company',
      projectWindowStart: '2026-11-01',
      projectWindowEnd: '2027-02-28',
    });

    expect(linkable.map((a) => a.assetId)).toEqual(['V-EXT']);
    expect(linkable[0].eligibleAssuranceSets.map((s) => s.id)).toEqual(['AS-IN']);
  });

  it('lists included project organizations from parties and invited orgs', () => {
    const project = {
      ownerOrganization: 'Oil Company',
      requestingOrganization: 'Oil Company',
      contractParties: [
        { organization: 'Oil Company', group: 'Client', chainRole: 'client' },
        { organization: 'Northwind Marine Pty Ltd', group: 'Vendor', chainRole: 'head_contractor' },
      ],
      invitedOrganizations: ['Oil Company', 'AquaClean Marine Services Pty Ltd'],
    } as Project;

    expect(getProjectIncludedOrganizations(project)).toEqual([
      'Oil Company',
      'Northwind Marine Pty Ltd',
      'AquaClean Marine Services Pty Ltd',
    ]);
    expect(isOrganizationIncludedInProject(project, 'Northwind Marine Pty Ltd')).toBe(true);
    expect(isOrganizationIncludedInProject(project, 'Unknown Org')).toBe(false);
  });
});
