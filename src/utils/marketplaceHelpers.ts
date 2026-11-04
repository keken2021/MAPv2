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
import { AssuranceSet } from '../types/assurance';
import { MasterDocument } from '../types/document';
import { MOCK_MARKETPLACE_ITEMS } from '../store/marketplaceMockData';
import { organizationContactFields } from '../store/organizationProfileStore';
import { ORGANIZATION_FIELD_NOT_RECORDED } from '../types/organization';
import { MarketplaceContact } from '../types/marketplace';
import {
  getVesselStockPhoto,
  getEquipmentStockPhoto,
  getCrewStockPhoto,
  getOrganizationLogo,
  getVesselListingContact,
} from './vesselImageHelpers';
import { getClientAdminOrganization } from './rbacHelpers';
import { calculateCrewComplianceScore, calculateEquipmentReadiness, calculateVesselReadiness } from './readinessHelpers';
import { formatReadinessScore, getStatusDisplayLabel, NOT_ASSESSED_LABEL } from './formatters';
import { getAssuranceSetCrewIds, getAssuranceSetScopes } from './assuranceTemplates';
import { toIsoLocalDate } from './validation';

const DEFAULT_CONTACT_AVATAR =
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80';

/**
  what: marketplace contact from the organization profile — never invents email/phone from the company name.
*/
function marketplaceContactFromOrganization(
  organizationName: string,
  role: string,
  avatarUrl: string,
  contactName?: string,
): MarketplaceContact {
  const fields = organizationContactFields(organizationName);
  return {
    name: (contactName || '').trim() || organizationName,
    role,
    avatarUrl,
    email: fields.email,
    phone: fields.phone,
  };
}

/** upsert a detailedSpec row by label */
function upsertListingSpec(
  specs: MarketplaceItem['detailedSpecs'],
  label: string,
  value?: string | null,
): MarketplaceItem['detailedSpecs'] {
  const trimmed = (value || '').trim();
  if (!trimmed) return specs;
  const next = specs.map((spec) => (spec.label === label ? { ...spec, value: trimmed } : spec));
  if (next.some((spec) => spec.label === label)) return next;
  return [...next, { label, value: trimmed }];
}

/** charter type label taken from the vessel intended-use record */
export function charterTypeFromVessel(vessel: Pick<VesselInformation, 'intendedUse'>): string {
  return (vessel.intendedUse || '').split('&')[0].trim();
}

/**
  what: overlays vessel port, IMO, flag, charter type and master contact onto a listing via linkedEntityId.
*/
export function applyLinkedVesselListingFields(
  item: MarketplaceItem,
  vessel: VesselInformation,
): MarketplaceItem {
  const listingContact = getVesselListingContact(vessel.registeredOwner, vessel.masterName, vessel.id);
  const charterType = charterTypeFromVessel(vessel);
  let detailedSpecs = upsertListingSpec(item.detailedSpecs, 'IMO Number', vessel.imoNumber);
  detailedSpecs = upsertListingSpec(detailedSpecs, 'Flag State', vessel.flagState);
  if (charterType) {
    detailedSpecs = upsertListingSpec(detailedSpecs, 'Charter Type', charterType);
  }
  return {
    ...item,
    location: vessel.portOfRegistry?.trim() || item.location,
    detailedSpecs,
    contact: marketplaceContactFromOrganization(
      item.providerOrg,
      item.contact?.role || 'Chartering Desk',
      listingContact.avatarUrl || item.contact?.avatarUrl || DEFAULT_CONTACT_AVATAR,
      vessel.masterName,
    ),
  };
}

/** true when a marketplace contact string is a real recorded value (not blank / Not recorded) */
export function isRecordedOrganizationContact(value?: string | null): boolean {
  const trimmed = (value || '').trim();
  return Boolean(trimmed) && trimmed !== ORGANIZATION_FIELD_NOT_RECORDED;
}

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

const LISTING_MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/**
  recorded marketplace offer fields keyed by linked entity id.
  windows / rates / lead times are listing records — never derived from a hash, category default, or vessel status.
*/
export interface MarketplaceListingOffer {
  availableFrom: string;
  availableTo: string;
  rateEstimate?: string;
  mobilizationLeadTime?: string;
  charterType?: string;
}

