/* 
  file summary: aggregation, filtering, and search utilities for the marketplace module.
  responsibilities: converts store assets into marketplace items, strictly excludes current user organization assets, and applies multi-dimensional filters.
  role in system: consumed by MarketplaceView.tsx and tests.
*/

import { MarketplaceCategory, MarketplaceItem } from '../types/marketplace';
import { VesselInformation } from '../types/vessel';
import { EquipmentAsset } from '../types/equipment';
import { CrewMember } from '../types/crew';
import { UserRolePersona } from '../types/audit';
import { UserProfile } from '../types/user';
import { MOCK_MARKETPLACE_ITEMS } from '../store/marketplaceMockData';
import { getVesselStockPhoto, getEquipmentStockPhoto, getCrewStockPhoto, getOrganizationLogo } from './vesselImageHelpers';
import { getClientAdminOrganization } from './rbacHelpers';

/**
  what: checks if an item or organization belongs to the currently logged in user's organization.
  how: checks active persona and users list; for Administrator/Submitter checks Northwind/Pacific Ocean; for C Admin checks Southern Basin/Chevron.
*/
export function isItemOwnedByCurrentOrganization(
  providerOrg: string,
  activePersona: UserRolePersona,
  users: Pick<UserProfile, 'roles' | 'organization'>[] = [],
): boolean {
  if (!providerOrg) return false;
  const orgLower = providerOrg.toLowerCase();

  if (activePersona === 'Administrator' || activePersona === 'Submitter') {
    return (
      orgLower.includes('northwind') ||
      orgLower.includes('pacific ocean') ||
      orgLower.includes('pacific')
    );
  }

  if (activePersona === 'C Admin') {
    const clientOrg = getClientAdminOrganization(users).toLowerCase();
    return (
      orgLower.includes('southern basin') ||
      orgLower.includes('chevron') ||
      (clientOrg.length > 2 && (orgLower.includes(clientOrg) || clientOrg.includes(orgLower)))
    );
  }

  return false;
}

