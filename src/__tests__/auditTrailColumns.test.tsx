import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { AuditTrailEvent } from '../types/audit';
import { useMapStore } from '../store/useMapStore';
import { AuditTrailView } from '../views/AuditTrailView';

const FULL_NOTE =
  'Re-uploaded the class certificate after the verifier returned it, and confirmed the scan matches the vessel IMO and the charter window.';

const auditEvent = (
  overrides: Partial<AuditTrailEvent> & Pick<AuditTrailEvent, 'id'>,
): AuditTrailEvent => ({
  timestampUtc: '2026-10-01T10:00:00Z',
  userId: 'USR-101',
  userRole: 'Administrator',
  organization: 'Northwind Marine Pty Ltd',
  action: 'Uploaded Document Revision v1.1',
  targetAsset: 'MAP-VES-2026-STAT-00001 (Certificate of Class)',
  target: { kind: 'set', setId: 'AS-2026-001' },
  justificationNotes: FULL_NOTE,
  ...overrides,
});

describe('audit trail columns', () => {
  beforeEach(() => {
    useMapStore.setState({
      isAuthenticated: true,
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: 'USR-101',
      auditEvents: [auditEvent({ id: 'AUD-NOTE' })],
    });
  });

  it('keeps six columns and puts the full note in the notes tooltip', () => {
    const { container } = render(<AuditTrailView />);
    const table = container.querySelector('table') as HTMLTableElement;
    const headers = within(table).getAllByRole('columnheader');

    expect(headers).toHaveLength(6);
    expect(headers.map((header) => header.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Timestamp (UTC)',
      'Action',
      'Target',
      'Role',
      'Change',
      'Notes',
    ]);
    expect(headers[0].style.width).toBe('9.5rem');
    expect(headers[3].style.width).toBe('13.5rem');
    expect(headers[4].style.width).toBe('11rem');
    expect(table.style.tableLayout).toBe('fixed');

    const note = screen.getByTitle(FULL_NOTE);
    expect(note).toHaveAttribute('tabIndex', '0');
    expect(note.textContent).toBe(FULL_NOTE);
    expect(note.className).toContain('text-truncate');
  });
});