export const LISTING_OFFERS_BY_LINKED_ENTITY: Record<string, MarketplaceListingOffer> = {
  'VESSEL-001': { availableFrom: '2027-04-01', availableTo: '2027-06-30', rateEstimate: 'AUD 26,500 / day', mobilizationLeadTime: '48 Hours', charterType: 'Offshore Supply' },
  'VESSEL-002': { availableFrom: '2026-10-01', availableTo: '2026-12-15', rateEstimate: 'AUD 29,000 / day', mobilizationLeadTime: '72 Hours', charterType: 'Anchor Handling' },
  'VESSEL-003': { availableFrom: '2027-01-15', availableTo: '2027-05-31', rateEstimate: 'AUD 27,000 / day', mobilizationLeadTime: '48 Hours', charterType: 'Platform Supply' },
  'VESSEL-004': { availableFrom: '2026-09-01', availableTo: '2026-11-30', rateEstimate: 'AUD 32,000 / day', mobilizationLeadTime: '5 Days', charterType: 'Subsea Inspection' },
  'VESSEL-005': { availableFrom: '2026-12-01', availableTo: '2027-03-31', rateEstimate: 'AUD 30,000 / day', mobilizationLeadTime: '48 Hours', charterType: 'Offshore Rig Towing' },
  'VESSEL-006': { availableFrom: '2026-11-01', availableTo: '2027-02-28', rateEstimate: 'AUD 24,500 / day', mobilizationLeadTime: '24 Hours', charterType: 'Offshore Rescue' },
  'VESSEL-007': { availableFrom: '2027-04-01', availableTo: '2027-06-30', rateEstimate: 'AUD 25,000 / day', mobilizationLeadTime: '48 Hours', charterType: 'Platform Deck Supply' },
  'VESSEL-011': { availableFrom: '2026-10-01', availableTo: '2026-12-15', rateEstimate: 'AUD 28,000 / day', mobilizationLeadTime: '72 Hours', charterType: 'Offshore Platform Support' },
  'VESSEL-012': { availableFrom: '2027-01-15', availableTo: '2027-05-31', rateEstimate: 'AUD 27,500 / day', mobilizationLeadTime: '48 Hours', charterType: 'Offshore Platform Supply' },
  'EQ-001': { availableFrom: '2027-01-15', availableTo: '2027-05-31', rateEstimate: 'AUD 1,800 / day', mobilizationLeadTime: '24 Hours' },
  'EQ-002': { availableFrom: '2026-09-01', availableTo: '2026-11-30', rateEstimate: 'AUD 2,200 / day', mobilizationLeadTime: '48 Hours' },
  'EQ-005': { availableFrom: '2027-04-01', availableTo: '2027-06-30', rateEstimate: 'AUD 12,000 / day', mobilizationLeadTime: '5 Days' },
  'EQ-006': { availableFrom: '2026-10-01', availableTo: '2026-12-15', rateEstimate: 'AUD 6,500 / day', mobilizationLeadTime: '72 Hours' },
  'EQ-007': { availableFrom: '2027-01-15', availableTo: '2027-05-31', rateEstimate: 'AUD 8,200 / day', mobilizationLeadTime: '3 Days' },
  'EQ-008': { availableFrom: '2026-09-01', availableTo: '2026-11-30', rateEstimate: 'AUD 5,500 / day', mobilizationLeadTime: '48 Hours' },
  'EQ-010': { availableFrom: '2027-01-15', availableTo: '2027-05-31', rateEstimate: 'AUD 7,200 / day', mobilizationLeadTime: '5 Days' },
  'EQ-011': { availableFrom: '2026-09-01', availableTo: '2026-11-30', rateEstimate: 'AUD 3,100 / day', mobilizationLeadTime: '48 Hours' },
  'EQ-012': { availableFrom: '2026-12-01', availableTo: '2027-03-31', rateEstimate: 'AUD 4,800 / day', mobilizationLeadTime: '72 Hours' },
  'EQ-013': { availableFrom: '2026-11-01', availableTo: '2027-02-28', rateEstimate: 'AUD 2,400 / day', mobilizationLeadTime: '24 Hours' },
  'CREW-101': { availableFrom: '2027-01-15', availableTo: '2027-05-31', rateEstimate: 'Day Rate on Application', mobilizationLeadTime: 'On Application' },
  'CREW-102': { availableFrom: '2026-09-01', availableTo: '2026-11-30', rateEstimate: 'Day Rate on Application', mobilizationLeadTime: 'On Application' },
  'CREW-103': { availableFrom: '2026-12-01', availableTo: '2027-03-31', rateEstimate: 'Day Rate on Application', mobilizationLeadTime: 'On Application' },
  'CREW-104': { availableFrom: '2026-11-01', availableTo: '2027-02-28', rateEstimate: 'Day Rate on Application', mobilizationLeadTime: 'On Application' },
  'CREW-105': { availableFrom: '2027-04-01', availableTo: '2027-06-30', rateEstimate: 'Day Rate on Application', mobilizationLeadTime: 'On Application' },
};