/**
  what: builds a unified list of all service provider marketplace offerings from both store assets and dedicated service records.
  how: extracts non-user-owned vessels, equipment, and crew, synchronizes updated photos and image crops from store, and wraps them into MarketplaceItem format.
*/
export function getMarketplaceItems(
  vessels: VesselInformation[],
  equipment: EquipmentAsset[],
  activePersona: UserRolePersona,
  users: Pick<UserProfile, 'roles' | 'organization'>[] = [],
  crew: CrewMember[] = [],
): MarketplaceItem[] {
  // 1. Gather all dedicated service provider mock items and synchronize linked entity photos/images
  const baseItems: MarketplaceItem[] = MOCK_MARKETPLACE_ITEMS.map((item) => {
    const cloned = { ...item };
    if (cloned.linkedEntityId) {
      if (cloned.linkedEntityType === 'vessel') {
        const v = vessels.find((ves) => ves.id === cloned.linkedEntityId);
        if (v) {
          const stockPhoto = getVesselStockPhoto(v.id, v.name, v.vesselType, v.vesselSubtype, v.imageUrl);
          cloned.imageUrl = v.imageUrl || stockPhoto;
          cloned.photos = v.photos && v.photos.length > 0 ? v.photos : cloned.photos || [cloned.imageUrl];
        }
      } else if (cloned.linkedEntityType === 'equipment') {
        const eq = equipment.find((e) => e.id === cloned.linkedEntityId);
        if (eq) {
          const stockPhoto = getEquipmentStockPhoto(eq.id, eq.name, eq.category, eq.imageUrl);
          cloned.imageUrl = eq.imageUrl || stockPhoto;
          cloned.photos = eq.photos && eq.photos.length > 0 ? eq.photos : cloned.photos || [cloned.imageUrl];
        }
      } else if (cloned.linkedEntityType === 'crew') {
        const c = crew.find((cr) => cr.id === cloned.linkedEntityId);
        if (c) {
          const stockPhoto = getCrewStockPhoto(c.id, c.fullName, c.rank, c.imageUrl);
          cloned.imageUrl = c.imageUrl || stockPhoto;
          cloned.photos = c.photos && c.photos.length > 0 ? c.photos : cloned.photos || [cloned.imageUrl];
        }
      }
    }
    return cloned;
  });

  // 2. Wrap third-party store vessels if not already present in base items
  vessels.forEach((v) => {
    const isBasePresent = baseItems.some((item) => item.linkedEntityId === v.id);
    if (!isBasePresent) {
      const orgInfo = getOrganizationLogo(v.registeredOwner);
      const photoUrl = getVesselStockPhoto(v.id, v.name, v.vesselType, v.vesselSubtype, v.imageUrl);

      baseItems.push({
        id: `MAP-VES-${v.yearBuilt || 2024}-MKT-${v.id.replace('VESSEL-', '')}`,
        name: v.name,
        category: 'vessel',
        subcategory: v.vesselSubtype || v.vesselType || 'Offshore Vessel',
        providerOrg: v.registeredOwner || 'Verified Marine Provider',
        location: v.portOfRegistry || 'Western Australia',
        availabilityStatus: v.status === 'Under Charter' ? 'Under Charter' : 'Available for Charter',
        availabilityTagColor: v.status === 'Under Charter' ? '#3b82f6' : '#059669',
        imageUrl: photoUrl,
        photos: v.photos && v.photos.length > 0 ? v.photos : [photoUrl],
        shortDescription: `${v.vesselType || 'Offshore Vessel'} certified for ${v.intendedUse || 'commercial maritime operations'}.`,
        metrics: [
          {
            label: 'Capacity (DWT)',
            value: v.deadweightTonnageDWT ? `${v.deadweightTonnageDWT.toLocaleString()} MT` : `${v.grossTonnageGT || 3200} GT`,
          },
          {
            label: 'Assurance / Class',
            value: `${v.classificationSociety || 'DNV'} · ${v.complianceReadinessScore || 80}% Ready`,
          },
        ],
        complianceReadinessScore: v.complianceReadinessScore || 80,
        rateEstimate: 'Available on Application',
        mobilizationLeadTime: '48 Hours',
        certifications: [
          `${v.classificationSociety || 'DNV'} Classification`,
          'SOLAS / ISPS Statutory Pack',
          v.flagState ? `${v.flagState} Flag Registry` : 'AMSA Verified',
        ],
        operationalCapabilities: [
          `Dynamic positioning: ${v.dynamicPositioningClass || 'DP2'}`,
          `Main engine power: ${v.mainEnginePowerKW || 'Dual Wärtsilä Diesel'}`,
          `Trading area: ${v.tradingArea || 'Continental Shelf / International'}`,
        ],
        detailedSpecs: [
          { label: 'IMO Number', value: v.imoNumber || '—' },
          { label: 'Official Reg', value: v.officialRegNumber || '—' },
          { label: 'Classification', value: v.classificationSociety || 'DNV' },
          { label: 'Year Built', value: `${v.yearBuilt || 2020} (${v.shipyardBuilder || 'Commercial Shipyard'})` },
          { label: 'Length Overall (LOA)', value: v.lengthOverallMeters ? `${v.lengthOverallMeters} m` : '—' },
          { label: 'Beam / Draft', value: `${v.beamMeters || '—'} m / ${v.draftMeters || '—'} m` },
          { label: 'Gross Tonnage', value: v.grossTonnageGT ? `${v.grossTonnageGT} GT` : '—' },
          { label: 'Deadweight Tonnage', value: v.deadweightTonnageDWT ? `${v.deadweightTonnageDWT} MT` : '—' },
        ],
        contact: {
          name: orgInfo.name,
          role: 'Chartering Desk · Fleet Operations',
          avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
          email: 'chartering@maritimeprovider.com.au',
          phone: v.contact247 || '+61 8 9200 0000',
        },
        linkedEntityId: v.id,
        linkedEntityType: 'vessel',
      });
    }
  });

  // 3. Wrap third-party store equipment if not already present in base items
  equipment.forEach((eq) => {
    const isBasePresent = baseItems.some((item) => item.linkedEntityId === eq.id);
    if (!isBasePresent) {
      const photoUrl = eq.imageUrl || getEquipmentStockPhoto(eq.id, eq.name, eq.category);
      baseItems.push({
        id: `MAP-EQP-2026-MKT-${eq.id.replace('EQ-', '')}`,
        name: eq.name,
        category: 'equipment',
        subcategory: eq.category,
        providerOrg: eq.owningOrganization,
        location: 'Western Australia Shorebase',
        availabilityStatus: eq.availabilityStatus === 'Available' ? 'Available for Lease' : eq.availabilityStatus,
        availabilityTagColor: '#059669',
        imageUrl: photoUrl,
        photos: eq.photos && eq.photos.length > 0 ? eq.photos : [photoUrl],
        shortDescription: `${eq.manufacturer || 'Certified'} ${eq.model || eq.category} inspected and ready for marine deployment.`,
        metrics: [
          { label: 'Category', value: eq.category },
          { label: 'Compliance', value: `${eq.complianceReadinessScore}% Ready` },
        ],
        complianceReadinessScore: eq.complianceReadinessScore,
        rateEstimate: 'Daily / Weekly Rates Available',
        mobilizationLeadTime: '24-48 Hours',
        certifications: [eq.classStatus || 'In Class', eq.complianceStatus || 'Compliant'],
        operationalCapabilities: [
          `Manufacturer: ${eq.manufacturer || 'Standard'}`,
          `Model / Spec: ${eq.model || 'Commercial'}`,
          `Registration: ${eq.equipmentIdentifier}`,
        ],
        detailedSpecs: [
          { label: 'Identifier', value: eq.equipmentIdentifier },
          { label: 'Manufacturer', value: eq.manufacturer || '—' },
          { label: 'Model', value: eq.model || '—' },
          { label: 'Category', value: eq.category },
          { label: 'Status', value: eq.availabilityStatus },
        ],
        contact: {
          name: eq.owningOrganization,
          role: 'Equipment Leasing Desk',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
          email: 'equipment@leasingprovider.com',
          phone: '+61 8 9480 0000',
        },
        linkedEntityId: eq.id,
        linkedEntityType: 'equipment',
      });
    }
  });

  // 4. Strict segregation: filter OUT any item belonging to current user organization
  return baseItems.filter((item) => !isItemOwnedByCurrentOrganization(item.providerOrg, activePersona, users));
}

