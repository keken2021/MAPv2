/* 
  file summary: unit tests for the marketplace module.
  responsibilities: verifies organization exclusion segregation, category filtering, search matching, and route accessibility.
  role in system: validates marketplace compliance with business rules and rbac requirements.
*/

import { describe, it, expect } from 'vitest';
import { getMarketplaceItems, filterMarketplaceItems, isItemOwnedByCurrentOrganization } from '../utils/marketplaceHelpers';
import { isViewAccessibleToPersona } from '../utils/rbacHelpers';
import { MOCK_VESSELS } from '../store/mockData';
import { MOCK_EQUIPMENT } from '../store/equipmentMockData';
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

  it('includes vessels, equipment, crew, and turnkey services in marketplace catalog', () => {
    const items = getMarketplaceItems(MOCK_VESSELS, MOCK_EQUIPMENT, 'Administrator', mockUsers);

    const categories = new Set(items.map((i) => i.category));
    expect(categories.has('vessel')).toBe(true);
    expect(categories.has('equipment')).toBe(true);
    expect(categories.has('crew')).toBe(true);
    expect(categories.has('service')).toBe(true);
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

    const servicesOnly = filterMarketplaceItems(items, { category: 'service' });
    expect(servicesOnly.every((i) => i.category === 'service')).toBe(true);
    expect(servicesOnly.length).toBeGreaterThan(0);
  });

  it('filters items accurately with search query keywords', () => {
    const items = getMarketplaceItems(MOCK_VESSELS, MOCK_EQUIPMENT, 'Administrator', mockUsers);

    // Search by name
    const rovMatch = filterMarketplaceItems(items, { searchTerm: 'Schilling' });
    expect(rovMatch.length).toBeGreaterThan(0);
    expect(rovMatch[0].name).toContain('Schilling');

    // Search by provider
    const fugroMatch = filterMarketplaceItems(items, { searchTerm: 'Fugro' });
    expect(fugroMatch.length).toBeGreaterThan(0);
    expect(fugroMatch[0].providerOrg).toContain('Fugro');

    // Search by certification / standard
    const imcaMatch = filterMarketplaceItems(items, { searchTerm: 'IMCA' });
    expect(imcaMatch.length).toBeGreaterThan(0);
  });

  it('verifies route accessibility for marketplace across personas', () => {
    expect(isViewAccessibleToPersona('marketplace', undefined, 'Administrator')).toBe(true);
    expect(isViewAccessibleToPersona('marketplace', undefined, 'C Admin')).toBe(true);
    expect(isViewAccessibleToPersona('marketplace', undefined, 'Submitter')).toBe(true);
    expect(isViewAccessibleToPersona('marketplace', undefined, 'Verifier')).toBe(true);
    expect(isViewAccessibleToPersona('marketplace', undefined, 'Inspector')).toBe(true);
    expect(isViewAccessibleToPersona('marketplace', undefined, 'Approver')).toBe(true);
  });

  it('verifies existing projects are available for asset nomination', () => {
    const items = getMarketplaceItems(MOCK_VESSELS, MOCK_EQUIPMENT, 'Administrator', mockUsers);
    const vesselOffering = items.find((i) => i.category === 'vessel')!;

    expect(vesselOffering).toBeDefined();
    expect(vesselOffering.certifications.length).toBeGreaterThan(0);
    expect(vesselOffering.complianceReadinessScore).toBeGreaterThanOrEqual(80);
  });
});
