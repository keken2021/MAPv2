/*
  file summary: tests that a crew assurance set can cover several crew members.
  responsibilities: verifies the crew helpers, that the store keeps every crew member of a new set, that non-crew sets carry no crew list, that each member counts as contracted, and that the wizard picks crew members with checkboxes on the Scope tab.
  role in system: covers ADR 0023 in src/utils/assuranceTemplates.ts, useMapStore.ts addAssuranceSet, marketplaceHelpers.ts, projectHelpers.ts and the Scope tab of CreateAssuranceSetView.tsx.
*/

import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet } from '../types/assurance';
import {
  getAssuranceSetAssets,
  getAssuranceSetCrewIds,
  getAssuranceSetCrewNames,
  toSingleAssetSet,
} from '../utils/assuranceTemplates';
import { isMarketplaceItemAvailableOnDate } from '../utils/marketplaceHelpers';
import { getCharterAssuranceSetsForAsset } from '../utils/projectHelpers';
import { CreateAssuranceSetView } from '../views/CreateAssuranceSetView';

const initialState = useMapStore.getState();

const crewSet = (overrides: Partial<AssuranceSet> = {}): AssuranceSet => ({
  id: 'AS-MULTI-CREW-01',
  title: 'Multi Crew Vetting Test',
  assuranceType: 'Crew',
  subtypes: ['Crew'],
  crewId: 'CREW-101',
  crewName: 'Capt. Alexander Wright',
  crewIds: ['CREW-101', 'CREW-105'],
  crewNames: ['Capt. Alexander Wright', "Second Eng. Liam O'Connor"],
  vesselId: 'VESSEL-001',
  vesselName: 'MV Pacific Endeavour',
  imoNumber: '9123453',
  initiatorOrg: 'Chevron Australia Pty Ltd',
  initiatorRole: 'C Admin · Client Created',
  charterWindowStart: '2028-01-01',
  complianceDeadline: '2028-01-01',
  charterWindowEnd: '2028-06-01',
  stage: 'Initiated',
  readinessScore: 0,
  requirements: [],
  mandatoryInspectionRequired: false,
  inspectionCompleted: false,
  ...overrides,
});