/** recorded offer for a linked registry asset; undefined when the asset has no marketplace listing record */
export function listingOfferForLinkedEntity(linkedEntityId: string): MarketplaceListingOffer | undefined {
  return LISTING_OFFERS_BY_LINKED_ENTITY[linkedEntityId];
}

/** @deprecated use listingOfferForLinkedEntity — kept name for call sites that only need the window */
export function availabilityWindowForId(id: string): { availableFrom: string; availableTo: string } {
  const offer = listingOfferForLinkedEntity(id);
  if (offer) return { availableFrom: offer.availableFrom, availableTo: offer.availableTo };
  return { availableFrom: '', availableTo: '' };
}

/* calendar date without a timezone shift, e.g. "01 DEC 2026" */
export function formatListingDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-');
  const monthName = LISTING_MONTHS[Number(month) - 1];
  if (!year || !monthName || !day) return iso;
  return `${day} ${monthName} ${year}`;
}

/* port or region shown after the window: the part before a comma */
export function listingPlace(location: string): string {
  return location.split(',')[0].trim();
}

/* "Available 01 DEC 2026 to 31 MAR 2027 · Fremantle" */
export function formatListingAvailability(
  item: Pick<MarketplaceItem, 'availableFrom' | 'availableTo' | 'location'>,
): string {
  return `Available ${formatListingDate(item.availableFrom)} to ${formatListingDate(item.availableTo)} · ${listingPlace(item.location)}`;
}

/* true when the listing window overlaps the filter range; a blank end is open */
export function listingOverlapsAvailability(
  item: Pick<MarketplaceItem, 'availableFrom' | 'availableTo'>,
  from?: string,
  to?: string,
): boolean {
  if (!from && !to) return true;
  if (!item.availableFrom || !item.availableTo) return false;
  if (from && item.availableTo < from) return false;
  if (to && item.availableFrom > to) return false;
  return true;
}

/* earliest certificate date on the linked vessel, its library documents, or the crew member */
export function earliestCertificateExpiry(
  item: Pick<MarketplaceItem, 'linkedEntityId' | 'linkedEntityType'>,
  vessels: Pick<VesselInformation, 'id' | 'statutoryCertificates'>[],
  documents: Pick<MasterDocument, 'vesselId' | 'expiryDate'>[],
  crew: Pick<CrewMember, 'id' | 'layer1CoreDocuments' | 'layer2Endorsements'>[] = [],
): string | undefined {
  const id = item.linkedEntityId;
  if (!id) return undefined;
  const dates: string[] = [];
  const keep = (value?: string) => {
    if (value) dates.push(value.slice(0, 10));
  };
  if (item.linkedEntityType === 'vessel') {
    vessels.find((vessel) => vessel.id === id)?.statutoryCertificates?.forEach((certificate) => keep(certificate.expiryDate));
    documents.filter((document) => document.vesselId === id).forEach((document) => keep(document.expiryDate));
  }
  if (item.linkedEntityType === 'crew') {
    const member = crew.find((person) => person.id === id);
    member?.layer1CoreDocuments?.forEach((document) => keep(document.expiryDate));
    member?.layer2Endorsements?.forEach((document) => keep(document.expiryDate));
  }
  if (dates.length === 0) return undefined;
  return [...dates].sort()[0];
}

/* rewrites the "nn% ready" text of a metric so it repeats the calculated score instead of a typed one */
function withReadinessMetric(metrics: MarketplaceItem['metrics'], score: number | null): MarketplaceItem['metrics'] {
  if (score === null) return metrics;
  return metrics.map((metric) =>
    /%\s*ready/i.test(metric.value)
      ? { ...metric, value: metric.value.replace(/\d+\s*%\s*ready/i, `${score}% Ready`) }
      : metric,
  );
}

