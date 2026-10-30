import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { DocumentLibraryView } from '../views/DocumentLibraryView';
import { AuditTrailView } from '../views/AuditTrailView';
import { useMapStore } from '../store/useMapStore';
import { MasterDocument } from '../types/document';
import { AuditTrailEvent } from '../types/audit';

const document = (
  overrides: Partial<MasterDocument> & Pick<MasterDocument, 'id' | 'complianceState'>,
): MasterDocument => ({
  title: `${overrides.id} certificate`,
  entityType: 'Vessel Certificate',
  vesselId: 'VESSEL-001',
  certificateNo: overrides.id,
  issuingAuthority: 'DNV',
  expiryDate: '2027-01-01',
  ocrConfidence: 96,
  currentVersion: '1.0',
  versions: [],
  validationRules: {
    charterBufferPassed: true,
    assetMatch100Percent: true,
    iacsAuthorityValid: true,
    overallValid: true,
  },
  verificationStatus: 'Verified',
  ...overrides,
});

const auditEvent = (
  overrides: Partial<AuditTrailEvent> & Pick<AuditTrailEvent, 'id'>,
): AuditTrailEvent => ({
  timestampUtc: '2026-10-01T10:00:00Z',
  userId: 'USR-101',
  userRole: 'Administrator',
  organization: 'Northwind Marine Pty Ltd',
  action: 'Updated set',
  targetAsset: 'MV Pacific Endeavour',
  target: { kind: 'set', setId: 'AS-2026-001' },
  ...overrides,
});

describe('Documents and audit trail declutter', () => {
  beforeEach(() => {
    useMapStore.setState({
      activePersona: 'Administrator',
      isAuthenticated: true,
      activeSessionUserId: 'USR-101',
      documents: [
        document({ id: 'DOC-VALID', complianceState: 'Valid' }),
        document({ id: 'DOC-SOON', complianceState: 'Expiring < 6 Mos' }),
        document({ id: 'DOC-EXPIRED', complianceState: 'Expired' }),
        document({ id: 'DOC-MISMATCH', complianceState: 'Mismatch/Exception' }),
      ],
      auditEvents: [
        auditEvent({
          id: 'AUD-CHANGE',
          fieldDelta: { fieldName: 'Deadline', oldValue: '01 May', newValue: '01 Jun' },
          justificationNotes: 'Charter moved',
        }),
        auditEvent({
          id: 'AUD-EMPTY',
          action: 'Viewed set',
          justificationNotes: '   ',
        }),
      ],
    });
  });

  it('replaces document count cards with tabs whose counts match the list', () => {
    const { container } = render(<DocumentLibraryView />);
    expect(container.querySelector('.map-kpi-card')).toBeNull();

    const card = container.querySelector('.map-card-custom') as HTMLElement;
    const tabs = within(card).getByRole('tablist', { name: /document tabs/i });
    const rows = () => within(card).getAllByRole('row').slice(1);

    const all = within(tabs).getByRole('tab', { name: /^all/i });
    expect(all).toHaveClass('is-active');
    expect(all.textContent).toContain('(4)');
    expect(rows()).toHaveLength(4);
    rows().forEach((row) => {
      expect(row.querySelectorAll('.badge')).toHaveLength(1);
    });
    expect(within(card).queryByRole('button', { name: /pdf review|view details/i })).toBeNull();
    expect(within(card).getAllByRole('button', { name: 'View' })).toHaveLength(4);
    expect(screen.queryByText('v1.0')).toBeNull();

    const expiring = within(tabs).getByRole('tab', { name: /expiring soon/i });
    expect(expiring.textContent).toContain('(1)');
    fireEvent.click(expiring);
    expect(rows()).toHaveLength(1);
    expect(screen.getByText('DOC-SOON certificate')).toBeInTheDocument();

    const expired = within(tabs).getByRole('tab', { name: /^expired/i });
    expect(expired.textContent).toContain('(1)');
    fireEvent.click(expired);
    expect(rows()).toHaveLength(1);
    expect(screen.getByText('DOC-EXPIRED certificate')).toBeInTheDocument();
  });

  it('shows one line per audit cell, plain role text, and a dash for empty notes', () => {
    const { container } = render(<AuditTrailView />);
    const card = container.querySelector('.map-card-custom') as HTMLElement;
    expect(card.textContent).not.toMatch(/of \d+ logs/);
    expect(within(card).queryByText('Field:')).toBeNull();
    expect(within(card).queryByText(/^Old:/)).toBeNull();
    expect(within(card).queryByText(/^New:/)).toBeNull();
    expect(within(card).getByText('Deadline: 01 May to 01 Jun')).toBeInTheDocument();
    expect(within(card).getByText('No change')).toBeInTheDocument();
    expect(within(card).getByText('Charter moved')).toBeInTheDocument();
    expect(within(card).getByText('—')).toBeInTheDocument();
    expect(within(card).queryByText('N/A')).toBeNull();
    expect(card.querySelector('.badge')).toBeNull();
    expect(within(card).getAllByText(/Administrator/).length).toBeGreaterThan(0);

    within(card).getAllByRole('row').slice(1).forEach((row) => {
      expect(row.querySelectorAll('.badge')).toHaveLength(0);
      row.querySelectorAll('td').forEach((cell, index) => {
        expect(cell.querySelector('div')).toBeNull();
        if (index !== 5) expect(cell.querySelector('[title]')).toBeNull();
      });
    });
  });
});
