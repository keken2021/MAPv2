import { describe, expect, it } from 'vitest';
import {
  getRequestingParty,
  getRespondingParty,
  getThirdParties,
  getSetOrganizations,
  isInternalDeployment,
  isProjectClient,
  validateAssuranceSetParties,
  AssuranceSetParty,
} from '../utils/setParties';
import {
  getSetVessel,
  getSetCrew,
  getSetEquipment,
  getSetObjectPool,
} from '../utils/setObjects';
import { getRequestRosterObjects } from '../utils/assuranceRequestHelpers';
import {
  OIL_CO_ORG,
  NORTHWIND_ORG,
  XY_MARINE_ORG,
  OIL_CO_PILOT_PROJECT,
  OIL_CO_BUNKER_BARGE_ID,
  OIL_CO_AURORA_ID,
} from '../store/oilCoLngPilotMockData';
import { MOCK_VESSELS } from '../store/mockData';
import { Project } from '../types/project';

describe('Assurance Set Parties Helpers and Validator (ADR 0042 / Rule 3, 4, 10)', () => {
  it('validates a compliant parties list with exactly one Requesting, one Responding, and Third parties', () => {
    const validParties: AssuranceSetParty[] = [
      { organization: NORTHWIND_ORG, role: 'Requesting party' },
      { organization: OIL_CO_ORG, role: 'Responding party' },
      { organization: XY_MARINE_ORG, role: 'Third party' },
    ];
    const result = validateAssuranceSetParties(validParties);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('validates an internal deployment where Requesting and Responding are the same organization', () => {
    const internalParties: AssuranceSetParty[] = [
      { organization: OIL_CO_ORG, role: 'Requesting party' },
      { organization: OIL_CO_ORG, role: 'Responding party' },
      { organization: XY_MARINE_ORG, role: 'Third party' },
    ];
    const result = validateAssuranceSetParties(internalParties);
    expect(result.valid).toBe(true);
    expect(isInternalDeployment({ parties: internalParties })).toBe(true);
  });

  it('rejects an empty or non-array party list', () => {
    expect(validateAssuranceSetParties([]).valid).toBe(false);
    expect(validateAssuranceSetParties(null).valid).toBe(false);
    expect(validateAssuranceSetParties(undefined).valid).toBe(false);
  });

  it('rejects parties with missing or duplicate Requesting or Responding roles', () => {
    const missingResponding: AssuranceSetParty[] = [
      { organization: NORTHWIND_ORG, role: 'Requesting party' },
      { organization: XY_MARINE_ORG, role: 'Third party' },
    ];
    expect(validateAssuranceSetParties(missingResponding).valid).toBe(false);

    const duplicateRequesting: AssuranceSetParty[] = [
      { organization: NORTHWIND_ORG, role: 'Requesting party' },
      { organization: 'Other Corp', role: 'Requesting party' },
      { organization: OIL_CO_ORG, role: 'Responding party' },
    ];
    expect(validateAssuranceSetParties(duplicateRequesting).valid).toBe(false);
  });

  it('extracts requesting, responding, third parties, and full unique organization list', () => {
    const parties: AssuranceSetParty[] = [
      { organization: NORTHWIND_ORG, role: 'Requesting party' },
      { organization: OIL_CO_ORG, role: 'Responding party' },
      { organization: XY_MARINE_ORG, role: 'Third party' },
    ];
    const set = { parties };
    expect(getRequestingParty(set)).toBe(NORTHWIND_ORG);
    expect(getRespondingParty(set)).toBe(OIL_CO_ORG);
    expect(getThirdParties(set)).toEqual([XY_MARINE_ORG]);
    expect(getSetOrganizations(set)).toEqual([NORTHWIND_ORG, OIL_CO_ORG, XY_MARINE_ORG]);
    expect(isInternalDeployment(set)).toBe(false);
  });

  it('isProjectClient identifies client organization correctly', () => {
    const project = OIL_CO_PILOT_PROJECT;
    expect(isProjectClient({ organization: OIL_CO_ORG }, project)).toBe(true);
    expect(isProjectClient(OIL_CO_ORG, project)).toBe(true);
    expect(isProjectClient({ organization: NORTHWIND_ORG }, project)).toBe(false);
    expect(isProjectClient('Another Org', project)).toBe(false);
    expect(isProjectClient(null, project)).toBe(false);
  });
});

describe('Assurance Set Covered Objects and Pool (Rule 8)', () => {
  const storeData = {
    vessels: MOCK_VESSELS,
    crew: [],
    equipment: [],
    assuranceSets: [],
  };

  it('extracts vessel, crew, and equipment from assuranceObjects', () => {
    const set = {
      assuranceObjects: [
        { id: 'VESSEL-001', name: 'Pacific Sentinel', type: 'vessel' as const, ownerOrganization: 'Meridian Shipyards' },
        { id: 'CRW-001', name: 'Capt. Smith', type: 'person' as const, ownerOrganization: 'Meridian Shipyards' },
        { id: 'EQ-001', name: 'Deck Crane', type: 'equipment' as const, ownerOrganization: 'Meridian Shipyards' },
      ],
    };
    const vessel = getSetVessel(set, MOCK_VESSELS);
    expect(vessel?.id).toBe('VESSEL-001');

    const crew = getSetCrew(set);
    expect(crew).toHaveLength(1);
    expect(crew[0].id).toBe('CRW-001');

    const equipment = getSetEquipment(set);
    expect(equipment).toHaveLength(1);
    expect(equipment[0].id).toBe('EQ-001');
  });

  it('AS-04: in LNG project, Oil Company responding offers Oilco Bunker Barge and not Northwind Aurora', () => {
    const draft = {
      parties: [
        { organization: NORTHWIND_ORG, role: 'Requesting party' as const },
        { organization: OIL_CO_ORG, role: 'Responding party' as const },
      ],
    };

    const pool = getSetObjectPool(draft, OIL_CO_PILOT_PROJECT, storeData);
    const bargeOffered = pool.some((o) => o.id === OIL_CO_BUNKER_BARGE_ID);
    const auroraOffered = pool.some((o) => o.id === OIL_CO_AURORA_ID);

    expect(bargeOffered).toBe(true);
    expect(auroraOffered).toBe(false);
  });

  it('with barge roster link removed, barge is not offered on project set even though Oil Company owns it', () => {
    const projectWithoutBarge: Project = {
      ...OIL_CO_PILOT_PROJECT,
      assetLinks: OIL_CO_PILOT_PROJECT.assetLinks.filter((l) => l.assetId !== OIL_CO_BUNKER_BARGE_ID),
    };
    const draft = {
      parties: [
        { organization: NORTHWIND_ORG, role: 'Requesting party' as const },
        { organization: OIL_CO_ORG, role: 'Responding party' as const },
      ],
    };

    const pool = getSetObjectPool(draft, projectWithoutBarge, storeData);
    expect(pool.some((o) => o.id === OIL_CO_BUNKER_BARGE_ID)).toBe(false);
  });

  it('the wizard pool and getRequestRosterObjects return the same assets for the same project and Responding party', () => {
    const draft = {
      parties: [
        { organization: NORTHWIND_ORG, role: 'Requesting party' as const },
        { organization: OIL_CO_ORG, role: 'Responding party' as const },
      ],
    };

    const wizardPool = getSetObjectPool(draft, OIL_CO_PILOT_PROJECT, storeData);
    const requestRoster = getRequestRosterObjects(OIL_CO_PILOT_PROJECT, OIL_CO_ORG);

    expect(wizardPool.map((o) => o.id).sort()).toEqual(requestRoster.map((l) => l.assetId).sort());
  });

  it('a set with no project and Oil Company responding offers the barge and Oil Company own objects', () => {
    const draft = {
      parties: [
        { organization: NORTHWIND_ORG, role: 'Requesting party' as const },
        { organization: OIL_CO_ORG, role: 'Responding party' as const },
      ],
    };

    const pool = getSetObjectPool(draft, null, storeData);
    expect(pool.some((o) => o.id === OIL_CO_BUNKER_BARGE_ID)).toBe(true);
    expect(pool.every((o) => o.ownerOrganization === OIL_CO_ORG)).toBe(true);
  });
});
