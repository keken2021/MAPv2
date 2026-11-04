import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { CreateAssuranceSetView } from '../views/CreateAssuranceSetView';
import { clickNext } from './assuranceWizardTestHelpers';

const initialState = useMapStore.getState();

const CLIENT = 'Chevron Australia Pty Ltd';
const VENDOR = 'Northwind Marine Pty Ltd';
const OTHER_ORG = 'Pacific Ocean Logistics Pty Ltd';

describe('Assurance set parties - One requesting and one responding party (Task 5350)', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
    useMapStore.setState({
      assuranceSets: [],
      isAuthenticated: true,
      activePersona: 'Administrator',
      activeDemoOrganization: CLIENT,
    });
  });

  it('prefills the set own organization as Requesting party and the vendor as Responding party', () => {
    const { container } = render(<CreateAssuranceSetView />);

    const clientSelect = container.querySelector(
      `#party-role-${CLIENT.replace(/[^a-zA-Z0-9_-]/g, '\\$&')}`,
    ) as HTMLSelectElement | null;
    const vendorSelect = container.querySelector(
      `#party-role-${VENDOR.replace(/[^a-zA-Z0-9_-]/g, '\\$&')}`,
    ) as HTMLSelectElement | null;

    expect(clientSelect).not.toBeNull();
    expect(clientSelect?.value).toBe('Requesting party');

    expect(vendorSelect).not.toBeNull();
    expect(vendorSelect?.value).toBe('Responding party');
  });

  it('picking a party role on an organization clears that role from the organization that previously held it', () => {
    const { container } = render(<CreateAssuranceSetView />);

    // Add another organization to test moving the role
    const addOrgInput = container.querySelector('#grid-add-organization') as HTMLInputElement | null;
    if (addOrgInput) {
      fireEvent.focus(addOrgInput);
      fireEvent.change(addOrgInput, { target: { value: OTHER_ORG } });
      const option = container.querySelector(
        `#grid-add-organization-listbox [data-item-id="${OTHER_ORG}"]`,
      );
      if (option) fireEvent.click(option);
    }

    const clientSelect = container.querySelector(
      `#party-role-${CLIENT.replace(/[^a-zA-Z0-9_-]/g, '\\$&')}`,
    ) as HTMLSelectElement;
    const vendorSelect = container.querySelector(
      `#party-role-${VENDOR.replace(/[^a-zA-Z0-9_-]/g, '\\$&')}`,
    ) as HTMLSelectElement;

    // Initially: Client is Requesting, Vendor is Responding
    expect(clientSelect.value).toBe('Requesting party');
    expect(vendorSelect.value).toBe('Responding party');

    // Move Requesting party to Vendor
    fireEvent.change(vendorSelect, { target: { value: 'Requesting party' } });

    // Vendor is now Requesting party, and Client is cleared
    expect(vendorSelect.value).toBe('Requesting party');
    expect(clientSelect.value).toBe('');

    // Move Responding party to Client
    fireEvent.change(clientSelect, { target: { value: 'Responding party' } });

    expect(clientSelect.value).toBe('Responding party');
    expect(vendorSelect.value).toBe('Requesting party');
  });

  it('step 3 cannot be left when Requesting or Responding party is missing', () => {
    const { container } = render(<CreateAssuranceSetView />);

    // Clear the Requesting party role from Client
    const clientSelect = container.querySelector(
      `#party-role-${CLIENT.replace(/[^a-zA-Z0-9_-]/g, '\\$&')}`,
    ) as HTMLSelectElement;
    fireEvent.change(clientSelect, { target: { value: '' } });

    // Attempting to advance from Step 1 fails
    clickNext();
    expect(screen.getByTestId('error-requesting-party')).toBeDefined();
    expect(screen.getByTestId('error-requesting-party').textContent).toContain(
      'Select exactly one Requesting party.',
    );

    // Restore Requesting party and clear Responding party
    fireEvent.change(clientSelect, { target: { value: 'Requesting party' } });
    const vendorSelect = container.querySelector(
      `#party-role-${VENDOR.replace(/[^a-zA-Z0-9_-]/g, '\\$&')}`,
    ) as HTMLSelectElement;
    fireEvent.change(vendorSelect, { target: { value: '' } });

    clickNext();
    expect(screen.getByTestId('error-responding-party')).toBeDefined();
    expect(screen.getByTestId('error-responding-party').textContent).toContain(
      'Select exactly one Responding party.',
    );
  });

  it('created assurance set and saved data never hold two Requesting or two Responding parties', () => {
    const { container } = render(<CreateAssuranceSetView />);

    fireEvent.change(container.querySelector('#grid-campaign-title') as HTMLInputElement, {
      target: { value: 'Exactly One Party Role Set' },
    });

    clickNext(); // To Step 2: Objects
    clickNext(); // To Step 3: Requirements
    clickNext(); // To Step 4: Review

    // Create the assurance set
    fireEvent.click(screen.getByRole('button', { name: /Create Assurance Set/i }));

    const createdSet = useMapStore
      .getState()
      .assuranceSets.find((s) => s.title === 'Exactly One Party Role Set');

    expect(createdSet).toBeDefined();
    expect(createdSet?.requestingParty).toBe(CLIENT);
    expect(createdSet?.respondingParty).toBe(VENDOR);

    const requestingParties = (createdSet?.parties || []).filter(
      (p) => p.partyRole === 'Requesting party',
    );
    const respondingParties = (createdSet?.parties || []).filter(
      (p) => p.partyRole === 'Responding party',
    );

    expect(requestingParties.length).toBe(1);
    expect(requestingParties[0].organization).toBe(CLIENT);

    expect(respondingParties.length).toBe(1);
    expect(respondingParties[0].organization).toBe(VENDOR);
  });
});

