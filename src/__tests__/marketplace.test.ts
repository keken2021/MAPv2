/* 
  file summary: unit tests for the marketplace module.
  responsibilities: verifies organization exclusion segregation, category filtering, search matching, and route accessibility.
  role in system: validates marketplace compliance with business rules and rbac requirements.
*/

import { describe, it, expect } from 'vitest';
import {
  getMarketplaceItems,
  filterMarketplaceItems,
  isMarketplaceItemAvailableOnDate,
  isItemOwnedByCurrentOrganization,
  getMarketplaceCharterLabel,
  resolveMarketplaceCharterTarget,
} from '../utils/marketplaceHelpers';
import {
  ASSURANCE_SETS_READ_ONLY_ROLES,
  isMarketplacePersona,
  isViewAccessibleToPersona,
} from '../utils/rbacHelpers';
import { buildBrdRolePermissionDefaults } from '../utils/permissionDefaults';
import { MOCK_ASSURANCE_SETS, MOCK_DOCUMENTS, MOCK_VESSELS } from '../store/mockData';
import { calculateVesselReadiness } from '../utils/readinessHelpers';
import { MOCK_EQUIPMENT } from '../store/equipmentMockData';
import { MOCK_CREW } from '../store/crewMockData';
import { UserProfile } from '../types/user';
import { MarketplaceItem } from '../types/marketplace';
import { AssuranceSet } from '../types/assurance';

