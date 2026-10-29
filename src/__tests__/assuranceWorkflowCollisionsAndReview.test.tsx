/*
  file summary: tests asset collision validation, demo-friendly date defaults, and itemized crew review UI in CreateAssuranceSetView.
  responsibilities: verifies that assets are picked on the Objects tab, that only an asset already contracted for the period is blocked (booked label, collision alert, next free dates), date pickers default to non-conflicting periods, and summary review renders itemized table rows.
  role in system: validates requirements for the Assurance Set creation workflow.
*/

import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { CreateAssuranceSetView } from '../views/CreateAssuranceSetView';
import { addObject, clickNext, objectItemSelect, objectRowIds, removeObjectRow } from './assuranceWizardTestHelpers';

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

  it('picks the vessel on the Objects tab and blocks only the vessel already contracted for the period', () => {
    const { container } = render(<CreateAssuranceSetView />);
    clickNext();
    const [bookedVesselId] = objectRowIds(container);
    expect(bookedVesselId).toBeTruthy();
    addConflictingSet('Vessel', bookedVesselId);
    expect(screen.getByText(/Asset Collision:/)).toBeInTheDocument();

    /* Next is blocked on the vessel row */
    clickNext();
    expect(container.querySelector('#covered-assurance-objects-card')).not.toBeNull();

    /* once removed, the booked vessel shows the set and dates that hold it */
    removeObjectRow(container, bookedVesselId);
    const options = Array.from(objectItemSelect(container, 'vessel').options);
    const bookedOption = options.find((opt) => opt.value === bookedVesselId);
    expect(bookedOption?.disabled).toBe(true);
    expect(bookedOption?.text).toContain('Booked by AS-VESSEL-CONFLICT (01 MAR 2028');

    /* another vessel takes the same overlapping period */
    const freeOption = options.find((opt) => opt.value && !opt.disabled);
    expect(freeOption).toBeTruthy();
    addObject(container, 'vessel', freeOption!.value);
    expect(screen.queryByText(/Asset Collision:/)).toBeNull();
    clickNext();

    /* the Requirements tab holds only the required documents */
    expect(container.querySelector('#covered-assurance-objects-card')).toBeNull();
    expect(container.querySelector('#grid-charter-start')).toBeNull();
  });

  it("moves the dates to the booked vessel's next free period with one click", () => {
    const { container } = render(<CreateAssuranceSetView />);
    clickNext();
    addConflictingSet('Vessel', objectRowIds(container)[0]);

    fireEvent.click(screen.getByRole('button', { name: 'Use next free dates' }));
    expect(screen.queryByText(/Asset Collision:/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^1\s*General/ }));
    const startInput = container.querySelector('#grid-charter-start') as HTMLInputElement;
    expect(startInput.value >= '2028-08-01').toBe(true);
  });

  it('picks the equipment on the Objects tab and blocks only the equipment already contracted', () => {
    const { container } = render(<CreateAssuranceSetView />);
    clickNext();
    removeObjectRow(container, objectRowIds(container)[0]);

    const firstEquipment = Array.from(objectItemSelect(container, 'equipment').options).find((opt) => opt.value && !opt.disabled);
    expect(firstEquipment).toBeTruthy();
    const bookedId = firstEquipment!.value;
    addObject(container, 'equipment', bookedId);
    addConflictingSet('Equipment', bookedId);
    expect(screen.getByText(/Asset Collision:/)).toBeInTheDocument();
    clickNext();
    expect(container.querySelector('#covered-assurance-objects-card')).not.toBeNull();

    removeObjectRow(container, bookedId);
    const options = Array.from(objectItemSelect(container, 'equipment').options);
    const bookedOption = options.find((opt) => opt.value === bookedId);
    expect(bookedOption?.disabled).toBe(true);
    expect(bookedOption?.text).toContain('Booked by AS-EQUIPMENT-CONFLICT');

    const freeOption = options.find((opt) => opt.value && !opt.disabled);
    expect(freeOption).toBeTruthy();
    addObject(container, 'equipment', freeOption!.value);
    clickNext();
    expect(container.querySelector('#covered-assurance-objects-card')).toBeNull();
  });

  it('renders itemized individual table rows for each selected crew member in review', () => {
    const { container } = render(<CreateAssuranceSetView />);
    clickNext();
    removeObjectRow(container, objectRowIds(container)[0]);

    /* add two crew members on the Objects tab */
    const free = Array.from(objectItemSelect(container, 'person').options).filter((opt) => opt.value && !opt.disabled);
    expect(free.length).toBeGreaterThanOrEqual(2);
    const [firstId, secondId] = [free[0].value, free[1].value];
    addObject(container, 'person', firstId);
    addObject(container, 'person', secondId);

    /* Next to Requirements, then Review */
    clickNext();
    clickNext();

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
