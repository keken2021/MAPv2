import { describe, expect, it } from 'vitest';
import { MOCK_CAPA_ITEMS } from '../store/capaMockData';
import { MOCK_ASSURANCE_SETS } from '../store/mockData';
import { getFallbackPhysicalInspections } from '../store/inspectionMockData';
import { PROJECT_SEED_ASSURANCE_SETS } from '../store/projectMockData';
import { MOCK_VESSEL_STATUS_HISTORY } from '../store/vesselStatusHistoryMockData';
import { CapaItem } from '../types/capa';
import { VesselStatusHistoryEntry } from '../types/vessel';
import {
  buildVesselActivity,
  filterVesselActivity,
  VesselActivitySources,
} from '../utils/vesselActivityHelpers';

const status = (id: string, changedAt: string, vesselId = 'VESSEL-001'): VesselStatusHistoryEntry => ({
  id,
  vesselId,
  dimension: 'availability',
  previousValue: 'Available',
  newValue: 'On Charter',
  effectiveFrom: changedAt,
  changedAt,
  changedBy: 'System',
  changedByRole: 'Administrator',
});

const capa = (id: string, createdDate: string, extra: Partial<CapaItem> = {}): CapaItem => ({
  id,
  vesselName: 'MV Pacific Endeavour',
  vesselId: 'VESSEL-001',
  checklistItemTitle: 'Finding',
  title: 'Replace a worn part',
  findingDescription: 'Worn part',
  owner: 'Northwind Marine',
  dueDate: '01 Oct 2026',
  status: 'Open',
  evidences: [],
  createdDate,
  ...extra,
});

const sources = (overrides: Partial<VesselActivitySources> = {}): VesselActivitySources => ({
  vesselId: 'VESSEL-001',
  statusHistory: [],
  inspections: [],
  capaItems: [],
  assuranceSets: [],
  ...overrides,
});

describe('vessel activity timeline', () => {
  it('orders entries newest first', () => {
    const entries = buildVesselActivity(
      sources({
        statusHistory: [status('VSH-1', '2024-01-01T00:00:00.000Z'), status('VSH-2', '2026-06-01T00:00:00.000Z')],
        capaItems: [capa('CAPA-1', '18 Sep 2025')],
      }),
    );

    expect(entries.map((entry) => entry.recordId)).toEqual(['VSH-2', 'CAPA-1', 'VSH-1']);
  });

  it('keeps a kind for status, inspection, CAPA raised and closed, and a set decision', () => {
    const entries = buildVesselActivity(
      sources({
        statusHistory: [
          status('VSH-1', '2026-01-01T00:00:00.000Z'),
          status('VSH-OTHER', '2026-02-01T00:00:00.000Z', 'VESSEL-002'),
        ],
        inspections: [
          {
            ...getFallbackPhysicalInspections('MV Pacific Endeavour')[0],
            id: 'INSP-1',
            date: '14 Oct 2026',
            status: 'Completed',
          },
        ],
        capaItems: [
          capa('CAPA-1', '10 Sep 2026', {
            status: 'Verified & Closed',
            closedDate: '2026-09-15T03:05:00.000Z',
          }),
          capa('CAPA-OTHER', '01 Jan 2026', { vesselId: 'VESSEL-009' }),
        ],
        assuranceSets: [
          {
            id: 'AS-1',
            title: 'Charter vetting',
            vesselId: 'VESSEL-001',
            stage: 'Approval',
            approverDecision: 'Approved',
            complianceDeadline: '2026-11-01',
          },
          {
            id: 'AS-OPEN',
            title: 'Still in review',
            vesselId: 'VESSEL-001',
            stage: 'Inspection',
            complianceDeadline: '2026-11-01',
          },
        ],
      }),
    );

    expect(entries.find((entry) => entry.kind === 'status')?.text).toBe(
      'Availability changed from Available to On Charter',
    );
    expect(entries.find((entry) => entry.kind === 'inspection')?.text).toContain('Inspection completed');
    expect(entries.filter((entry) => entry.kind === 'capa').map((entry) => entry.text)).toEqual([
      'CAPA-1 closed — Replace a worn part',
      'CAPA-1 raised — Replace a worn part',
    ]);
    expect(entries.find((entry) => entry.kind === 'decision')).toMatchObject({
      recordId: 'AS-1',
      text: 'Approved — Charter vetting',
    });
    expect(entries.some((entry) => entry.recordId === 'VSH-OTHER' || entry.recordId === 'CAPA-OTHER' || entry.recordId === 'AS-OPEN')).toBe(
      false,
    );
  });

  it('filters the timeline by kind', () => {
    const entries = buildVesselActivity(
      sources({
        statusHistory: [status('VSH-1', '2026-01-01T00:00:00.000Z')],
        capaItems: [capa('CAPA-1', '10 Sep 2026')],
      }),
    );

    expect(filterVesselActivity(entries, 'all')).toHaveLength(2);
    expect(filterVesselActivity(entries, 'capa').every((entry) => entry.kind === 'capa')).toBe(true);
    expect(filterVesselActivity(entries, 'inspection')).toHaveLength(0);
  });

  it('lists status, inspections, CAPA, and decisions for MV Pacific Endeavour', () => {
    const entries = buildVesselActivity({
      vesselId: 'VESSEL-001',
      statusHistory: MOCK_VESSEL_STATUS_HISTORY,
      inspections: getFallbackPhysicalInspections('MV Pacific Endeavour'),
      capaItems: MOCK_CAPA_ITEMS,
      assuranceSets: [...MOCK_ASSURANCE_SETS, ...PROJECT_SEED_ASSURANCE_SETS],
    });
    const kinds = new Set(entries.map((entry) => entry.kind));

    expect(kinds).toEqual(new Set(['status', 'inspection', 'capa', 'decision']));
    expect(entries.map((entry) => Date.parse(entry.at))).toEqual(
      [...entries].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).map((entry) => Date.parse(entry.at)),
    );
  });
});
