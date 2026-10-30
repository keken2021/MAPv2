/*
  file summary: non-asset assurance objects seeded into the store (ADR 0029).
  responsibilities: procedures, methods, documents, third-party organizations, and standalone persons who are not crew-directory members.
  role in system: spread into useMapStore.assuranceObjects after vessels, crew, and equipment; re-exported as SEEDED_OPERATIONAL_OBJECTS.
*/

import type {
  AssuranceObject,
  ObjectAssignment,
  ObjectVerification,
  ObjectVerificationChannel,
  ObjectVerificationStatus,
} from '../types/assurance';

const STATUSES: ObjectVerificationStatus[] = [
  'Uploaded, not externally verified',
  'Submitted and tested',
  'Tested externally',
  'Used and tested by several entities over time',
];

/* two client checks per object, rotating status and channel so every value appears */
function clientChecks(index: number): ObjectVerification[] {
  const clients = ['Chevron Australia Pty Ltd', 'Woodside Energy Ltd'];
  return clients.map((clientOrganization, offset) => {
    const slot = index * 2 + offset;
    const channel: ObjectVerificationChannel = slot % 2 === 0 ? 'external' : 'internal';
    return {
      status: STATUSES[slot % STATUSES.length],
      channel,
      clientOrganization,
      verifiedBy: channel === 'external' ? 'Bureau Veritas Inspectorate' : clientOrganization,
      verifiedAt: offset === 0 ? '2026-08-14T02:00:00Z' : '2026-09-22T06:30:00Z',
    };
  });
}

function withChecks(object: AssuranceObject, index: number): AssuranceObject {
  return {
    ...object,
    metadata: { verifications: clientChecks(index) },
  };
}

export function objectVerifications(object: AssuranceObject): ObjectVerification[] {
  const raw = object.metadata?.verifications;
  if (!Array.isArray(raw)) return [];
  return raw as ObjectVerification[];
}

/** procedures, methods, documents and the original port-authority organization */
const ORIGINAL_OPERATIONAL_OBJECTS: AssuranceObject[] = [
  withChecks({
    id: 'OBJ-PROC-PORT-01',
    type: 'procedure',
    name: 'Port Entry & Berthing Procedure',
    ownerOrganization: 'Fremantle Port Authority',
    identifier: 'SOP-PORT-2026',
    description: 'Navigation, pilot boarding and tug escort operating procedure for port arrival',
  }, 20),
  withChecks({
    id: 'OBJ-METH-TOW-01',
    type: 'method',
    name: 'Mooring & Towage Method Statement (MOP)',
    ownerOrganization: 'Tidewater Marine',
    identifier: 'MOP-TOW-004',
    description: 'Detailed operational method for tandem mooring and harbour towage assistance',
  }, 21),
  withChecks({
    id: 'OBJ-DOC-CLR-01',
    type: 'document',
    name: 'Port Clearance & Customs Declaration',
    ownerOrganization: 'Australian Border Force',
    identifier: 'PCD-WA-8812',
    description: 'Statutory vessel border entry clearance and bio-security verification documentation',
  }, 22),
  {
    id: 'OBJ-ORG-PPA-01',
    type: 'organization',
    name: 'Pilbara Ports Authority',
    ownerOrganization: 'Pilbara Ports Authority',
    identifier: 'PPA-PORT-AUTH',
    description: 'Regional port authority and harbour master oversight organization',
  },
];

/** procedures a set can cover besides the vessel, crew, and equipment */
export const SEEDED_PROCEDURE_OBJECTS: AssuranceObject[] = [
  ORIGINAL_OPERATIONAL_OBJECTS[0],
  withChecks({
    id: 'OBJ-PROC-EMERG-01',
    type: 'procedure',
    name: 'Emergency Response Procedure',
    ownerOrganization: 'Northwind Marine Pty Ltd',
    identifier: 'SOP-ERP-2026',
    description: 'Muster, fire, and abandon-ship response for port and field operations',
  }, 10),
  withChecks({
    id: 'OBJ-PROC-SIMOPS-01',
    type: 'procedure',
    name: 'Simultaneous Operations Procedure',
    ownerOrganization: 'Chevron Australia Pty Ltd',
    identifier: 'SOP-SIMOPS-2026',
    description: 'Controls for drilling, construction, and vessel operations at the same time',
  }, 11),
  withChecks({
    id: 'OBJ-PROC-CRANE-01',
    type: 'procedure',
    name: 'Crane Lift Procedure',
    ownerOrganization: 'Woodside Energy Ltd',
    identifier: 'SOP-LIFT-014',
    description: 'Deck crane lift procedure, including exclusion zones and communications',
  }, 12),
  withChecks({
    id: 'OBJ-PROC-HELI-01',
    type: 'procedure',
    name: 'Helideck Operations Procedure',
    ownerOrganization: 'DNV Maritime Inspection',
    identifier: 'SOP-HELI-009',
    description: 'Helideck approach, landing, and refuelling procedure',
  }, 13),
];

