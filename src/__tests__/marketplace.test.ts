/* 
  file summary: unit tests for the marketplace module.
  responsibilities: verifies organization exclusion segregation, category filtering, search matching, and route accessibility.
  role in system: validates marketplace compliance with business rules and rbac requirements.
*/

import { describe, it, expect } from 'vitest';
import {
  getMarketplaceItems,
  filterMarketplaceItems,
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
