import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NotificationDetailModal } from '../components/modals/NotificationDetailModal';
import { useMapStore } from '../store/useMapStore';
import { AppNotification } from '../types/notification';

describe('Re-upload and Expiry Notice Email Channel (Task 5527 / FR-35)', () => {
  beforeEach(() => {
    const { users } = useMapStore.getState();
    const submitter = users.find((u) => u.id === 'USR-102');
    expect(submitter).toBeDefined();
    expect(submitter?.email).toBeTruthy();
  });

  const baseNotification: AppNotification = {
    id: 'MAP-NTF-2026-DOCR-99001',
    type: 'document_renewal',
    renewalReason: 'reupload_requested',
    subject: 'Reupload requested: Certificate of Class (MV Pacific Endeavour)',
    message: 'The scan is the 2024 issue. Upload the certificate endorsed at the 2026 annual survey.',
    recipientUserId: 'USR-102',
    senderUserId: 'USR-202',
    senderName: 'A. Fontaine',
    status: 'unread',
    createdAt: '2026-10-09T07:20:00.000Z',
    assuranceSetId: 'AS-2026-001',
    documentId: 'MAP-VES-2026-STAT-00001',
    vesselName: 'MV Pacific Endeavour',
  };

  it('renders "Email also sent to ..." line for reupload request notification in details and banner', () => {
    const submitter = useMapStore.getState().users.find((u) => u.id === 'USR-102')!;
    render(
      <NotificationDetailModal
        notification={baseNotification}
        action={null}
        onClose={() => {}}
        onRunAction={() => {}}
      />
    );

    const banner = screen.getByTestId('notice-email-channel');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(`Email also sent to ${submitter.email}`);

    // Also appears as a field in Details
    expect(screen.getByText('Channel')).toBeInTheDocument();
    expect(screen.getByText(`Email also sent to ${submitter.email}`)).toBeInTheDocument();
  });

  it('renders "Email also sent to ..." line for document expiry notice', () => {
    const submitter = useMapStore.getState().users.find((u) => u.id === 'USR-102')!;
    const expiryNotification: AppNotification = {
      ...baseNotification,
      id: 'MAP-NTF-2026-DOCR-99002',
      renewalReason: 'expired',
      subject: 'IOPP Certificate (MV Pacific Endeavour) is expired please re-upload',
      message: 'Certificate expired on 15 Oct 2026. Upload the renewed certificate.',
    };

    render(
      <NotificationDetailModal
        notification={expiryNotification}
        action={null}
        onClose={() => {}}
        onRunAction={() => {}}
      />
    );

    const banner = screen.getByTestId('notice-email-channel');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(`Email also sent to ${submitter.email}`);
  });

  it('does not render the email channel notice line for non-reupload / non-expiry notifications', () => {
    const generalNotification: AppNotification = {
      id: 'MAP-NTF-2026-ASGN-99003',
      type: 'stakeholder_assigned',
      subject: 'Assigned as Verifier to MV Southern Explorer',
      message: 'You have been assigned to review this campaign.',
      recipientUserId: 'USR-202',
      senderUserId: 'USR-101',
      senderName: 'Client Admin',
      status: 'unread',
      createdAt: '2026-10-09T08:00:00.000Z',
    };

    render(
      <NotificationDetailModal
        notification={generalNotification}
        action={null}
        onClose={() => {}}
        onRunAction={() => {}}
      />
    );

    expect(screen.queryByTestId('notice-email-channel')).toBeNull();
    expect(screen.queryByText('Channel')).toBeNull();
  });
});