/**
  what: builds a unified list of all service provider marketplace offerings from both store assets and dedicated service records; inputs are the registries, the viewer, and the assurance sets and documents the scores are calculated from.
  how: extracts non-user-owned vessels, equipment, and crew, synchronizes updated photos and image crops from store, takes every linked offering's score from the readiness helpers, and wraps them into MarketplaceItem format.
  with what file: src/utils/marketplaceHelpers.ts consumed by MarketplaceView.tsx; scores come from src/utils/readinessHelpers.ts.
*/
export function getMarketplaceItems(
  vessels: VesselInformation[],
  equipment: EquipmentAsset[],
  activePersona: UserRolePersona,
  users: Pick<UserProfile, 'roles' | 'organization'>[] = [],
  crew: CrewMember[] = [],
  assuranceSets: AssuranceSet[] = [],
  documents: MasterDocument[] = [],
): MarketplaceItem[] {
  // 1. Gather all dedicated service provider mock items and synchronize linked entity photos/images
  const baseItems: MarketplaceItem[] = MOCK_MARKETPLACE_ITEMS.map((item) => {
    let cloned = { ...item, detailedSpecs: [...item.detailedSpecs], metrics: [...item.metrics] };
    if (cloned.linkedEntityId) {
      if (cloned.linkedEntityType === 'vessel') {
        const v = vessels.find((ves) => ves.id === cloned.linkedEntityId);
        if (v) {
          const stockPhoto = getVesselStockPhoto(v.id, v.name, v.vesselType, v.vesselSubtype, v.imageUrl);
          cloned.imageUrl = v.imageUrl || stockPhoto;
          cloned.photos = v.photos && v.photos.length > 0 ? v.photos : cloned.photos || [cloned.imageUrl];
          // Marketplace readiness reflects the provider's on-file evidence (standalone documents and statutory certificates),
          // not competitor clients' private assurance sets or decisions (gap review R2-E10, paper Appendix C Q7)
          cloned.complianceReadinessScore = calculateVesselReadiness(v, [], documents);
          cloned.metrics = withReadinessMetric(cloned.metrics, cloned.complianceReadinessScore);
          cloned = applyLinkedVesselListingFields(cloned, v);
        }
      } else if (cloned.linkedEntityType === 'equipment') {
        const eq = equipment.find((e) => e.id === cloned.linkedEntityId);
        if (eq) {
          const stockPhoto = getEquipmentStockPhoto(eq.id, eq.name, eq.category, eq.imageUrl);
          cloned.imageUrl = eq.imageUrl || stockPhoto;
          cloned.photos = eq.photos && eq.photos.length > 0 ? eq.photos : cloned.photos || [cloned.imageUrl];
          cloned.complianceReadinessScore = calculateEquipmentReadiness(eq, []);
          cloned.metrics = withReadinessMetric(cloned.metrics, cloned.complianceReadinessScore);
        }
      } else if (cloned.linkedEntityType === 'crew') {
        const c = crew.find((cr) => cr.id === cloned.linkedEntityId);
        if (c) {
          const stockPhoto = getCrewStockPhoto(c.id, c.fullName, c.rank, c.imageUrl);
          cloned.imageUrl = c.imageUrl || stockPhoto;
          cloned.photos = c.photos && c.photos.length > 0 ? c.photos : cloned.photos || [cloned.imageUrl];
          cloned.complianceReadinessScore = calculateCrewComplianceScore(c);
        }
      }
    }
    /* organization profile for email/phone; keep masterName when already applied from the vessel */
    const contactName =
      cloned.linkedEntityType === 'vessel' && cloned.contact?.name && cloned.contact.name !== cloned.providerOrg
        ? cloned.contact.name
        : undefined;
    cloned.contact = marketplaceContactFromOrganization(
      cloned.providerOrg,
      cloned.contact?.role || 'Provider desk',
      cloned.contact?.avatarUrl || DEFAULT_CONTACT_AVATAR,
      contactName,
    );
    return cloned;
  });

  // 2. Wrap third-party store vessels if not already present and a listing offer is on record
  vessels.forEach((v) => {
    const isBasePresent = baseItems.some((item) => item.linkedEntityId === v.id);
    const offer = listingOfferForLinkedEntity(v.id);
    if (!isBasePresent && offer && v.portOfRegistry?.trim() && v.registeredOwner?.trim()) {
      const vesselReadiness = calculateVesselReadiness(v, [], documents);
      const photoUrl = getVesselStockPhoto(v.id, v.name, v.vesselType, v.vesselSubtype, v.imageUrl);
      const charterType = offer.charterType || charterTypeFromVessel(v);
      const onCharter = v.availabilityStatus === 'On Charter';

      const generated: MarketplaceItem = {
        id: `MAP-VES-${v.yearBuilt || 2024}-MKT-${v.id.replace('VESSEL-', '')}`,
        name: v.name,
        category: 'vessel',
        subcategory: v.vesselSubtype || v.vesselType || 'Offshore Vessel',
        providerOrg: v.registeredOwner,
        location: v.portOfRegistry,
        availableFrom: offer.availableFrom,
        availableTo: offer.availableTo,
        availabilityStatus: onCharter ? 'Under Charter' : 'Available for Charter',
        availabilityTagColor: onCharter ? '#3b82f6' : '#059669',
        imageUrl: photoUrl,
        photos: v.photos && v.photos.length > 0 ? v.photos : [photoUrl],
        shortDescription: v.intendedUse
          ? `${v.vesselType || 'Offshore Vessel'} for ${v.intendedUse}.`
          : `${v.vesselType || 'Offshore Vessel'} on the marketplace.`,
        metrics: [
          {
            label: 'Capacity (DWT)',
            value: v.deadweightTonnageDWT
              ? `${v.deadweightTonnageDWT.toLocaleString()} MT`
              : v.grossTonnageGT
                ? `${v.grossTonnageGT} GT`
                : '—',
          },
          {
            label: 'Class & Readiness',
            value: `${v.classificationSociety || '—'} · ${
              vesselReadiness === null ? NOT_ASSESSED_LABEL : `${vesselReadiness}% Ready`
            }`,
          },
        ],
        complianceReadinessScore: vesselReadiness,
        rateEstimate: offer.rateEstimate,
        mobilizationLeadTime: offer.mobilizationLeadTime,
        certifications: [
          ...(v.classificationSociety ? [`${v.classificationSociety} Classification`] : []),
          ...(v.flagState ? [`${v.flagState} Flag Registry`] : []),
        ],
        operationalCapabilities: [
          ...(v.dynamicPositioningClass ? [`Dynamic positioning: ${v.dynamicPositioningClass}`] : []),
          ...(v.mainEnginePowerKW ? [`Main engine power: ${v.mainEnginePowerKW}`] : []),
          ...(v.tradingArea ? [`Trading area: ${v.tradingArea}`] : []),
        ],
        detailedSpecs: [
          { label: 'IMO Number', value: v.imoNumber || '—' },
          { label: 'Flag State', value: v.flagState || '—' },
          ...(charterType ? [{ label: 'Charter Type', value: charterType }] : []),
          { label: 'Official Registration Number', value: v.officialRegNumber || '—' },
          { label: 'Class Society', value: v.classificationSociety || '—' },
          {
            label: 'Year Built',
            value: v.yearBuilt ? `${v.yearBuilt}${v.shipyardBuilder ? ` (${v.shipyardBuilder})` : ''}` : '—',
          },
          { label: 'LOA', value: v.lengthOverallMeters ? `${v.lengthOverallMeters} m` : '—' },
          {
            label: 'Beam & Draft',
            value:
              v.beamMeters || v.draftMeters
                ? `${v.beamMeters || '—'} m / ${v.draftMeters || '—'} m`
                : '—',
          },
          { label: 'Gross Tonnage', value: v.grossTonnageGT ? `${v.grossTonnageGT} GT` : '—' },
          { label: 'Deadweight', value: v.deadweightTonnageDWT ? `${v.deadweightTonnageDWT} MT` : '—' },
        ],
        contact: marketplaceContactFromOrganization(
          v.registeredOwner,
          'Chartering Desk · Fleet Operations',
          DEFAULT_CONTACT_AVATAR,
          v.masterName,
        ),
        linkedEntityId: v.id,
        linkedEntityType: 'vessel',
      };
      baseItems.push(applyLinkedVesselListingFields(generated, v));
    }
  });

  // 3. Wrap third-party store equipment when a listing offer is on record
  equipment.forEach((eq) => {
    const isBasePresent = baseItems.some((item) => item.linkedEntityId === eq.id);
    const offer = listingOfferForLinkedEntity(eq.id);
    if (!isBasePresent && offer) {
      const photoUrl = eq.imageUrl || getEquipmentStockPhoto(eq.id, eq.name, eq.category);
      const equipmentReadiness = calculateEquipmentReadiness(eq, assuranceSets);
      const parentVessel = eq.parentVesselId ? vessels.find((ves) => ves.id === eq.parentVesselId) : undefined;
      baseItems.push({
        id: `MAP-EQP-2026-MKT-${eq.id.replace('EQ-', '')}`,
        name: eq.name,
        category: 'equipment',
        subcategory: eq.category,
        providerOrg: eq.owningOrganization,
        location: parentVessel?.portOfRegistry || eq.owningOrganization,
        availableFrom: offer.availableFrom,
        availableTo: offer.availableTo,
        availabilityStatus: eq.availabilityStatus === 'Available' ? 'Available for Lease' : eq.availabilityStatus,
        availabilityTagColor: '#059669',
        imageUrl: photoUrl,
        photos: eq.photos && eq.photos.length > 0 ? eq.photos : [photoUrl],
        shortDescription: [eq.manufacturer, eq.model || eq.category].filter(Boolean).join(' ') + ' on record for marine deployment.',
        metrics: [
          { label: 'Category', value: eq.category },
          {
            label: 'Compliance',
            value: equipmentReadiness === null ? NOT_ASSESSED_LABEL : `${formatReadinessScore(equipmentReadiness)} Ready`,
          },
        ],
        complianceReadinessScore: equipmentReadiness,
        rateEstimate: offer.rateEstimate,
        mobilizationLeadTime: offer.mobilizationLeadTime,
        certifications: [
          ...(eq.classStatus ? [eq.classStatus] : []),
          ...(eq.complianceStatus ? [eq.complianceStatus] : []),
        ],
        operationalCapabilities: [
          ...(eq.manufacturer ? [`Manufacturer: ${eq.manufacturer}`] : []),
          ...(eq.model ? [`Model / Spec: ${eq.model}`] : []),
          `Registration: ${eq.equipmentIdentifier}`,
        ],
        detailedSpecs: [
          { label: 'Equipment ID', value: eq.equipmentIdentifier },
          { label: 'Manufacturer', value: eq.manufacturer || '—' },
          { label: 'Model', value: eq.model || '—' },
          { label: 'Category', value: eq.category },
          { label: 'Availability', value: eq.availabilityStatus },
        ],
        contact: marketplaceContactFromOrganization(
          eq.owningOrganization,
          'Equipment Leasing Desk',
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
        ),
        linkedEntityId: eq.id,
        linkedEntityType: 'equipment',
      });
    }
  });

  // 4. Wrap store crew with a recorded employer and listing offer
  crew.forEach((c) => {
    const isBasePresent = baseItems.some((item) => item.linkedEntityId === c.id);
    const offer = listingOfferForLinkedEntity(c.id);
    if (!isBasePresent && offer && c.organization) {
      const photoUrl = c.imageUrl || getCrewStockPhoto(c.id, c.fullName, c.rank, c.imageUrl);
      const crewScore = calculateCrewComplianceScore(c);
      const crewDocuments = [...c.layer1CoreDocuments, ...c.layer2Endorsements];
      baseItems.push({
        id: `MAP-CRW-2026-MKT-${c.id.replace('CREW-', '')}`,
        name: c.fullName,
        category: 'crew',
        subcategory: c.rank,
        providerOrg: c.organization,
        location: c.currentVesselName || c.organization,
        availableFrom: offer.availableFrom,
        availableTo: offer.availableTo,
        availabilityStatus: c.currentVesselId ? 'On Assignment' : 'Available for Hire',
        availabilityTagColor: c.currentVesselId ? '#3b82f6' : '#059669',
        imageUrl: photoUrl,
        photos: c.photos && c.photos.length > 0 ? c.photos : [photoUrl],
        shortDescription: `${c.rank} holding ${crewDocuments.length} STCW documents on record.`,
        metrics: [
          { label: 'Rank', value: c.rank },
          { label: 'Readiness', value: formatReadinessScore(crewScore) },
        ],
        complianceReadinessScore: crewScore,
        rateEstimate: offer.rateEstimate,
        mobilizationLeadTime: offer.mobilizationLeadTime,
        certifications: crewDocuments.slice(0, 4).map((d) => d.title),
        operationalCapabilities: c.assignments.slice(0, 3).map((a) => `${a.rankHeld} on ${a.vesselName} (${a.vesselType})`),
        detailedSpecs: [
          { label: 'Nationality', value: c.nationality },
          { label: "Seaman's Book No.", value: c.seamansBookNo },
          { label: 'Compliance', value: getStatusDisplayLabel(c.complianceStatus) },
          { label: 'Last Audit', value: c.lastAuditedDate },
        ],
        contact: marketplaceContactFromOrganization(
          c.organization,
          'Crewing Desk',
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
          c.fullName,
        ),
        linkedEntityId: c.id,
        linkedEntityType: 'crew',
      });
    }
  });

  // 5. Strict segregation: filter OUT any item belonging to current user organization
  return baseItems.filter((item) => !isItemOwnedByCurrentOrganization(item.providerOrg, activePersona, users));
}