describe('multi-crew assurance sets', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
  });

  it('lists every crew member of a set, and falls back to the single crewId', () => {
    const set = crewSet();
    expect(getAssuranceSetCrewIds(set)).toEqual(['CREW-101', 'CREW-105']);
    expect(getAssuranceSetCrewNames(set)).toEqual(['Capt. Alexander Wright', "Second Eng. Liam O'Connor"]);
    expect(getAssuranceSetAssets(set).map((a) => a.id)).toEqual(['CREW-101', 'CREW-105']);

    const single = crewSet({ crewIds: undefined, crewNames: undefined });
    expect(getAssuranceSetCrewIds(single)).toEqual(['CREW-101']);
    expect(getAssuranceSetAssets(single)).toEqual([{ type: 'Crew', id: 'CREW-101', name: 'Capt. Alexander Wright' }]);
  });

  it('keeps the crew list on a crew set and drops it on a set filed under another scope', () => {
    expect(toSingleAssetSet(crewSet()).crewIds).toEqual(['CREW-101', 'CREW-105']);
    const vesselSet = toSingleAssetSet(crewSet({ assuranceType: 'Vessel', subtypes: ['Vessel'] }));
    expect(vesselSet.crewIds).toBeUndefined();
    expect(vesselSet.crewId).toBeUndefined();
  });

  it('saves every crew member of a new set, with the first one as crewId', () => {
    useMapStore.getState().setActivePersona('Administrator');
    useMapStore.getState().addAssuranceSet(crewSet());
    const saved = useMapStore.getState().assuranceSets.find((s) => s.title === 'Multi Crew Vetting Test');
    expect(saved?.crewIds).toEqual(['CREW-101', 'CREW-105']);
    expect(saved?.crewId).toBe('CREW-101');
  });

  it('treats each crew member as contracted for the set period', () => {
    const sets = [crewSet()];
    const second = { category: 'crew' as const, linkedEntityId: 'CREW-105', linkedEntityType: 'crew' as const };
    expect(isMarketplaceItemAvailableOnDate(second, '2028-03-01', sets)).toBe(false);
    expect(isMarketplaceItemAvailableOnDate(second, '2028-06-01', sets)).toBe(true);
    expect(getCharterAssuranceSetsForAsset('Crew', 'CREW-105', sets).map((s) => s.id)).toEqual(['AS-MULTI-CREW-01']);
  });

  it('seeds one crew set with two crew members', () => {
    const seeded = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-CRW-102-01');
    expect(seeded && getAssuranceSetCrewIds(seeded)).toEqual(['CREW-102', 'CREW-103']);
  });

  it('picks crew members with checkboxes on the Scope tab and blocks only a member already contracted', () => {
    useMapStore.setState({ isAuthenticated: true, activePersona: 'Administrator' });
    const { container } = render(<CreateAssuranceSetView />);
    fireEvent.change(screen.getByLabelText(/^Scope/), { target: { value: 'Crew' } });

    /* Demo-friendly non-conflicting default dates */
    const startInput = container.querySelector('#grid-charter-start') as HTMLInputElement;
    const endInput = container.querySelector('#grid-charter-end') as HTMLInputElement;
    expect(startInput.value).toBe('2028-01-01');
    expect(endInput.value).toBe('2028-12-31');

    const group = screen.getByRole('group', { name: /Crew Members/ });
    expect(group.querySelector('select')).toBeNull();
    const first = screen.getByRole('checkbox', { name: /Capt\. Alexander Wright/ }) as HTMLInputElement;
    const fifth = screen.getByRole('checkbox', { name: /Liam O'Connor/ }) as HTMLInputElement;
    expect(first.checked).toBe(true);

    /* a period overlapping Capt. Alexander Wright's set AS-CRW-101-01 blocks him, not the period */
    fireEvent.change(startInput, { target: { value: '2026-11-01' } });
    fireEvent.change(endInput, { target: { value: '2027-11-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/Contract period overlaps AS-CRW-101-01/)).toBeInTheDocument();
    expect(startInput.classList.contains('is-invalid')).toBe(false);

    /* the contracted member can still be unticked, and a free member takes the same period */
    expect(first.disabled).toBe(false);
    fireEvent.click(first);
    expect(first.checked).toBe(false);
    expect(first.disabled).toBe(true);
    fireEvent.click(fifth);
    expect(fifth.checked).toBe(true);
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    /* a member already contracted for the period cannot be ticked */
    act(() => {
      useMapStore.setState((state) => ({
        assuranceSets: state.assuranceSets.map((set) =>
          set.id === 'AS-CRW-102-01' ? { ...set, charterWindowStart: '2027-03-01', charterWindowEnd: '2027-09-01' } : set,
        ),
      }));
    });
    const sarahCheckbox = screen.getByRole('checkbox', { name: /Sarah Jenkins/ }) as HTMLInputElement;
    expect(sarahCheckbox.disabled).toBe(true);
    expect(screen.getAllByText(/Booked by AS-CRW-102-01/)).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.queryByRole('group', { name: /Crew Members/ })).toBeNull();
  });

  it('renders each selected crew as a distinct individual table row in the review step', () => {
    useMapStore.setState({ isAuthenticated: true, activePersona: 'Administrator' });
    const { container } = render(<CreateAssuranceSetView />);
    fireEvent.change(screen.getByLabelText(/^Scope/), { target: { value: 'Crew' } });
    /* Select a second crew member on the Scope tab */
    const second = screen.getByRole('checkbox', { name: /Liam O'Connor/ });
    fireEvent.click(second);
    expect(screen.getByText('2 selected')).toBeInTheDocument();

    /* Advance through the Crew documents tab to Review */
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    /* Summary review shows itemized table with distinct rows */
    expect(screen.getAllByText(/2 Selected Crew Member/)).toHaveLength(2);
    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    const rows = table!.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Capt. Alexander Wright');
    expect(rows[0].textContent).toContain('Master');
    expect(rows[1].textContent).toContain("Second Eng. Liam O'Connor");
    expect(rows[1].textContent).toContain('Second Engineer');
  });
});
