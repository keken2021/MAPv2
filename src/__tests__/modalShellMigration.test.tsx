import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AddCrewModal } from '../components/modals/AddCrewModal';
import { EquipmentModal } from '../components/modals/EquipmentModal';
import { VesselImageCropModal } from '../components/modals/VesselImageCropModal';
import { useMapStore } from '../store/useMapStore';

const initialState = useMapStore.getState();

beforeEach(() => {
  useMapStore.setState(initialState, true);
});

describe('AddCrewModal on Modal shell (Task 5416)', () => {
  it('shows the Modal header title', () => {
    render(<AddCrewModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Add Crew' })).toBeInTheDocument();
    expect(screen.getByText('Enter the crew member\'s details and photo.')).toBeInTheDocument();
  });

  it('closes when the Modal close button is clicked', () => {
    const onClose = vi.fn();
    render(<AddCrewModal isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('adds a crew member and shows the success view', () => {
    render(<AddCrewModal isOpen={true} onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/Capt\. James Cook/i), { target: { value: 'Alice Mariner' } });
    fireEvent.change(screen.getByPlaceholderText(/SB-AU-990412/i), { target: { value: 'SB-AU-111222' } });
    fireEvent.change(screen.getByPlaceholderText(/PA-AU-8819023/i), { target: { value: 'PA-AU-9988776' } });

    fireEvent.click(screen.getByTestId('crew-submit'));

    expect(screen.getByRole('heading', { name: 'Crew Member Added' })).toBeInTheDocument();

    const added = useMapStore.getState().crew.find((c: { fullName: string }) => c.fullName === 'Alice Mariner');
    expect(added).toBeDefined();
    expect(added?.seamansBookNo).toBe('SB-AU-111222');
  });
});

describe('EquipmentModal on Modal shell (Task 5416)', () => {
  it('shows the Modal header title', () => {
    render(<EquipmentModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Add Equipment' })).toBeInTheDocument();
  });

  it('closes when the Modal close button is clicked', () => {
    const onClose = vi.fn();
    render(<EquipmentModal isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('registers equipment and calls onRegistered', () => {
    const onRegistered = vi.fn();
    render(<EquipmentModal isOpen={true} onClose={vi.fn()} onRegistered={onRegistered} />);

    fireEvent.change(screen.getByPlaceholderText(/Fixed CO2 Fire Suppression System/i), {
      target: { value: 'Test Fire Extinguisher' },
    });
    fireEvent.change(screen.getByPlaceholderText(/FFE-PE-001/i), { target: { value: 'TEST-EQ-9999' } });

    fireEvent.click(screen.getByTestId('equipment-submit'));

    expect(onRegistered).toHaveBeenCalled();
    const id = onRegistered.mock.calls[0][0];
    const added = useMapStore.getState().equipment?.find((e) => e.id === id);
    expect(added?.name).toBe('Test Fire Extinguisher');
  });
});

describe('VesselImageCropModal on Modal shell (Task 5416)', () => {
  beforeEach(() => {
    if (typeof window.ResizeObserver === 'undefined') {
      window.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }
  });
  it('shows the Modal header title', () => {
    render(
      <VesselImageCropModal
        isOpen={true}
        imageSrc="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
        title="Crop Vessel Photo"
        assetName="MV Test Vessel"
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole('heading', { name: 'Crop Vessel Photo' })).toBeInTheDocument();
    expect(screen.getByText('MV Test Vessel')).toBeInTheDocument();
  });

  it('closes when the Modal close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <VesselImageCropModal
        isOpen={true}
        imageSrc="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
        onSave={vi.fn()}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});
