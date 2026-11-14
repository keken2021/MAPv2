/*
  file summary: seeded organization contact profiles and vessel manager date-of-effect records.
  responsibilities: one profile per known organization; manager appointment dates per vessel role.
  role in system: initial state for organizationProfileStore (not useMapStore).
*/

import { OrganizationProfile, VesselManagerEffectDate } from '../types/organization';

function profile(
  id: string,
  name: string,
  fields: Partial<Pick<OrganizationProfile, 'email' | 'phone' | 'fax' | 'website' | 'address'>>,
): OrganizationProfile {
  return {
    id,
    name,
    email: fields.email || '',
    phone: fields.phone || '',
    fax: fields.fax || '',
    website: fields.website || '',
    address: fields.address || '',
  };
}

/** one contact profile per organization used in the prototype registries and marketplace */
export const MOCK_ORGANIZATION_PROFILES: OrganizationProfile[] = [
  profile('ORG-NORTHWIND', 'Northwind Marine Pty Ltd', {
    email: 'ops@northwindmarine.com.au',
    phone: '+61 8 9234 5678',
    fax: '+61 8 9234 5679',
    website: 'https://www.northwindmarine.com.au',
    address: '12 Victoria Quay, Fremantle WA 6160',
  }),
  profile('ORG-SOUTHERN', 'Southern Basin Energy Pty Ltd', {
    email: 'marine@southernbasin.com.au',
    phone: '+61 8 9221 4400',
    fax: '+61 8 9221 4401',
    website: 'https://www.southernbasin.com.au',
    address: 'Level 18, 240 St Georges Terrace, Perth WA 6000',
  }),
  profile('ORG-MERIDIAN-MS', 'Meridian Marine Services Pty Ltd', {
    email: 'chartering@meridianmarine.com.au',
    phone: '+61 8 9312 8800',
    website: 'https://www.meridianmarine.com.au',
    address: '45 Rous Head Road, North Fremantle WA 6159',
  }),
  profile('ORG-OIL-CO', 'Oil Company', {
    email: 'marine.assurance@oilcompany.example',
    phone: '+61 8 9263 0000',
    address: 'Oil Company House, Perth WA 6000',
  }),
  profile('ORG-XY', 'XY Marine Assurance', {
    email: 'verification@xymarine.example',
    phone: '+61 8 9220 8800',
  }),
  profile('ORG-MERIDIAN-YARD', 'Meridian Shipyards', {
    email: 'projects@meridianshipyards.example',
    phone: '+61 8 9410 5000',
  }),
  profile('ORG-HARBOURLINE', 'Harbourline Terminals', {
    email: 'terminal@harbourline.example',
    phone: '+61 8 9335 7700',
  }),
  profile('ORG-AUSTRAL-CLASS', 'Austral Classification Society', {
    email: 'survey@australclass.example',
    phone: '+61 8 9321 4400',
  }),
  profile('ORG-CHEVRON', 'Chevron Australia Pty Ltd', {
    email: 'marine@chevron.com',
    phone: '+61 8 9216 4000',
  }),
  profile('ORG-BV', 'Bureau Veritas Inspectorate', {
    email: 'marine.au@bureauveritas.com',
    phone: '+61 8 9381 7000',
  }),
  /* intentionally sparse — verifies Not recorded on empty fields */
  profile('ORG-COASTAL', 'Coastal Fuel Testing', {
    email: 'lab@coastalfuel.example',
  }),
  profile('ORG-KESTREL', 'Kestrel Control Systems', {
    phone: '+61 8 9225 0100',
  }),
  profile('ORG-SENTINEL', 'Sentinel Cyber Assurance', {
    website: 'https://www.sentinelcyber.example',
  }),
  profile('ORG-ABS', 'ABS', {
    email: 'survey.au@eagle.org',
    phone: '+61 8 9214 2100',
    website: 'https://www.eagle.org',
  }),
  profile('ORG-AMSA', 'AMSA', {
    email: 'assurance@amsa.gov.au',
    phone: '+61 2 6279 5000',
    website: 'https://www.amsa.gov.au',
  }),
  profile('ORG-ARS', 'Australian Register of Ships', {
    email: 'shipping.registration@amsa.gov.au',
    phone: '+61 2 6279 5000',
    website: 'https://www.amsa.gov.au',
  }),
  profile('ORG-DNV', 'DNV', {
    email: 'maritime.perth@dnv.com',
    phone: '+61 8 9380 0800',
    website: 'https://www.dnv.com',
  }),
  profile('ORG-GARD', 'Gard P&I Club', {
    email: 'claims@gard.no',
    phone: '+47 37 01 91 00',
    website: 'https://www.gard.no',
  }),
  profile('ORG-LR', "Lloyd's Register", {
    email: 'maritime.au@lr.org',
    phone: '+61 8 9488 1500',
    website: 'https://www.lr.org',
  }),
  profile('ORG-RINA', 'RINA', {
    email: 'perth.office@rina.org',
    phone: '+61 8 9324 6800',
    website: 'https://www.rina.org',
  }),
];

/**
  what: date each manager role took effect on a vessel (empty string = Not recorded).
  how: covers the main registry vessels; roles share a date when the same org holds every role.
*/
export const MOCK_VESSEL_MANAGER_EFFECT_DATES: VesselManagerEffectDate[] = [
  { vesselId: 'VESSEL-001', role: 'registeredOwner', dateOfEffect: '2019-06-01' },
  { vesselId: 'VESSEL-001', role: 'ismCompany', dateOfEffect: '2019-06-01' },
  { vesselId: 'VESSEL-001', role: 'technicalManager', dateOfEffect: '2019-06-01' },
  { vesselId: 'VESSEL-002', role: 'registeredOwner', dateOfEffect: '2018-03-15' },
  { vesselId: 'VESSEL-002', role: 'ismCompany', dateOfEffect: '2018-03-15' },
  { vesselId: 'VESSEL-002', role: 'technicalManager', dateOfEffect: '2018-03-15' },
  { vesselId: 'VESSEL-003', role: 'registeredOwner', dateOfEffect: '2020-01-10' },
  { vesselId: 'VESSEL-003', role: 'ismCompany', dateOfEffect: '2020-01-10' },
  { vesselId: 'VESSEL-003', role: 'technicalManager', dateOfEffect: '2020-01-10' },
  { vesselId: 'VESSEL-008', role: 'registeredOwner', dateOfEffect: '2021-09-01' },
  { vesselId: 'VESSEL-008', role: 'ismCompany', dateOfEffect: '2021-09-01' },
  { vesselId: 'VESSEL-008', role: 'technicalManager', dateOfEffect: '' },
  { vesselId: 'VESSEL-011', role: 'registeredOwner', dateOfEffect: '2022-07-01' },
  { vesselId: 'VESSEL-011', role: 'ismCompany', dateOfEffect: '2022-07-01' },
  { vesselId: 'VESSEL-011', role: 'technicalManager', dateOfEffect: '2022-07-01' },
  { vesselId: 'VESSEL-012', role: 'registeredOwner', dateOfEffect: '2023-02-14' },
  { vesselId: 'VESSEL-012', role: 'ismCompany', dateOfEffect: '2023-02-14' },
  { vesselId: 'VESSEL-012', role: 'technicalManager', dateOfEffect: '2023-02-14' },
];