describe('Marketplace Module & Segregation', () => {
  const mockUsers: Pick<UserProfile, 'roles' | 'organization'>[] = [
    { roles: ['Administrator'], organization: 'Northwind Marine Pty Ltd' },
    { roles: ['Submitter'], organization: 'Northwind Marine Pty Ltd' },
    { roles: ['C Admin'], organization: 'Southern Basin Energy Pty Ltd' },
  ];

  it('correctly identifies items owned by the current organization', () => {
    // Administrator / Submitter organization: Northwind Marine
    expect(isItemOwnedByCurrentOrganization('Northwind Marine Pty Ltd', 'Administrator', mockUsers)).toBe(true);
    expect(isItemOwnedByCurrentOrganization('Pacific Ocean Logistics', 'Submitter', mockUsers)).toBe(true);
    expect(isItemOwnedByCurrentOrganization('Meridian Marine Services Pty Ltd', 'Administrator', mockUsers)).toBe(false);
    expect(isItemOwnedByCurrentOrganization('Subsea 7 Engineering & Robotics', 'Administrator', mockUsers)).toBe(false);

    // C Admin organization: Southern Basin Energy
    expect(isItemOwnedByCurrentOrganization('Southern Basin Energy Pty Ltd', 'C Admin', mockUsers)).toBe(true);
    expect(isItemOwnedByCurrentOrganization('Chevron Australia Pty Ltd', 'C Admin', mockUsers)).toBe(true);
    expect(isItemOwnedByCurrentOrganization('Northwind Marine Pty Ltd', 'C Admin', mockUsers)).toBe(false);
    expect(isItemOwnedByCurrentOrganization('Austral Ocean Shipping Ltd', 'C Admin', mockUsers)).toBe(false);
  });

  it('strictly excludes own-organization assets for Administrator/Submitter in marketplace items', () => {
    const adminItems = getMarketplaceItems(MOCK_VESSELS, MOCK_EQUIPMENT, 'Administrator', mockUsers);

    expect(adminItems.length).toBeGreaterThan(0);

    adminItems.forEach((item) => {
      const orgLower = item.providerOrg.toLowerCase();
      expect(orgLower).not.toContain('northwind');
      expect(orgLower).not.toContain('pacific ocean');
    });

    // Verify third-party service provider vessels are included
    const providerVessels = adminItems.filter((i) => i.category === 'vessel');
    expect(providerVessels.some((v) => v.name.includes('Meridian Pioneer'))).toBe(true);
    expect(providerVessels.some((v) => v.name.includes('Austral Horizon'))).toBe(true);
    expect(providerVessels.some((v) => v.name.includes('Oceanic Sentinel'))).toBe(true);
  });

  it('strictly excludes client-owned assets for C Admin in marketplace items', () => {
    const cAdminItems = getMarketplaceItems(MOCK_VESSELS, MOCK_EQUIPMENT, 'C Admin', mockUsers);

    expect(cAdminItems.length).toBeGreaterThan(0);

    cAdminItems.forEach((item) => {
      const orgLower = item.providerOrg.toLowerCase();
      expect(orgLower).not.toContain('southern basin');
      expect(orgLower).not.toContain('chevron');
    });

    // Verify provider vessels like Meridian Pioneer and Northwind vessels (as suppliers to C Admin) appear
    expect(cAdminItems.some((v) => v.providerOrg.toLowerCase().includes('meridian'))).toBe(true);
  });

  it('includes vessels, equipment, and multiple specialized crew in marketplace catalog', () => {
    const items = getMarketplaceItems(MOCK_VESSELS, MOCK_EQUIPMENT, 'Administrator', mockUsers);

    const categories = new Set(items.map((i) => i.category));
    expect(categories.has('vessel')).toBe(true);
    expect(categories.has('equipment')).toBe(true);
    expect(categories.has('crew')).toBe(true);

    const crewItems = items.filter((i) => i.category === 'crew');
    expect(crewItems.length).toBeGreaterThanOrEqual(4);
  });

  it('filters items correctly by category', () => {
    const items = getMarketplaceItems(MOCK_VESSELS, MOCK_EQUIPMENT, 'Administrator', mockUsers);

    const vesselsOnly = filterMarketplaceItems(items, { category: 'vessel' });
    expect(vesselsOnly.every((i) => i.category === 'vessel')).toBe(true);
    expect(vesselsOnly.length).toBeGreaterThan(0);

    const equipmentOnly = filterMarketplaceItems(items, { category: 'equipment' });
    expect(equipmentOnly.every((i) => i.category === 'equipment')).toBe(true);
    expect(equipmentOnly.length).toBeGreaterThan(0);

    const crewOnly = filterMarketplaceItems(items, { category: 'crew' });
    expect(crewOnly.every((i) => i.category === 'crew')).toBe(true);
    expect(crewOnly.length).toBeGreaterThan(0);
  });

  it('filters items accurately with search query keywords', () => {
    const items = getMarketplaceItems(MOCK_VESSELS, MOCK_EQUIPMENT, 'Administrator', mockUsers);

    // Search by name
    const rovMatch = filterMarketplaceItems(items, { searchTerm: 'Schilling' });
    expect(rovMatch.length).toBeGreaterThan(0);
    expect(rovMatch.some((i) => i.name.includes('Schilling'))).toBe(true);

    // Search by specialized crew role / skill
    const diveMatch = filterMarketplaceItems(items, { searchTerm: 'Arthur' });
    expect(diveMatch.length).toBeGreaterThan(0);
    expect(diveMatch[0].subcategory).toContain('Saturation Dive');

    // Search by certification / standard
    const imcaMatch = filterMarketplaceItems(items, { searchTerm: 'IMCA' });
    expect(imcaMatch.length).toBeGreaterThan(0);
  });

  it('opens the marketplace route to vessel admin and client admin only', () => {
    expect(isViewAccessibleToPersona('marketplace', undefined, 'Administrator')).toBe(true);
    expect(isViewAccessibleToPersona('marketplace', undefined, 'C Admin')).toBe(true);
    expect(isViewAccessibleToPersona('marketplace', undefined, 'Submitter')).toBe(false);
    expect(isViewAccessibleToPersona('marketplace', undefined, 'Verifier')).toBe(false);
    expect(isViewAccessibleToPersona('marketplace', undefined, 'Inspector')).toBe(false);
    expect(isViewAccessibleToPersona('marketplace', undefined, 'Approver')).toBe(false);
  });

  it('keeps the marketplace closed to workflow roles even when the permission matrix is supplied', () => {
    const matrix = buildBrdRolePermissionDefaults();
    ASSURANCE_SETS_READ_ONLY_ROLES.forEach((role) => {
      expect(isMarketplacePersona(role)).toBe(false);
      expect(isViewAccessibleToPersona('marketplace', undefined, role, matrix)).toBe(false);
    });
  });

  it('verifies existing projects are available for asset nomination', () => {
    const items = getMarketplaceItems(
      MOCK_VESSELS,
      MOCK_EQUIPMENT,
      'Administrator',
      mockUsers,
      MOCK_CREW,
      MOCK_ASSURANCE_SETS,
      MOCK_DOCUMENTS,
    );
    const vesselOffering = items.find((i) => i.category === 'vessel')!;
    const linkedVessel = MOCK_VESSELS.find((v) => v.id === vesselOffering.linkedEntityId)!;

    expect(vesselOffering).toBeDefined();
    expect(vesselOffering.certifications.length).toBeGreaterThan(0);
    /* an offering repeats the calculated readiness of the vessel it links to */
    expect(vesselOffering.complianceReadinessScore).toBe(
      calculateVesselReadiness(linkedVessel, MOCK_ASSURANCE_SETS, MOCK_DOCUMENTS),
    );
  });

  it('shows a chartered vessel on its charter end date and hides it while the charter is open', () => {
    const vessel = {
      id: 'listing-1',
      name: 'Chartered Vessel',
      category: 'vessel',
      subcategory: 'OSV',
      providerOrg: 'AquaClean Marine Services Pty Ltd',
      location: 'Dampier',
      availabilityStatus: 'Under Charter',
      availabilityTagColor: '#3b82f6',
      imageUrl: '',
      shortDescription: '',
      metrics: [],
      complianceReadinessScore: null,
      certifications: [],
      operationalCapabilities: [],
      detailedSpecs: [],
      contact: { name: 'Desk', role: 'Charter', avatarUrl: '' },
      linkedEntityId: 'VESSEL-EXT',
      linkedEntityType: 'vessel',
    } as MarketplaceItem;
    const charter = [
      {
        id: 'AS-DATE',
        vesselId: 'VESSEL-EXT',
        assuranceType: 'Vessel',
        charterWindowStart: '2026-11-01',
        charterWindowEnd: '2026-12-15',
        visibility: 'organization',
        requirements: [],
      },
    ] as unknown as AssuranceSet[];

    expect(isMarketplaceItemAvailableOnDate(vessel, '2026-11-15', charter)).toBe(false);
    expect(isMarketplaceItemAvailableOnDate(vessel, '2026-12-15', charter)).toBe(true);
    expect(isMarketplaceItemAvailableOnDate(vessel, '2026-10-01', charter)).toBe(true);

    const listed = filterMarketplaceItems([vessel], {
      availableOn: '2026-12-15',
      today: '2026-10-09',
      assuranceSets: charter,
    });
    expect(listed).toHaveLength(1);
    expect(
      filterMarketplaceItems([vessel], { availableOn: '2026-12-01', today: '2026-10-09', assuranceSets: charter }),
    ).toHaveLength(0);
  });

  /* minimal linked listing for the Available date cases */
  const linkedListing = (
    id: string,
    category: 'vessel' | 'crew' | 'equipment',
    linkedEntityId: string,
  ): MarketplaceItem =>
    ({
      id,
      name: id,
      category,
      subcategory: '',
      providerOrg: 'AquaClean Marine Services Pty Ltd',
      location: 'Dampier',
      availabilityStatus: 'Available',
      availabilityTagColor: '#059669',
      imageUrl: '',
      shortDescription: '',
      metrics: [],
      complianceReadinessScore: null,
      certifications: [],
      operationalCapabilities: [],
      detailedSpecs: [],
      contact: { name: 'Desk', role: 'Contracts', avatarUrl: '' },
      linkedEntityId,
      linkedEntityType: category,
    }) as MarketplaceItem;

  it('does not apply a Available date that is before today', () => {
    const vessel = linkedListing('listing-past', 'vessel', 'VESSEL-EXT');
    const contract = [
      {
        id: 'AS-PAST',
        vesselId: 'VESSEL-EXT',
        assuranceType: 'Vessel',
        charterWindowStart: '2026-09-01',
        charterWindowEnd: '2026-12-15',
        visibility: 'organization',
        requirements: [],
      },
    ] as unknown as AssuranceSet[];

    /* 2026-10-01 falls inside the contract, but it is before today so the date is ignored */
    expect(
      filterMarketplaceItems([vessel], { availableOn: '2026-10-01', today: '2026-10-09', assuranceSets: contract }),
    ).toHaveLength(1);
    /* today itself is accepted and the contract hides the vessel */
    expect(
      filterMarketplaceItems([vessel], { availableOn: '2026-10-09', today: '2026-10-09', assuranceSets: contract }),
    ).toHaveLength(0);
  });

  it('lists assets with no contract, or whose contract ended before the Available date', () => {
    const uncommitted = linkedListing('listing-free', 'vessel', 'VESSEL-FREE');
    const finished = linkedListing('listing-finished', 'vessel', 'VESSEL-DONE');
    const contracts = [
      {
        id: 'AS-DONE',
        vesselId: 'VESSEL-DONE',
        assuranceType: 'Vessel',
        charterWindowStart: '2026-10-10',
        charterWindowEnd: '2026-10-31',
        visibility: 'organization',
        requirements: [],
      },
    ] as unknown as AssuranceSet[];

    const listed = filterMarketplaceItems([uncommitted, finished], {
      availableOn: '2026-11-15',
      today: '2026-10-09',
      assuranceSets: contracts,
    });
    expect(listed.map((i) => i.id).sort()).toEqual(['listing-finished', 'listing-free']);
  });

  it('treats every asset of a combined set as contracted, and ignores the vessel id of a set without vessel scope', () => {
    const vessel = linkedListing('listing-vessel', 'vessel', 'VESSEL-EXT');
    const crewMember = linkedListing('listing-crew', 'crew', 'CREW-EXT');
    const winch = linkedListing('listing-equipment', 'equipment', 'EQ-EXT');
    const period = { charterWindowStart: '2026-11-01', charterWindowEnd: '2026-12-15', visibility: 'organization', requirements: [] };

    const vesselAndCrew = [
      { ...period, id: 'AS-COMBINED', vesselId: 'VESSEL-EXT', crewId: 'CREW-EXT', assuranceType: 'Vessel', subtypes: ['Vessel', 'Crew'] },
    ] as unknown as AssuranceSet[];
    expect(isMarketplaceItemAvailableOnDate(vessel, '2026-11-15', vesselAndCrew)).toBe(false);
    expect(isMarketplaceItemAvailableOnDate(crewMember, '2026-11-15', vesselAndCrew)).toBe(false);
    expect(isMarketplaceItemAvailableOnDate(winch, '2026-11-15', vesselAndCrew)).toBe(true);

    /* the set names a vessel only because every set carries a vessel id; its scopes do not include Vessel */
    const activityAndEquipment = [
      { ...period, id: 'AS-NO-VESSEL', vesselId: 'VESSEL-EXT', equipmentId: 'EQ-EXT', assuranceType: 'Activity', subtypes: ['Activity', 'Equipment'] },
    ] as unknown as AssuranceSet[];
    expect(isMarketplaceItemAvailableOnDate(vessel, '2026-11-15', activityAndEquipment)).toBe(true);
    expect(isMarketplaceItemAvailableOnDate(winch, '2026-11-15', activityAndEquipment)).toBe(false);
  });

  it('never returns the same asset twice', () => {
    const items = getMarketplaceItems(
      MOCK_VESSELS,
      MOCK_EQUIPMENT,
      'Administrator',
      mockUsers,
      MOCK_CREW,
      MOCK_ASSURANCE_SETS,
      MOCK_DOCUMENTS,
    );
    const filtered = filterMarketplaceItems(items, {
      availableOn: '2026-12-01',
      today: '2026-10-09',
      assuranceSets: MOCK_ASSURANCE_SETS,
    });
    expect(filtered.length).toBeGreaterThan(0);
    expect(new Set(filtered.map((i) => i.id)).size).toBe(filtered.length);
    const linked = filtered.filter((i) => i.linkedEntityId).map((i) => `${i.linkedEntityType}:${i.linkedEntityId}`);
    expect(new Set(linked).size).toBe(linked.length);

    /* a second listing of an asset already in the results is dropped */
    const vessel = linkedListing('listing-a', 'vessel', 'VESSEL-EXT');
    const repeat = linkedListing('listing-b', 'vessel', 'VESSEL-EXT');
    expect(filterMarketplaceItems([vessel, repeat], {}).map((i) => i.id)).toEqual(['listing-a']);
    expect(
      filterMarketplaceItems([vessel, repeat], { availableOn: '2026-12-01', today: '2026-10-09', assuranceSets: [] }),
    ).toHaveLength(1);
  });

  it('labels the charter action by listing category', () => {
    expect(getMarketplaceCharterLabel({ category: 'vessel' })).toBe('Charter Vessel');
    expect(getMarketplaceCharterLabel({ category: 'equipment' })).toBe('Rent Equipment');
    expect(getMarketplaceCharterLabel({ category: 'crew' })).toBe('Hire Crew');
  });

  it('resolves a linked listing to the registered asset and its assurance scope', () => {
    const registries = { vessels: MOCK_VESSELS, equipment: MOCK_EQUIPMENT, crew: MOCK_CREW };

    expect(
      resolveMarketplaceCharterTarget({ category: 'vessel', linkedEntityId: 'VESSEL-008', linkedEntityType: 'vessel' }, registries),
    ).toEqual({ scope: 'Vessel', assetId: 'VESSEL-008' });
    expect(
      resolveMarketplaceCharterTarget({ category: 'equipment', linkedEntityId: 'EQ-007', linkedEntityType: 'equipment' }, registries),
    ).toEqual({ scope: 'Equipment', assetId: 'EQ-007' });
    /* linkedEntityType is optional; the listing category is used when it is missing */
    expect(
      resolveMarketplaceCharterTarget({ category: 'crew', linkedEntityId: 'CREW-101' }, registries),
    ).toEqual({ scope: 'Crew', assetId: 'CREW-101' });
  });

  it('returns no charter target when the listing is not linked to a registered asset', () => {
    const registries = { vessels: MOCK_VESSELS, equipment: MOCK_EQUIPMENT, crew: MOCK_CREW };

    expect(resolveMarketplaceCharterTarget({ category: 'vessel' }, registries)).toBeNull();
    expect(
      resolveMarketplaceCharterTarget({ category: 'vessel', linkedEntityId: 'VESSEL-UNREGISTERED', linkedEntityType: 'vessel' }, registries),
    ).toBeNull();
    expect(resolveMarketplaceCharterTarget({ category: 'service', linkedEntityId: 'VESSEL-008' }, registries)).toBeNull();
  });
});
