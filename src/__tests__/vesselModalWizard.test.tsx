import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { VesselModal } from '../components/modals/VesselModal';
import { useMapStore } from '../store/useMapStore';

const initialState = useMapStore.getState();

describe('VesselModal with Wizard and Modal shells (Task 5415)', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
  });

  it('renders four steps in the wizard stepper and registers a vessel', () => {
    const handleClose = vi.fn();
    const handleRegistered = vi.fn();

    render(
      <VesselModal
        isOpen={true}
        onClose={handleClose}
        onRegistered={handleRegistered}
      />,
    );

    // Verify Modal shell header
    expect(screen.getByRole('heading', { name: 'Add Vessel' })).toBeInTheDocument();
    expect(screen.getByText('Complete each section to add the vessel.')).toBeInTheDocument();

    // Verify Wizard shell steps
    expect(screen.getByRole('button', { name: /^1\s*Identification & Class/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^2\s*Construction & Ownership/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^3\s*Safety, Crew & Insurance/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^4\s*Statutory Certs & Uploads/ })).toBeInTheDocument();

    // Fill Step 1 required identifiers
    const nameInput = screen.getByPlaceholderText(/e\.g\. MV Pacific Supporter/i);
    const imoInput = screen.getByPlaceholderText(/e\.g\. 9481234/i);
    const regInput = screen.getByPlaceholderText(/e\.g\. OSV-99-2023/i);

    fireEvent.change(nameInput, { target: { value: 'Ocean Pioneer 2026' } });
    fireEvent.change(imoInput, { target: { value: '9074729' } });
    fireEvent.change(regInput, { target: { value: 'REG-2026-99' } });

    // Advance to Step 2
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    // Step 2: fill registered owner
    const ownerInput = screen.getByPlaceholderText(/e\.g\. Northwind Marine Pty Ltd/i);
    fireEvent.change(ownerInput, { target: { value: 'Pioneer Shipping Pty Ltd' } });

    // Advance to Step 3
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    // Advance to Step 4
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    // Submit on Step 4
    const submitBtn = screen.getByRole('button', { name: 'Add Vessel' });
    expect(submitBtn).toBeInTheDocument();
    fireEvent.click(submitBtn);

    // Verify registration callbacks and store insertion
    expect(handleRegistered).toHaveBeenCalled();
    const registeredVesselId = handleRegistered.mock.calls[0][0];
    expect(registeredVesselId).toMatch(/^MAP-VES-/);
    expect(handleClose).toHaveBeenCalled();

    const added = useMapStore.getState().vessels.find((v) => v.id === registeredVesselId);
    expect(added).toBeDefined();
    expect(added?.name).toBe('Ocean Pioneer 2026');
    expect(added?.imoNumber).toBe('9074729');
  });
});
