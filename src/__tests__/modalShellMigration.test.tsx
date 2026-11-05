import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AddCrewModal } from '../components/modals/AddCrewModal';
import { EquipmentModal } from '../components/modals/EquipmentModal';
import { VesselImageCropModal } from '../components/modals/VesselImageCropModal';
import { NotificationDetailModal } from '../components/modals/NotificationDetailModal';
import { RequestAssuranceSetModal } from '../components/modals/RequestAssuranceSetModal';
import { AttachAssuranceSetPreviewModal } from '../components/modals/AttachAssuranceSetPreviewModal';
import { useMapStore } from '../store/useMapStore';
import { MOCK_NOTIFICATIONS } from '../store/notificationMockData';
import { AppNotification } from '../types/notification';

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

describe('NotificationDetailModal on Modal shell (Task 5417)', () => {
  const notification = MOCK_NOTIFICATIONS[0] as AppNotification;

  it('shows the notification subject as the Modal header title', () => {
    render(
      <NotificationDetailModal
        notification={notification}
        action={null}
        onClose={vi.fn()}
        onRunAction={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: notification.subject })).toBeInTheDocument();
  });

  it('closes when the footer close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <NotificationDetailModal
        notification={notification}
        action={null}
        onClose={onClose}
        onRunAction={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('notification-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when notification is null', () => {
    const { container } = render(
      <NotificationDetailModal
        notification={null}
        action={null}
        onClose={vi.fn()}
        onRunAction={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('RequestAssuranceSetModal on Modal shell (Task 5417)', () => {
  const project = useMapStore.getState().projects[0];

  it('shows the Modal header title', () => {
    render(
      <RequestAssuranceSetModal
        isOpen={true}
        onClose={vi.fn()}
        project={project}
        onSuccess={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Request Assurance Set' })).toBeInTheDocument();
  });

  it('closes when the Modal close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <RequestAssuranceSetModal
        isOpen={true}
        onClose={onClose}
        project={project}
        onSuccess={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('AttachAssuranceSetPreviewModal on Modal shell (Task 5417)', () => {
  const assuranceSet = useMapStore.getState().assuranceSets[0];
  const project = useMapStore.getState().projects[0];

  it('shows the Modal header title', () => {
    render(
      <AttachAssuranceSetPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        assuranceSet={assuranceSet}
        project={project}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Preview Assurance Set' })).toBeInTheDocument();
  });

  it('closes when the Modal close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <AttachAssuranceSetPreviewModal
        isOpen={true}
        onClose={onClose}
        assuranceSet={assuranceSet}
        project={project}
        onConfirm={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
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