/**
 * An asset with no contract on the date is available, including an asset with no contract at all.
 * A contracted asset stays busy from the contract start date up to, but not including, the end date, so it is free on the end date.
 */
export function isMarketplaceItemAvailableOnDate(
  item: Pick<MarketplaceItem, 'category' | 'linkedEntityId' | 'linkedEntityType'>,
  date: string,
  assuranceSets: AssuranceSet[],
): boolean {
  if (!date) return true;
  const assetId = item.linkedEntityId;
  const kind = item.linkedEntityType;
  if (!assetId || !kind) return true;

  return !assuranceSets.some((set) => {
    if (set.visibility === 'draft') return false;
    if (!set.charterWindowStart || !set.charterWindowEnd) return false;
    /* every set carries a vessel id, so a vessel is only contracted by a set whose scopes include Vessel */
    const occupies =
      kind === 'vessel'
        ? set.vesselId === assetId && getAssuranceSetScopes(set).includes('Vessel')
        : kind === 'crew'
          ? getAssuranceSetCrewIds(set).includes(assetId)
          : set.equipmentId === assetId;
    if (!occupies) return false;
    return set.charterWindowStart <= date && date < set.charterWindowEnd;
  });
}

/**
  what: filters and sorts marketplace items according to search query, category, provider, location, Available date, and sort criteria; returns each asset once.
*/
export function filterMarketplaceItems(
  items: MarketplaceItem[],
  options: {
    category?: MarketplaceCategory;
    searchTerm?: string;
    providerFilter?: string;
    locationFilter?: string;
    statusFilter?: string;
    availableOn?: string;
    /* iso dates; keep a listing whose availableFrom/availableTo window overlaps this range */
    availableFrom?: string;
    availableTo?: string;
    /* iso date the Available date is checked against; defaults to the current date */
    today?: string;
    assuranceSets?: AssuranceSet[];
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
    availableOn = '',
    availableFrom = '',
    availableTo = '',
    today = toIsoLocalDate(),
    assuranceSets = [],
    sortBy = 'name',
    sortOrder = 'asc',
  } = options;

  const searchNormalized = searchTerm.trim().toLowerCase();
  /* the Available date never looks at the past: a date before today is not applied */
  const contractDate = availableOn && availableOn >= today ? availableOn : '';
  /* one listing per asset, so an asset cannot be returned twice */
  const listedAssets = new Set<string>();

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

    if (!listingOverlapsAvailability(item, availableFrom, availableTo)) {
      return false;
    }

    // 4. Status Filter
    if (statusFilter !== 'ALL' && item.availabilityStatus !== statusFilter) {
      return false;
    }

    // 5. Available date the asset must be free on, including a contract end date
    if (contractDate && !isMarketplaceItemAvailableOnDate(item, contractDate, assuranceSets)) {
      return false;
    }

    // 6. Search Text Filter
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

    // 7. Keep the first listing of each asset
    const assetKey = item.linkedEntityId
      ? `${item.linkedEntityType || item.category}:${item.linkedEntityId}`
      : `listing:${item.id}`;
    if (listedAssets.has(assetKey)) {
      return false;
    }
    listedAssets.add(assetKey);

    return true;
  });

  // Sorting
  return filtered.sort((a, b) => {
    let compA: string | number = '';
    let compB: string | number = '';

    if (sortBy === 'readiness') {
      /* offerings that are not assessed stay after every scored offering in both sort directions */
      const scoreA = a.complianceReadinessScore;
      const scoreB = b.complianceReadinessScore;
      if (scoreA === null || scoreB === null) {
        if (scoreA === scoreB) return 0;
        return scoreA === null ? 1 : -1;
      }
      compA = scoreA;
      compB = scoreB;
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
