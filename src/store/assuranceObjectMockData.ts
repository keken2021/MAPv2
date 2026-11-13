/*
  file summary: non-asset assurance objects seeded into the store (ADR 0029).
  responsibilities: procedures, methods, and standalone persons who are not crew-directory members (organization and document object types dropped).
  role in system: spread into useMapStore.assuranceObjects after vessels, crew, and equipment; re-exported as SEEDED_OPERATIONAL_OBJECTS.
*/

import type {
  AssuranceObject,
  ObjectAssignment,
  ObjectStatusHistoryEntry,
  ObjectVerification,
  ObjectVerificationChannel,
  ObjectVerificationStatus,
} from '../types/assurance';

const STATUSES: ObjectVerificationStatus[] = [
  'Uploaded',
  'Internally verified',
  'Externally verified',
  'Verified by several entities',
];

/* two client checks per object, rotating status and channel so every value appears */
function clientChecks(index: number): ObjectVerification[] {
  const clients = ['Chevron Australia Pty Ltd', 'Oil Company'];
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

function seededStatusHistory(index: number): ObjectStatusHistoryEntry[] {
  const checks = clientChecks(index);
  const first = checks[0];
  const entries: ObjectStatusHistoryEntry[] = [
    {
      id: `OSH-${index}-0`,
      previousStatus: null,
      newStatus: 'Uploaded',
      changedBy: first.clientOrganization,
      changedAt: '2026-07-01T01:00:00Z',
      note: 'Object registered',
      clientOrganization: first.clientOrganization,
    },
  ];
  if (first.status !== 'Uploaded') {
    entries.push({
      id: `OSH-${index}-1`,
      previousStatus: 'Uploaded',
      newStatus: first.status,
      changedBy: first.verifiedBy || first.clientOrganization,
      changedAt: first.verifiedAt || '2026-08-14T02:00:00Z',
      clientOrganization: first.clientOrganization,
    });
  }
  return entries;
}

function withChecks(object: AssuranceObject, index: number): AssuranceObject {
  return {
    ...object,
    metadata: { verifications: clientChecks(index) },
    statusHistory: seededStatusHistory(index),
  };
}

export function objectVerifications(object: AssuranceObject): ObjectVerification[] {
  const raw = object.metadata?.verifications;
  if (!Array.isArray(raw)) return [];
  return raw as ObjectVerification[];
}

/** activities retained from the original port-entry seed bundle */
const ORIGINAL_OPERATIONAL_OBJECTS: AssuranceObject[] = [
  withChecks({
    id: 'OBJ-PROC-PORT-01',
    type: 'activity',
    name: 'Port Entry & Berthing Procedure',
    ownerOrganization: 'Fremantle Port Authority',
    identifier: 'SOP-PORT-2026',
    description: 'Navigation, pilot boarding and tug escort operating procedure for port arrival',
  }, 20),
  withChecks({
    id: 'OBJ-METH-TOW-01',
    type: 'activity',
    name: 'Mooring & Towage Method Statement (MOP)',
    ownerOrganization: 'Meridian Marine Services Pty Ltd',
    identifier: 'MOP-TOW-004',
    description: 'Detailed operational method for tandem mooring and harbour towage assistance',
  }, 21),
];

/** activities a set can cover besides the vessel, crew, and equipment (ADR 0036 replaces procedures and methods) */
export const SEEDED_ACTIVITY_OBJECTS: AssuranceObject[] = [
  ORIGINAL_OPERATIONAL_OBJECTS[0],
  withChecks({
    id: 'OBJ-PROC-EMERG-01',
    type: 'activity',
    name: 'Emergency Response Procedure',
    ownerOrganization: 'Northwind Marine Pty Ltd',
    identifier: 'SOP-ERP-2026',
    description: 'Muster, fire, and abandon-ship response for port and field operations',
  }, 10),
  withChecks({
    id: 'OBJ-PROC-SIMOPS-01',
    type: 'activity',
    name: 'Simultaneous Operations Procedure',
    ownerOrganization: 'Chevron Australia Pty Ltd',
    identifier: 'SOP-SIMOPS-2026',
    description: 'Controls for drilling, construction, and vessel operations at the same time',
  }, 11),
  withChecks({
    id: 'OBJ-PROC-CRANE-01',
    type: 'activity',
    name: 'Crane Lift Procedure',
    ownerOrganization: 'Oil Company',
    identifier: 'SOP-LIFT-014',
    description: 'Deck crane lift procedure, including exclusion zones and communications',
  }, 12),
  withChecks({
    id: 'OBJ-PROC-HELI-01',
    type: 'activity',
    name: 'Helideck Operations Procedure',
    ownerOrganization: 'Bureau Veritas Inspectorate',
    identifier: 'SOP-HELI-009',
    description: 'Helideck approach, landing, and refuelling procedure',
  }, 13),
  ORIGINAL_OPERATIONAL_OBJECTS[1],
  withChecks({
    id: 'OBJ-METH-LIFT-01',
    type: 'activity',
    name: 'Lift Plan',
    ownerOrganization: 'Southern Basin Energy Pty Ltd',
    identifier: 'MOP-LIFT-221',
    description: 'Lift plan with loads, rigging, and crane capacity for the cargo operation',
  }, 17),
  withChecks({
    id: 'OBJ-METH-DP-01',
    type: 'activity',
    name: 'DP Trials Method',
    ownerOrganization: 'Northwind Marine Pty Ltd',
    identifier: 'MOP-DP-TRIAL-06',
    description: 'Method for annual dynamic positioning trials and failure-mode tests',
  }, 18),
  withChecks({
    id: 'OBJ-METH-ROUTE-01',
    type: 'activity',
    name: 'Tow Route Assessment',
    ownerOrganization: 'Chevron Australia Pty Ltd',
    identifier: 'MOP-TOW-ROUTE-03',
    description: 'Route, weather window, and tug power assessment for an ocean tow',
  }, 19),
];

/** document object type dropped (ADR 0029 / C02); empty export kept for existing imports */
export const SEEDED_DOCUMENT_OBJECTS: AssuranceObject[] = [];

/** organization object type dropped (ADR 0029 / C02); empty export kept for existing imports */
export const SEEDED_ORGANIZATION_OBJECTS: AssuranceObject[] = [];

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
    ownerOrganization: 'Bureau Veritas Inspectorate',
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
  ...SEEDED_ACTIVITY_OBJECTS.filter(
    (o) => !ORIGINAL_OPERATIONAL_OBJECTS.some((orig) => orig.id === o.id)
  ),
  ...SEEDED_STANDALONE_PERSONS,
];
