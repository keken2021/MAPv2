import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AssuranceDetailView } from '../views/AssuranceDetailView';
import { useMapStore } from '../store/useMapStore';
import { AssuranceRequirement, AssuranceSet } from '../types/assurance';
import { MasterDocument } from '../types/document';
import { AuditTrailEvent } from '../types/audit';
import * as exportHelpers from '../utils/exportHelpers';

vi.mock('../utils/exportHelpers', () => ({
  exportToCsv: vi.fn(),
  exportToPdf: vi.fn(),
}));

describe('Assurance Detail Party Visibility (Task 5309)', () => {
  const originalHash = window.location.hash;

  const mockTestDocNorthwind = {
    id: 'DOC-NW-01',
    title: 'Northwind Class Certificate',
    documentType: 'Certificate',
    category: 'Statutory Certificate',
    currentVersion: 'v1.0',
    status: 'Verified',
    uploadDate: '2026-10-01',
    expiryDate: '2028-10-01',
    issuingAuthority: 'DNV',
    ocrConfidence: 95,
  } as unknown as MasterDocument;

  const mockTestDocMeridian = {
    id: 'DOC-MM-02',
    title: 'Meridian Safety Certificate',
    documentType: 'Certificate',
    category: 'Safety Management',
    currentVersion: 'v2.0',
    status: 'Verified',
    uploadDate: '2026-10-01',
    expiryDate: '2028-10-01',
    issuingAuthority: 'Lloyds',
    ocrConfidence: 88,
  } as unknown as MasterDocument;

  const mockRequirements: AssuranceRequirement[] = [
    {
      id: 'REQ-NW-01',
      subtype: 'Vessel',
      category: 'Statutory Certificate',
      title: 'Northwind Class Certificate',
      description: 'DNV Class certificate maintained by Northwind Marine.',
      isMandatory: true,
      isFulfilled: true,
      ocrConfidence: 95,
      documentId: 'DOC-NW-01',
      documentVersion: 'v1.0',
      verifierStatus: 'Verified',
      notes: 'Northwind internal notes on class.',
      assignedSubmitter: 'M. Chen (Northwind Marine Pty Ltd)',
      sectionId: 'SEC-1',
    },
    {
      id: 'REQ-MM-02',
      subtype: 'Vessel',
      category: 'Safety Management',
      title: 'Meridian Safety Certificate',
      description: 'SOLAS safety certificate maintained by Meridian Marine.',
      isMandatory: true,
      isFulfilled: true,
      ocrConfidence: 88,
      documentId: 'DOC-MM-02',
      documentVersion: 'v2.0',
      verifierStatus: 'Verified',
      notes: 'Meridian internal notes on safety.',
      assignedSubmitter: 'J. Smith (Meridian Marine)',
      sectionId: 'SEC-1',
    },
  ];

  const mockTestSet: AssuranceSet = {
    id: 'AS-TEST-PARTY',
    title: 'Party Visibility Test Set',
    vesselId: 'VESSEL-001',
    vesselName: 'MV Pacific Endeavour',
    initiatorOrg: 'Chevron Australia Pty Ltd',
    createdByUserId: 'USR-221',
    createdByName: 'C. Henderson',
    createdByPersona: 'C Admin',
    clientOrg: 'Chevron Australia Pty Ltd',
    serviceProviderOrg: 'Northwind Marine Pty Ltd',
    assignedApprover: 'P. Nardelli (Marine Assurance Authority)',
    charterWindowStart: '2026-11-01',
    charterWindowEnd: '2027-11-01',
    complianceDeadline: '2026-11-01',
    stage: 'Approval',
    readinessScore: 90,
    sections: [
      {
        id: 'SEC-1',
        name: 'Vessel Operations',
        order: 1,
      },
    ],
    requirements: mockRequirements,
  } as AssuranceSet;

  const mockAuditEvents: AuditTrailEvent[] = [
    {
      id: 'AUD-SET-01',
      timestampUtc: '2026-10-01T08:00:00Z',
      userId: 'USR-102',
      userRole: 'Submitter',
      organization: 'Chevron Australia Pty Ltd',
      action: 'Created Assurance Set',
      targetAsset: 'AS-TEST-PARTY',
      target: { kind: 'set', setId: 'AS-TEST-PARTY' },
    },
    {
      id: 'AUD-DOC-NW',
      timestampUtc: '2026-10-02T09:00:00Z',
      userId: 'USR-102',
      userRole: 'Submitter',
      organization: 'Northwind Marine Pty Ltd',
      action: 'Uploaded Document',
      targetAsset: 'AS-TEST-PARTY / Requirement REQ-NW-01',
      target: { kind: 'task', setId: 'AS-TEST-PARTY', taskId: 'REQ-NW-01' },
      documentStatusDelta: { documentId: 'DOC-NW-01', oldStatus: 'Pending', newStatus: 'Submitted' },
    },
    {
      id: 'AUD-DOC-MM',
      timestampUtc: '2026-10-03T10:00:00Z',
      userId: 'USR-102',
      userRole: 'Submitter',
      organization: 'Meridian Marine',
      action: 'Uploaded Document',
      targetAsset: 'AS-TEST-PARTY / Requirement REQ-MM-02',
      target: { kind: 'task', setId: 'AS-TEST-PARTY', taskId: 'REQ-MM-02' },
      documentStatusDelta: { documentId: 'DOC-MM-02', oldStatus: 'Pending', newStatus: 'Submitted' },
    },
  ];

  beforeEach(() => {
    window.location.hash = '';
    vi.clearAllMocks();

    const currentStore = useMapStore.getState();
    useMapStore.setState({
      ...currentStore,
      assuranceSets: [...currentStore.assuranceSets.filter((s) => s.id !== 'AS-TEST-PARTY'), mockTestSet],
      documents: [
        ...currentStore.documents.filter((d) => d.id !== 'DOC-NW-01' && d.id !== 'DOC-MM-02'),
        mockTestDocNorthwind,
        mockTestDocMeridian,
      ],
      auditEvents: [
        ...(currentStore.auditEvents || []).filter(
          (e) => (e.target as any)?.setId !== 'AS-TEST-PARTY',
        ),
        ...mockAuditEvents,
      ],
      users: [
        ...currentStore.users.filter((u) => u.id !== 'USR-MM'),
        { id: 'USR-MM', name: 'J. Smith', organization: 'Meridian Marine', roles: ['Submitter'], email: 'j.smith@meridian.com', status: 'Active' } as any,
      ],
      activePersona: 'C Admin',
      activeDemoOrganization: 'Chevron Australia Pty Ltd',
      isAuthenticated: true,
      activeSessionUserId: 'USR-221',
    });
  });

  afterEach(() => {
    window.location.hash = originalHash;
  });

  it('renders all tasks, documents, and PDF review buttons for client viewer', () => {
    useMapStore.setState({
      activePersona: 'C Admin',
      activeDemoOrganization: 'Chevron Australia Pty Ltd',
      activeSessionUserId: 'USR-221',
    });

    render(<AssuranceDetailView setId="AS-TEST-PARTY" />);

    // Switch to Requirements tab
    fireEvent.click(screen.getByRole('tab', { name: /requirements/i }));

    // Both requirements are displayed
    expect(screen.getByText('Northwind Class Certificate')).toBeDefined();
    expect(screen.getByText('Meridian Safety Certificate')).toBeDefined();

    // Both have OCR confidence badges when expanded
    const toggleButtons = screen.getAllByTestId(/^toggle-req-/);
    toggleButtons.forEach((btn) => fireEvent.click(btn));
    expect(screen.getByText('95%')).toBeDefined();
    expect(screen.getByText('88%')).toBeDefined();

    // Both have PDF Review buttons
    const reviewButtons = screen.getAllByRole('button', { name: /pdf review/i });
    expect(reviewButtons.length).toBe(2);

    // Both show Verified status
    const verifiedBadges = screen.getAllByText('Verified');
    expect(verifiedBadges.length).toBeGreaterThanOrEqual(2);
  });

  it('hides other party documents for non-client viewer (Northwind Marine)', () => {
    useMapStore.setState({
      activePersona: 'Submitter',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: 'USR-102',
    });

    render(<AssuranceDetailView setId="AS-TEST-PARTY" />);

    // Switch to Requirements tab
    fireEvent.click(screen.getByRole('tab', { name: /requirements/i }));

    // Both requirements exist in structure
    expect(screen.getByText('Northwind Class Certificate')).toBeDefined();
    expect(screen.getByText('Meridian Safety Certificate')).toBeDefined();

    // Expand rows to reveal details
    const toggleButtons = screen.getAllByTestId(/^toggle-req-/);
    toggleButtons.forEach((btn) => fireEvent.click(btn));

    // Northwind task shows its own document details
    expect(screen.getByText('95%')).toBeDefined();

    // Meridian task document is hidden:
    // Only 1 PDF Review button exists (for Northwind task)
    const reviewButtons = screen.getAllByRole('button', { name: /pdf review/i });
    expect(reviewButtons.length).toBe(1);

    // Meridian row displays 'No Document'
    expect(screen.getByText('No Document')).toBeDefined();

    // Meridian row displays 'Awaiting Upload' status instead of 'Verified'
    expect(screen.getByText('Awaiting Upload')).toBeDefined();

    // Meridian row has 0% OCR
    expect(screen.getByText('0%')).toBeDefined();
  });

  it('filters audit trail to hide other party document events for non-client viewer', () => {
    // 1. As Approver: sees all events
    useMapStore.setState({
      activePersona: 'Approver',
      activeSessionUserId: 'USR-204',
      activeDemoOrganization: 'Marine Assurance Authority',
    });

    const { rerender } = render(<AssuranceDetailView setId="AS-TEST-PARTY" />);
    fireEvent.click(screen.getByRole('tab', { name: /audit trail/i }));

    expect(screen.getByText('Created Assurance Set')).toBeDefined();
    expect(screen.getAllByText('Uploaded Document').length).toBe(2);

    // 2. As Northwind Marine: Meridian's Uploaded Document event is hidden
    useMapStore.setState({
      activePersona: 'Submitter',
      activeSessionUserId: 'USR-102',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
    });

    rerender(<AssuranceDetailView setId="AS-TEST-PARTY" />);

    expect(screen.getByText('Created Assurance Set')).toBeDefined();
    // Only 1 Uploaded Document event is visible
    expect(screen.getAllByText('Uploaded Document').length).toBe(1);
    expect(screen.queryByText('Meridian Marine')).toBeNull();
    expect(screen.getByText(/Northwind Marine Pty Ltd/)).toBeDefined();
  });

  it('dynamically adapts document visibility when party organization is switched', () => {
    // Start as Northwind
    useMapStore.setState({
      activePersona: 'Submitter',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: 'USR-102',
    });

    const { rerender } = render(<AssuranceDetailView setId="AS-TEST-PARTY" />);
    fireEvent.click(screen.getByRole('tab', { name: /requirements/i }));

    // Expand rows to reveal details
    screen.getAllByTestId(/^toggle-req-/).forEach((btn) => fireEvent.click(btn));

    expect(screen.getAllByRole('button', { name: /pdf review/i }).length).toBe(1);

    // Switch to Meridian Marine
    useMapStore.setState({
      activePersona: 'Submitter',
      activeDemoOrganization: 'Meridian Marine',
      activeSessionUserId: 'USR-MM',
    });

    rerender(<AssuranceDetailView setId="AS-TEST-PARTY" />);
    screen.getAllByTestId(/^toggle-req-/).forEach((btn) => {
      if (btn.getAttribute('aria-expanded') !== 'true') fireEvent.click(btn);
    });

    // Still only 1 PDF review button, but now Meridian's document is the visible one
    const meridianReviewButtons = screen.getAllByRole('button', { name: /pdf review/i });
    expect(meridianReviewButtons.length).toBe(1);

    // Switch to Chevron (Client)
    useMapStore.setState({
      activePersona: 'C Admin',
      activeDemoOrganization: 'Chevron Australia Pty Ltd',
      activeSessionUserId: 'USR-221',
    });

    rerender(<AssuranceDetailView setId="AS-TEST-PARTY" />);

    // Now both review buttons appear
    expect(screen.getAllByRole('button', { name: /pdf review/i }).length).toBe(2);
  });

  it('redacts other party documents in CSV and PDF exports for non-client viewer', () => {
    useMapStore.setState({
      activePersona: 'Submitter',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: 'USR-102',
    });

    render(<AssuranceDetailView setId="AS-TEST-PARTY" />);

    // Click Export dropdown
    const exportBtn = screen.getByRole('button', { name: /export/i });
    fireEvent.click(exportBtn);

    // Export CSV
    const csvBtn = screen.getByRole('menuitem', { name: /^csv$/i });
    fireEvent.click(csvBtn);

    expect(exportHelpers.exportToCsv).toHaveBeenCalledTimes(1);
    const csvCallArgs = (exportHelpers.exportToCsv as any).mock.calls[0];
    const csvRows = csvCallArgs[1];

    const nwCsvRow = csvRows.find((r: any) => r.Requirement === 'Northwind Class Certificate');
    const mmCsvRow = csvRows.find((r: any) => r.Requirement === 'Meridian Safety Certificate');

    expect(nwCsvRow.Version).toBe('v1.0');
    expect(nwCsvRow.OcrConfidence).toBe('95%');
    expect(nwCsvRow.Status).toBe('Verified');
    expect(nwCsvRow.Notes).toBe('Northwind internal notes on class.');

    // Meridian row is redacted
    expect(mmCsvRow.Version).toBe('');
    expect(mmCsvRow.OcrConfidence).toBe('0%');
    expect(mmCsvRow.Status).toBe('Pending');
    expect(mmCsvRow.Notes).toBe('');

    // Reopen export dropdown and export PDF
    fireEvent.click(exportBtn);
    const pdfBtn = screen.getByRole('menuitem', { name: /^pdf$/i });
    fireEvent.click(pdfBtn);

    expect(exportHelpers.exportToPdf).toHaveBeenCalledTimes(1);
    const pdfCallArgs = (exportHelpers.exportToPdf as any).mock.calls[0];
    const pdfRows = pdfCallArgs[2];

    const nwPdfRow = pdfRows.find((r: any[]) => r[0] === 'Northwind Class Certificate');
    const mmPdfRow = pdfRows.find((r: any[]) => r[0] === 'Meridian Safety Certificate');

    expect(nwPdfRow[1]).toBe('v1.0');
    expect(nwPdfRow[2]).toBe('95%');
    expect(nwPdfRow[3]).toBe('Verified');

    // Meridian row is redacted in PDF
    expect(mmPdfRow[1]).toBe('-');
    expect(mmPdfRow[2]).toBe('0%');
    expect(mmPdfRow[3]).toBe('Pending');
    expect(mmPdfRow[4]).toBe('-');
  });
});