/**
  what: filters and sorts marketplace items according to search query, category, provider, location, and sort criteria.
*/
export function filterMarketplaceItems(
  items: MarketplaceItem[],
  options: {
    category?: MarketplaceCategory;
    searchTerm?: string;
    providerFilter?: string;
    locationFilter?: string;
    statusFilter?: string;
    sortBy?: 'name' | 'readiness' | 'provider' | 'category';
    sortOrder?: 'asc' | 'desc';
  },
): MarketplaceItem[] {
  const {
    category = 'all',
    searchTerm = '',
    providerFilter = 'ALL',
    locationFilter = 'ALL',
    statusFilter = 'ALL',
    sortBy = 'name',
    sortOrder = 'asc',
  } = options;

  const searchNormalized = searchTerm.trim().toLowerCase();

  const filtered = items.filter((item) => {
    // 1. Category Filter
    if (category !== 'all' && item.category !== category) {
      return false;
    }

    // 2. Provider Filter
    if (providerFilter !== 'ALL' && item.providerOrg !== providerFilter) {
      return false;
    }

    // 3. Location Filter
    if (locationFilter !== 'ALL' && !item.location.toLowerCase().includes(locationFilter.toLowerCase())) {
      return false;
    }

    // 4. Status Filter
    if (statusFilter !== 'ALL' && item.availabilityStatus !== statusFilter) {
      return false;
    }

    // 5. Search Text Filter
    if (searchNormalized) {
      const matchName = item.name.toLowerCase().includes(searchNormalized);
      const matchSubcategory = item.subcategory.toLowerCase().includes(searchNormalized);
      const matchProvider = item.providerOrg.toLowerCase().includes(searchNormalized);
      const matchDesc = item.shortDescription.toLowerCase().includes(searchNormalized);
      const matchLoc = item.location.toLowerCase().includes(searchNormalized);
      const matchCerts = item.certifications.some((c) => c.toLowerCase().includes(searchNormalized));
      const matchSpecs = item.detailedSpecs.some(
        (s) => s.label.toLowerCase().includes(searchNormalized) || s.value.toLowerCase().includes(searchNormalized),
      );

      if (!matchName && !matchSubcategory && !matchProvider && !matchDesc && !matchLoc && !matchCerts && !matchSpecs) {
        return false;
      }
    }

    return true;
  });

  // Sorting
  return filtered.sort((a, b) => {
    let compA: string | number = '';
    let compB: string | number = '';

    if (sortBy === 'readiness') {
      compA = a.complianceReadinessScore;
      compB = b.complianceReadinessScore;
    } else if (sortBy === 'provider') {
      compA = a.providerOrg.toLowerCase();
      compB = b.providerOrg.toLowerCase();
    } else if (sortBy === 'category') {
      compA = a.category.toLowerCase();
      compB = b.category.toLowerCase();
    } else {
      compA = a.name.toLowerCase();
      compB = b.name.toLowerCase();
    }

    if (compA < compB) return sortOrder === 'asc' ? -1 : 1;
    if (compA > compB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });
}

export interface MarketplaceCharterTarget {
  scope: 'Vessel' | 'Crew' | 'Equipment';
  assetId: string;
}

/* charter action wording per listing category */
const MARKETPLACE_CHARTER_LABELS: Record<MarketplaceItem['category'], string> = {
  vessel: 'Charter Vessel',
  equipment: 'Rent Equipment',
  crew: 'Hire Crew',
  service: 'Engage Service',
};

/**
  what: returns the charter action label for a marketplace listing; input is the listing.
  how: looks up the listing category in MARKETPLACE_CHARTER_LABELS.
  with what file: src/utils/marketplaceHelpers.ts used by MarketplaceDetailModal.tsx.
*/
export function getMarketplaceCharterLabel(item: Pick<MarketplaceItem, 'category'>): string {
  return MARKETPLACE_CHARTER_LABELS[item.category];
}

/**
  what: resolves the registered asset a listing charters; inputs are the listing and the vessel, equipment and crew registries.
  how: reads linkedEntityId and linkedEntityType (falling back to category) and confirms the asset exists in the matching registry; returns null when the listing is not linked to a registered asset.
  with what file: src/utils/marketplaceHelpers.ts used by MarketplaceView.tsx to hand the scope and asset to CreateAssuranceSetView.tsx.
*/
export function resolveMarketplaceCharterTarget(
  item: Pick<MarketplaceItem, 'category' | 'linkedEntityId' | 'linkedEntityType'>,
  registries: {
    vessels: Pick<VesselInformation, 'id'>[];
    equipment: Pick<EquipmentAsset, 'id'>[];
    crew: Pick<CrewMember, 'id'>[];
  },
): MarketplaceCharterTarget | null {
  const assetId = item.linkedEntityId;
  if (!assetId) return null;

  const entityType = item.linkedEntityType || item.category;
  if (entityType === 'vessel' && registries.vessels.some((v) => v.id === assetId)) {
    return { scope: 'Vessel', assetId };
  }
  if (entityType === 'equipment' && registries.equipment.some((e) => e.id === assetId)) {
    return { scope: 'Equipment', assetId };
  }
  if (entityType === 'crew' && registries.crew.some((c) => c.id === assetId)) {
    return { scope: 'Crew', assetId };
  }
  return null;
}