/** documents a set can cover that are not a vessel certificate in the library */
export const SEEDED_DOCUMENT_OBJECTS: AssuranceObject[] = [
  ORIGINAL_OPERATIONAL_OBJECTS[2],
  withChecks({
    id: 'OBJ-DOC-BRIDGE-01',
    type: 'document',
    name: 'Bridging Document',
    ownerOrganization: 'Bureau Veritas Inspectorate',
    identifier: 'BD-NW-2026-04',
    description: 'Bridging document between the client safety system and the vessel safety system',
  }, 14),
  withChecks({
    id: 'OBJ-DOC-MWS-01',
    type: 'document',
    name: 'Marine Warranty Certificate of Approval',
    ownerOrganization: 'Meridian Marine Surveyors',
    identifier: 'MWS-COA-2026-17',
    description: 'Marine warranty surveyor certificate of approval for the voyage or lift',
  }, 15),
  withChecks({
    id: 'OBJ-DOC-SEC-01',
    type: 'document',
    name: 'Security Plan',
    ownerOrganization: 'Gulf Security Services Pty Ltd',
    identifier: 'ISPS-SSP-088',
    description: 'Ship and port security plan for the call, including restricted areas',
  }, 16),
];

/** methods a set can cover: how a job is done, separate from the procedure */
export const SEEDED_METHOD_OBJECTS: AssuranceObject[] = [
  ORIGINAL_OPERATIONAL_OBJECTS[1],
  withChecks({
    id: 'OBJ-METH-LIFT-01',
    type: 'method',
    name: 'Lift Plan',
    ownerOrganization: 'Southern Basin Energy Pty Ltd',
    identifier: 'MOP-LIFT-221',
    description: 'Lift plan with loads, rigging, and crane capacity for the cargo operation',
  }, 17),
  withChecks({
    id: 'OBJ-METH-DP-01',
    type: 'method',
    name: 'DP Trials Method',
    ownerOrganization: 'Northwind Marine Pty Ltd',
    identifier: 'MOP-DP-TRIAL-06',
    description: 'Method for annual dynamic positioning trials and failure-mode tests',
  }, 18),
  withChecks({
    id: 'OBJ-METH-ROUTE-01',
    type: 'method',
    name: 'Tow Route Assessment',
    ownerOrganization: 'Chevron Australia Pty Ltd',
    identifier: 'MOP-TOW-ROUTE-03',
    description: 'Route, weather window, and tug power assessment for an ocean tow',
  }, 19),
];

/** third-party organizations that can be assured without being a vessel, crew member, or piece of equipment */
export const SEEDED_ORGANIZATION_OBJECTS: AssuranceObject[] = [
  withChecks({
    id: 'OBJ-ORG-FPA-01',
    type: 'organization',
    name: 'Fremantle Port Authority',
    ownerOrganization: 'Northwind Marine Pty Ltd',
    identifier: 'FPA-PORT-AUTH',
    description: 'Port authority for Fremantle: harbour master, pilotage, and berth allocation',
  }, 0),
  withChecks({
    id: 'OBJ-ORG-DNV-01',
    type: 'organization',
    name: 'DNV Maritime Inspection',
    ownerOrganization: 'DNV Maritime Inspection',
    identifier: 'DNV-CLASS-WA',
    description: 'Classification society issuing class and statutory certificates for the fleet',
  }, 1),
  withChecks({
    id: 'OBJ-ORG-MOOR-01',
    type: 'organization',
    name: 'West Coast Mooring Contractors',
    ownerOrganization: 'Chevron Australia Pty Ltd',
    identifier: 'MOOR-WC-014',
    description: 'Mooring contractor for tandem offtake and harbour line-handling',
  }, 2),
  withChecks({
    id: 'OBJ-ORG-SEC-01',
    type: 'organization',
    name: 'Gulf Security Services Pty Ltd',
    ownerOrganization: 'Gulf Security Services Pty Ltd',
    identifier: 'GSS-SEC-OPS',
    description: 'Security contractor for port and offshore facility access control',
  }, 3),
  withChecks({
    id: 'OBJ-ORG-CATER-01',
    type: 'organization',
    name: 'Bass Strait Catering',
    ownerOrganization: 'Woodside Energy Ltd',
    identifier: 'CAT-BSS-09',
    description: 'Catering subcontractor supplying galley stores and victualling to the fleet',
  }, 4),
  withChecks({
    id: 'OBJ-ORG-TUG-01',
    type: 'organization',
    name: 'Dampier Tug Operators',
    ownerOrganization: 'Southern Basin Energy Pty Ltd',
    identifier: 'TUG-DMP-03',
    description: 'Tug operator providing harbour towage and escort for Dampier and Barrow',
  }, 5),
];

