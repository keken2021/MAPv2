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
  profile('ORG-AUSTRAL-OCEAN', 'Austral Ocean Shipping Ltd', {
    email: 'charter@australocean.com.au',
    phone: '+61 8 9481 2200',
    website: 'https://www.australocean.com.au',
    address: '88 Marine Terrace, Fremantle WA 6160',
  }),
  profile('ORG-OCEANIC', 'Oceanic Horizon Logistics Pty Ltd', {
    email: 'brokerage@oceanichorizon.com.au',
    phone: '+61 8 9335 4100',
    website: 'https://www.oceanichorizon.com.au',
    address: '7 Slip Street, Henderson WA 6166',
  }),
  profile('ORG-PACIFIC', 'Pacific Ocean Logistics Pty Ltd', {
    email: 'fleet@pacificoceanlogistics.com.au',
    phone: '+61 8 9430 1200',
    address: '22 Queen Victoria Street, Fremantle WA 6160',
  }),
  profile('ORG-PACIFIC-OFF', 'Pacific Offshore Maritime Personnel', {
    email: 'marine.crew@pacificoffshore.com.au',
    phone: '+61 8 9221 9000',
  }),
  profile('ORG-SUBSEA7', 'Subsea 7 Engineering & Robotics', {
    email: 'subsea.tooling@subsea7.com',
    phone: '+61 8 6314 1000',
    website: 'https://www.subsea7.com',
  }),
  profile('ORG-BOSKALIS', 'Boskalis Heavy Marine Transport', {
    email: 'cranes@boskalis.com.au',
    phone: '+61 8 9410 2800',
  }),
  profile('ORG-KONGSBERG', 'Kongsberg Maritime Services', {
    email: 'support.dp@kongsberg.com',
    phone: '+61 8 9336 7600',
  }),
  profile('ORG-ATLAS', 'Atlas Professionals Marine Crewing', {
    email: 'crewing.wa@atlasprofessionals.com.au',
    phone: '+61 8 9322 4500',
  }),
  profile('ORG-BRUNEL', 'Brunel International Marine Staffing', {
    email: 'marine.perth@brunel.net',
    phone: '+61 8 9486 8000',
  }),
  profile('ORG-SOUTHERN-CREW', 'Southern Marine Personnel Ltd', {
    email: 'placements@southernmarine.com.au',
    phone: '+61 8 9430 5500',
  }),
  profile('ORG-OCEANEERING', 'Oceaneering Marine Subsea Staffing', {
    email: 'rov.crewing@oceaneering.com',
    phone: '+61 8 6250 4000',
  }),
  profile('ORG-GLOBAL-MAR', 'Global Maritime Assurance Group', {
    email: 'qhse.crewing@globalmaritime.com',
    phone: '+61 8 9226 1100',
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
  profile('ORG-WOODSIDE', 'Woodside Energy Ltd', {
    email: 'marine@woodside.com.au',
    phone: '+61 8 9348 4000',
  }),
  profile('ORG-INPEX', 'Inpex Operations Australia', {
    email: 'marine@inpex.com.au',
    phone: '+61 8 6213 6000',
  }),
  profile('ORG-SHELL', 'Shell Australia Pty Ltd', {
    email: 'marine@shell.com.au',
    phone: '+61 8 9333 6000',
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
  { vesselId: 'VESSEL-009', role: 'registeredOwner', dateOfEffect: '2022-04-20' },
  { vesselId: 'VESSEL-009', role: 'ismCompany', dateOfEffect: '2022-04-20' },
  { vesselId: 'VESSEL-009', role: 'technicalManager', dateOfEffect: '2022-04-20' },
  { vesselId: 'VESSEL-010', role: 'registeredOwner', dateOfEffect: '2021-11-08' },
  { vesselId: 'VESSEL-010', role: 'ismCompany', dateOfEffect: '2021-11-08' },
  { vesselId: 'VESSEL-010', role: 'technicalManager', dateOfEffect: '2021-11-08' },
  { vesselId: 'VESSEL-011', role: 'registeredOwner', dateOfEffect: '2022-07-01' },
  { vesselId: 'VESSEL-011', role: 'ismCompany', dateOfEffect: '2022-07-01' },
  { vesselId: 'VESSEL-011', role: 'technicalManager', dateOfEffect: '2022-07-01' },
  { vesselId: 'VESSEL-012', role: 'registeredOwner', dateOfEffect: '2023-02-14' },
  { vesselId: 'VESSEL-012', role: 'ismCompany', dateOfEffect: '2023-02-14' },
  { vesselId: 'VESSEL-012', role: 'technicalManager', dateOfEffect: '2023-02-14' },
];
