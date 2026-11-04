import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { CreateAssuranceSetView } from '../views/CreateAssuranceSetView';
import {
  clickNext,
  objectPickerOptions,
  objectRowIds,
  removeObjectRow,
} from './assuranceWizardTestHelpers';

const initialState = useMapStore.getState();

const CLIENT = 'Chevron Australia Pty Ltd';
const VENDOR_NORTHWIND = 'Northwind Marine Pty Ltd';
const VENDOR_PACIFIC = 'Pacific Ocean Logistics Pty Ltd';

describe('Assurance wizard - One vendor and one client per set (Task 5332)', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
    const currentEquipment = useMapStore.getState().equipment;
    useMapStore.setState({
      assuranceSets: [],
      isAuthenticated: true,
      activePersona: 'Administrator',
      activeDemoOrganization: 'Marine Assurance Platform',
      equipment: [
        ...currentEquipment,
        {
          id: 'EQ-PACIFIC-01',
          name: 'Pacific Ocean Crane #1',
          equipmentIdentifier: 'EQP-PAC-001',
          category: 'Machinery & Propulsion',
          manufacturer: 'Liebherr',
          model: 'RL-K 4200',
          parentVesselId: 'VESSEL-002',
          owningOrganization: VENDOR_PACIFIC,
          complianceReadinessScore: 90,
          availabilityStatus: 'Available',
          availabilityUpdatedAt: '2026-09-15T08:00:00.000Z',
          registrationStatus: 'Registered',
          registrationUpdatedAt: '2026-09-15T08:00:00.000Z',
          classStatus: 'In Class',
          classStatusUpdatedAt: '2026-09-15T08:00:00.000Z',
          complianceStatus: 'Compliant',
          complianceUpdatedAt: '2026-09-15T08:00:00.000Z',
        },
      ],
    });
  });

  const getOptionHint = (option: HTMLElement) =>
    option.querySelectorAll('span')[1]?.textContent || '';

  it('first assurance object chosen sets the vendor, and object pickers of all types list only objects owned by that vendor', () => {
    const { container } = render(<CreateAssuranceSetView />);
    clickNext();

    // The initial vessel (MV Ocean Pioneer / MV Pacific Endeavour) is from Northwind Marine Pty Ltd
    const rowIds = objectRowIds(container);
    expect(rowIds.length).toBeGreaterThan(0);

    expect(container.querySelector('[data-testid="selected-vendor-badge"]')).toBeNull();

    // Equipment picker only lists Northwind Marine equipment
    const equipmentOptions = objectPickerOptions(container, 'equipment');
    expect(equipmentOptions.length).toBeGreaterThan(0);
    equipmentOptions.forEach((option) => {
      expect(getOptionHint(option)).toBe(VENDOR_NORTHWIND);
    });

    // Vessel picker only lists Northwind Marine vessels
    const vesselOptions = objectPickerOptions(container, 'vessel');
    expect(vesselOptions.length).toBeGreaterThan(0);
    vesselOptions.forEach((option) => {
      expect(getOptionHint(option)).toBe(VENDOR_NORTHWIND);
    });

    // Person/crew picker only lists Northwind Marine crew
    const crewOptions = objectPickerOptions(container, 'person');
    crewOptions.forEach((option) => {
      expect(getOptionHint(option)).toBe(VENDOR_NORTHWIND);
    });
  });

  it('allows mixed object types from the same vendor to be added to the set', () => {
    const { container } = render(<CreateAssuranceSetView />);
    clickNext();

    const initialRows = objectRowIds(container);
    expect(initialRows.length).toBe(1);

    // Add an equipment owned by Northwind Marine
    const equipmentOptions = objectPickerOptions(container, 'equipment');
    const availableEquipment = equipmentOptions.find(
      (opt) => opt.getAttribute('aria-disabled') !== 'true' && getOptionHint(opt) === VENDOR_NORTHWIND,
    );
    expect(availableEquipment).toBeDefined();

    const eqId = availableEquipment!.getAttribute('data-item-id')!;
    fireEvent.click(availableEquipment!);

    // Both vessel and equipment are now present in the set
    const updatedRows = objectRowIds(container);
    expect(updatedRows).toContain(initialRows[0]);
    expect(updatedRows).toContain(eqId);
    expect(updatedRows.length).toBe(2);
  });

  it('removing the last object frees the vendor, allowing an object from another vendor to be chosen', () => {
    const { container } = render(<CreateAssuranceSetView />);
    clickNext();

    // Remove all initial objects
    const initialRows = objectRowIds(container);
    initialRows.forEach((id) => removeObjectRow(container, id));
    expect(objectRowIds(container).length).toBe(0);

    // Vendor badge should no longer be present
    expect(container.querySelector('[data-testid="selected-vendor-badge"]')).toBeNull();

    // Now equipment options from multiple vendors are available
    const equipmentOptions = objectPickerOptions(container, 'equipment');
    const vendorsInOptions = new Set(equipmentOptions.map(getOptionHint));
    expect(vendorsInOptions.has(VENDOR_NORTHWIND)).toBe(true);
    expect(vendorsInOptions.has(VENDOR_PACIFIC)).toBe(true);

    // Select equipment from Pacific Ocean Logistics
    const pacificEq = equipmentOptions.find(
      (opt) => getOptionHint(opt) === VENDOR_PACIFIC && opt.getAttribute('aria-disabled') !== 'true',
    );
    expect(pacificEq).toBeDefined();
    fireEvent.click(pacificEq!);

    // Pacific Ocean Logistics is now the set's vendor
    expect(container.querySelector('[data-testid="selected-vendor-badge"]')).toBeNull();

    // Now pickers only list Pacific Ocean Logistics objects
    const newEquipmentOptions = objectPickerOptions(container, 'equipment');
    newEquipmentOptions.forEach((option) => {
      expect(getOptionHint(option)).toBe(VENDOR_PACIFIC);
    });
  });

  it('review step and created assurance set show and name one Vendor and one Client', () => {
    const { container } = render(<CreateAssuranceSetView />);
    fireEvent.change(container.querySelector('#grid-campaign-title') as HTMLInputElement, {
      target: { value: 'Single Vendor and Client Set' },
    });

    clickNext(); // Step 2: Objects
    // Add equipment from the same vendor
    const equipmentOptions = objectPickerOptions(container, 'equipment');
    const eqOption = equipmentOptions.find(
      (opt) => opt.getAttribute('aria-disabled') !== 'true' && getOptionHint(opt) === VENDOR_NORTHWIND,
    );
    if (eqOption) {
      fireEvent.click(eqOption);
    }

    clickNext(); // Step 3: Requirements
    clickNext(); // Step 4: Review

    // Review step displays Requesting party and Responding party under Details
    const clientEl = screen.getByTestId('review-client');
    const vendorEl = screen.getByTestId('review-vendor');
    expect(clientEl.textContent).toContain('Requesting party:');
    expect(vendorEl.textContent).toContain('Responding party:');
    expect(vendorEl.textContent).toContain(VENDOR_NORTHWIND);

    // Create the assurance set
    fireEvent.click(screen.getByRole('button', { name: /Create Assurance Set/i }));

    const createdSet = useMapStore
      .getState()
      .assuranceSets.find((s) => s.title === 'Single Vendor and Client Set');
    expect(createdSet).toBeDefined();
    expect(createdSet?.serviceProviderOrg).toBe(VENDOR_NORTHWIND);
    expect(createdSet?.requestingParty).toBe('Marine Assurance Platform');
    expect(createdSet?.respondingParty).toBe(VENDOR_NORTHWIND);
    expect(createdSet?.parties?.some((p) => p.group === 'Vendor' && p.organization === VENDOR_NORTHWIND)).toBe(true);
    expect(createdSet?.parties?.some((p) => p.group === 'Client')).toBe(true);
  });
});