function assignment(
  id: string,
  targetObjectId: string,
  targetName: string,
  startDate: string,
  endDate: string,
  isCurrent: boolean,
  role: string,
): ObjectAssignment {
  return {
    id,
    targetObjectId,
    targetObjectType: 'vessel',
    targetName,
    startDate,
    endDate,
    isCurrent,
    role,
  };
}

/** people who attend an assurance set but are not members of the crew directory */
export const SEEDED_STANDALONE_PERSONS: AssuranceObject[] = [
  withChecks({
    id: 'OBJ-PER-MWS-01',
    type: 'person',
    name: 'Helen Ward',
    ownerOrganization: 'Bureau Veritas Inspectorate',
    identifier: 'MWS-BV-441',
    description: 'Marine warranty surveyor attending load-out and voyage approval',
    assignments: [
      assignment(
        'ASN-MWS-01',
        'VESSEL-001',
        'MV Pacific Endeavour',
        '2026-09-01',
        '2026-11-30',
        true,
        'Marine warranty surveyor',
      ),
    ],
  }, 6),
  withChecks({
    id: 'OBJ-PER-PIL-01',
    type: 'person',
    name: 'James Okello',
    ownerOrganization: 'Northwind Marine Pty Ltd',
    identifier: 'PIL-FPA-118',
    description: 'Harbour pilot for Fremantle and Cockburn Sound arrivals',
    assignments: [
      assignment(
        'ASN-PIL-01',
        'VESSEL-001',
        'MV Pacific Endeavour',
        '2026-03-01',
        '2026-03-02',
        false,
        'Pilot',
      ),
    ],
  }, 7),
  withChecks({
    id: 'OBJ-PER-DPO-01',
    type: 'person',
    name: 'L. Moreau',
    ownerOrganization: 'Meridian Marine Surveyors',
    identifier: 'DPO-NI-2208',
    description: 'Dynamic positioning operator contracted for close-quarters offtake',
    assignments: [
      assignment(
        'ASN-DPO-01',
        'VESSEL-001',
        'MV Pacific Endeavour',
        '2026-06-01',
        '2026-12-31',
        true,
        'DP operator',
      ),
    ],
  }, 8),
  withChecks({
    id: 'OBJ-PER-SEC-01',
    type: 'person',
    name: 'Amina Diallo',
    ownerOrganization: 'Gulf Security Services Pty Ltd',
    identifier: 'SSO-GSS-077',
    description: 'Security team lead for ship and terminal access during port calls',
    assignments: [
      assignment(
        'ASN-SEC-01',
        'VESSEL-004',
        'MV Southern Cross',
        '2026-08-01',
        '2026-10-15',
        false,
        'Security team lead',
      ),
    ],
  }, 9),
];

export const SEEDED_OPERATIONAL_OBJECTS: AssuranceObject[] = [
  ...ORIGINAL_OPERATIONAL_OBJECTS,
  ...SEEDED_PROCEDURE_OBJECTS.slice(1),
  ...SEEDED_DOCUMENT_OBJECTS.slice(1),
  ...SEEDED_METHOD_OBJECTS.slice(1),
  ...SEEDED_ORGANIZATION_OBJECTS,
  ...SEEDED_STANDALONE_PERSONS,
];
