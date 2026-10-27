/*
  file summary: tests asset collision validation, demo-friendly date defaults, and itemized crew review UI in CreateAssuranceSetView.
  responsibilities: verifies that the asset is picked on the Scope tab, that only an asset already contracted for the period is blocked (booked label, collision alert, next free dates), date pickers default to non-conflicting periods, and summary review renders itemized table rows.
  role in system: validates requirements for the Assurance Set creation workflow.
*/

import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { CreateAssuranceSetView } from '../views/CreateAssuranceSetView';

const initialState = useMapStore.getState();

describe('assurance set workflow: collisions, defaults, and crew review', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
    useMapStore.setState({ isAuthenticated: true, activePersona: 'Administrator' });
  });

  it('pre-populates demo-friendly, non-conflicting date defaults and placeholders', () => {
    const { container } = render(<CreateAssuranceSetView />);
    const startInput = container.querySelector('#grid-charter-start') as HTMLInputElement;
    const endInput = container.querySelector('#grid-charter-end') as HTMLInputElement;

    expect(startInput.value).toBe('2028-01-01');
    expect(endInput.value).toBe('2028-12-31');
    expect(startInput.placeholder).toBe('2028-01-01');
    expect(endInput.placeholder).toBe('2028-12-31');
  });

  /* a saved set holding one asset from 2028-03-01 to 2028-08-01, inside the default contract period */
  const addConflictingSet = (scope: 'Vessel' | 'Equipment', assetId: string) => {
    act(() => {
      useMapStore.setState((state) => ({
        assuranceSets: [
          ...state.assuranceSets,
          {
            id: `AS-${scope.toUpperCase()}-CONFLICT`,
            title: 'Conflict Set',
            assuranceType: scope,
            subtypes: [scope],
            vesselId: scope === 'Vessel' ? assetId : 'VESSEL-001',
            vesselName: 'Conflicting Vessel',
            equipmentId: scope === 'Equipment' ? assetId : undefined,
            equipmentName: scope === 'Equipment' ? 'Conflicting Equipment' : undefined,
            imoNumber: '9123453',
            initiatorOrg: 'Northwind Marine Pty Ltd',
            initiatorRole: 'Vessel Provider Admin',
            charterWindowStart: '2028-03-01',
            complianceDeadline: '2028-03-01',
            charterWindowEnd: '2028-08-01',
            stage: 'Initiated',
            readinessScore: 0,
            requirements: [],
            mandatoryInspectionRequired: false,
            inspectionCompleted: false,
          },
        ],
      }));
    });
  };

  it('picks the vessel on the Scope tab and blocks only the vessel already contracted for the period', () => {
    const { container } = render(<CreateAssuranceSetView />);
    const vesselSelect = container.querySelector('#grid-target-asset-vessel') as HTMLSelectElement;
    expect(vesselSelect).not.toBeNull();

    const bookedVesselId = vesselSelect.value;
    addConflictingSet('Vessel', bookedVesselId);

    /* the booked vessel shows the set and dates that hold it */
    const bookedOption = Array.from(vesselSelect.options).find((opt) => opt.value === bookedVesselId);
    expect(bookedOption?.disabled).toBe(true);
    expect(bookedOption?.text).toContain('Booked by AS-VESSEL-CONFLICT (01 MAR 2028');
    expect(screen.getByText(/Asset Collision:/)).toBeInTheDocument();

    /* Next is blocked on the vessel, not on the dates */
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/Contract period overlaps AS-VESSEL-CONFLICT/)).toBeInTheDocument();
    expect((container.querySelector('#grid-charter-start') as HTMLInputElement).classList.contains('is-invalid')).toBe(false);

    /* another vessel takes the same overlapping period */
    const freeOption = Array.from(vesselSelect.options).find((opt) => !opt.disabled && opt.value !== bookedVesselId);
    expect(freeOption).toBeTruthy();
    fireEvent.change(vesselSelect, { target: { value: freeOption!.value } });
    expect(screen.queryByText(/Asset Collision:/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    /* the vessel tab now holds only the required documents */
    expect(container.querySelector('#grid-target-asset-vessel')).toBeNull();
    expect(container.querySelector('#grid-charter-start')).toBeNull();
  });

  it("moves the dates to the booked vessel's next free period with one click", () => {
    const { container } = render(<CreateAssuranceSetView />);
    const vesselSelect = container.querySelector('#grid-target-asset-vessel') as HTMLSelectElement;
    addConflictingSet('Vessel', vesselSelect.value);

    fireEvent.click(screen.getByRole('button', { name: 'Use next free dates' }));
    const startInput = container.querySelector('#grid-charter-start') as HTMLInputElement;
    expect(startInput.value >= '2028-08-01').toBe(true);
    expect(screen.queryByText(/Asset Collision:/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(container.querySelector('#grid-target-asset-vessel')).toBeNull();
  });

  it('picks the equipment on the Scope tab and blocks only the equipment already contracted', () => {
    const { container } = render(<CreateAssuranceSetView />);
    fireEvent.change(screen.getByLabelText(/^Scope/), { target: { value: 'Equipment' } });

    const eqSelect = container.querySelector('#grid-target-asset-equipment') as HTMLSelectElement;
    expect(eqSelect).not.toBeNull();
    const bookedId = eqSelect.value;
    addConflictingSet('Equipment', bookedId);

    const bookedOption = Array.from(eqSelect.options).find((opt) => opt.value === bookedId);
    expect(bookedOption?.disabled).toBe(true);
    expect(bookedOption?.text).toContain('Booked by AS-EQUIPMENT-CONFLICT');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/Contract period overlaps AS-EQUIPMENT-CONFLICT/)).toBeInTheDocument();

    const freeOption = Array.from(eqSelect.options).find((opt) => !opt.disabled && opt.value !== bookedId);
    expect(freeOption).toBeTruthy();
    fireEvent.change(eqSelect, { target: { value: freeOption!.value } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(container.querySelector('#grid-target-asset-equipment')).toBeNull();
  });

  it('renders itemized individual table rows for each selected crew member in review', () => {
    const { container } = render(<CreateAssuranceSetView />);
    fireEvent.change(screen.getByLabelText(/^Scope/), { target: { value: 'Crew' } });

    /* Select two crew members on the Scope tab */
    const checkboxes = container.querySelectorAll<HTMLInputElement>('#grid-target-asset-crew input[type="checkbox"]:not(:disabled)');
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
    if (!checkboxes[0].checked) fireEvent.click(checkboxes[0]);
    if (!checkboxes[1].checked) fireEvent.click(checkboxes[1]);

    /* Next to the Crew documents tab, then Review */
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    /* Verify Details card does not concatenate full crew list with commas */
    expect(screen.getByText(/Selected Crew Members \(itemized below\)/)).toBeInTheDocument();

    /* Verify distinct individual table rows */
    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    const rows = table!.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);

    /* Verify table header columns (excluding vessel designation) */
    const headers = Array.from(table!.querySelectorAll('thead th')).map((th) => th.textContent?.trim());
    expect(headers).toContain('Crew Member');
    expect(headers).toContain('Rank');
    expect(headers).toContain("Seaman's Book");
    expect(headers).toContain('Organization');
    expect(headers).not.toContain('Current Vessel');
  });
});
