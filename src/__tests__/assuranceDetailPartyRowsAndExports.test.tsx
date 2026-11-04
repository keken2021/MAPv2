import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AssuranceDetailView } from '../views/AssuranceDetailView';
import { useMapStore } from '../store/useMapStore';
import { AssuranceRequirement, AssuranceSet } from '../types/assurance';
import { MasterDocument } from '../types/document';
import * as exportHelpers from '../utils/exportHelpers';

vi.mock('../utils/exportHelpers', () => ({
  exportToCsv: vi.fn(),
  exportToPdf: vi.fn(),
}));

const initialState = useMapStore.getState();

describe('Assurance Detail Shared Requirements - Party Rows and Exports (Task 5308 / Finding 5d-04)', () => {
  const mockDocOceanic: MasterDocument = {
    id: 'DOC-OC-01',
    title: 'Oceanic Certificate of Class',
    documentType: 'Certificate',
    category: 'Class Notation Certificate',
    currentVersion: 'v1.0',
    versions: [
      {
        versionLabel: 'v1.0',
        uploadDate: '2026-10-01',
        uploadedBy: 'J. Ocean',
        fileName: 'oceanic-class.pdf',
        fileSize: '1.2MB',
      },
    ],
    status: 'Verified',
    uploadDate: '2026-10-01',
    expiryDate: '2028-10-01',
    issuingAuthority: 'DNV',
    ocrConfidence: 94,
  } as unknown as MasterDocument;

  const mockTwoPartyRequirements: AssuranceRequirement[] = [
    {
      id: 'REQ-CLASS-01',
      title: 'Certificate of Class',
      category: 'Class Notation Certificate',
      subtype: 'Vessel',
      sectionId: 'sec-vessel',
      isMandatory: true,
      isFulfilled: true,
      ocrConfidence: 94,
      documentId: 'DOC-OC-01',
      documentVersion: 'v1.0',
      verifierStatus: 'Verified',
      responsibleParty: 'Oceanic Horizon Logistics Pty Ltd',
      responsibleParties: ['Oceanic Horizon Logistics Pty Ltd', 'Chevron Australia Pty Ltd'],
      requirementGroupId: 'grp-vessel-class',
      notes: 'Oceanic class certificate verified by DNV.',
    },
    {
      id: 'REQ-CLASS-02',
      title: 'Certificate of Class',
      category: 'Class Notation Certificate',
      subtype: 'Vessel',
      sectionId: 'sec-vessel',
      isMandatory: true,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending',
      responsibleParty: 'Chevron Australia Pty Ltd',
      responsibleParties: ['Oceanic Horizon Logistics Pty Ltd', 'Chevron Australia Pty Ltd'],
      requirementGroupId: 'grp-vessel-class',
      notes: 'Awaiting Chevron endorsement.',
    },
    {
      id: 'REQ-SINGLE-01',
      title: 'Safety Equipment Certificate',
      category: 'Safety Management',
      subtype: 'Vessel',
      sectionId: 'sec-vessel',
      isMandatory: true,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending',
      responsibleParty: 'Oceanic Horizon Logistics Pty Ltd',
      requirementGroupId: 'grp-safety-equip',
      notes: 'Single party requirement.',
    },
  ];

  const mockTestSet: AssuranceSet = {
    ...initialState.assuranceSets[0],
    id: 'AS-TEST-5308',
    title: 'Party Rows and Export Test Set',
    clientOrg: 'Chevron Australia Pty Ltd',
    serviceProviderOrg: 'Oceanic Horizon Logistics Pty Ltd',
    charterWindowStart: '2026-11-01',
    charterWindowEnd: '2027-11-01',
    complianceDeadline: '2026-11-01',
    stage: 'Initiated',
    approverDecision: undefined,
    readinessScore: 65,
    sections: [
      {
        id: 'sec-vessel',
        name: 'Vessel documents',
        order: 1,
      },
    ],
    requirements: mockTwoPartyRequirements,
  } as unknown as AssuranceSet;

  beforeEach(() => {
    vi.clearAllMocks();
    useMapStore.setState(initialState, true);
    useMapStore.setState({
      isAuthenticated: true,
      activePersona: 'C Admin',
      activeDemoOrganization: 'Chevron Australia Pty Ltd',
      assuranceSets: [mockTestSet, ...initialState.assuranceSets],
      documents: [mockDocOceanic, ...initialState.documents],
    });
  });

  it('renders one sub-row per party task on a shared requirement, each with its own status', () => {
    const { container } = render(<AssuranceDetailView setId="AS-TEST-5308" />);

    // Switch to Requirements tab
    fireEvent.click(screen.getByRole('tab', { name: /requirements/i }));

    // Verify main row for shared requirement
    const sharedReqRow = container.querySelector('[data-testid="shared-requirement-row"]');
    expect(sharedReqRow).not.toBeNull();
    expect(within(sharedReqRow as HTMLElement).getByText('Certificate of Class')).toBeInTheDocument();
    expect(within(sharedReqRow as HTMLElement).getByText(/Shared \(2 parties\)/i)).toBeInTheDocument();

    // Verify exactly TWO sub-rows are rendered for the two-party requirement
    const subRows = container.querySelectorAll('[data-testid="party-sub-row"]');
    expect(subRows.length).toBe(2);

    // Sub-row 1: Oceanic Horizon Logistics Pty Ltd (Verified)
    const party1 = subRows[0].getAttribute('data-party');
    expect(party1).toBe('Oceanic Horizon Logistics Pty Ltd');
    expect(within(subRows[0] as HTMLElement).getByText('Oceanic Horizon Logistics Pty Ltd')).toBeInTheDocument();
    expect(within(subRows[0] as HTMLElement).getByText('Verified')).toBeInTheDocument();
    fireEvent.click(within(subRows[0] as HTMLElement).getByTestId('toggle-req-REQ-CLASS-01'));
    expect(screen.getByText('94%')).toBeInTheDocument();

    // Sub-row 2: Chevron Australia Pty Ltd (Awaiting Upload / Pending)
    const party2 = subRows[1].getAttribute('data-party');
    expect(party2).toBe('Chevron Australia Pty Ltd');
    expect(within(subRows[1] as HTMLElement).getByText('Chevron Australia Pty Ltd')).toBeInTheDocument();
    expect(within(subRows[1] as HTMLElement).getByText('Awaiting Upload')).toBeInTheDocument();

    // Main row shows requirement is incomplete ("In Progress (1/2)") because Chevron task is pending
    expect(within(sharedReqRow as HTMLElement).getByText(/In Progress \(1\/2\)/i)).toBeInTheDocument();

    // Single requirement does NOT render party sub-rows
    const singleReqRow = container.querySelector('[data-requirement-id="REQ-SINGLE-01"]');
    expect(singleReqRow).not.toBeNull();
    expect(within(singleReqRow as HTMLElement).getByText('Safety Equipment Certificate')).toBeInTheDocument();
  });

  it('marks shared requirement as complete only when all party tasks are fulfilled/verified', () => {
    // Complete Chevron task
    const updatedRequirements = mockTwoPartyRequirements.map((r) =>
      r.id === 'REQ-CLASS-02' ? { ...r, verifierStatus: 'Verified' as const, isFulfilled: true, documentId: 'DOC-OC-01' } : r,
    );

    useMapStore.setState((prev) => ({
      ...prev,
      assuranceSets: prev.assuranceSets.map((s) =>
        s.id === 'AS-TEST-5308' ? { ...s, requirements: updatedRequirements } : s,
      ),
    }));

    const { container } = render(<AssuranceDetailView setId="AS-TEST-5308" />);
    fireEvent.click(screen.getByRole('tab', { name: /requirements/i }));

    const sharedReqRow = container.querySelector('[data-testid="shared-requirement-row"]');
    expect(sharedReqRow).not.toBeNull();

    // Now all 2 tasks are verified, overall status must be Verified
    const overallStatus = within(sharedReqRow as HTMLElement).getByTestId('shared-req-status');
    expect(overallStatus.textContent?.trim()).toBe('Verified');
  });

  it('adds Responsible party column to CSV and PDF exports naming the party for each row', () => {
    render(<AssuranceDetailView setId="AS-TEST-5308" />);

    // Click Export dropdown
    const exportBtn = screen.getByRole('button', { name: /export/i });
    fireEvent.click(exportBtn);

    // Export CSV
    const csvBtn = screen.getByRole('menuitem', { name: /^csv$/i });
    fireEvent.click(csvBtn);

    expect(exportHelpers.exportToCsv).toHaveBeenCalledTimes(1);
    const csvCallArgs = (exportHelpers.exportToCsv as any).mock.calls[0];
    const csvRows = csvCallArgs[1];

    // Every row in CSV must have 'Responsible Party' column
    expect(csvRows.length).toBe(3);
    const oceanicClassRow = csvRows.find(
      (r: any) => r.Requirement === 'Certificate of Class' && r['Responsible Party'] === 'Oceanic Horizon Logistics Pty Ltd',
    );
    const chevronClassRow = csvRows.find(
      (r: any) => r.Requirement === 'Certificate of Class' && r['Responsible Party'] === 'Chevron Australia Pty Ltd',
    );
    const safetyRow = csvRows.find(
      (r: any) => r.Requirement === 'Safety Equipment Certificate' && r['Responsible Party'] === 'Oceanic Horizon Logistics Pty Ltd',
    );

    expect(oceanicClassRow).toBeDefined();
    expect(oceanicClassRow['Responsible Party']).toBe('Oceanic Horizon Logistics Pty Ltd');
    expect(oceanicClassRow.Status).toBe('Verified');

    expect(chevronClassRow).toBeDefined();
    expect(chevronClassRow['Responsible Party']).toBe('Chevron Australia Pty Ltd');
    expect(chevronClassRow.Status).toBe('Pending');

    expect(safetyRow).toBeDefined();
    expect(safetyRow['Responsible Party']).toBe('Oceanic Horizon Logistics Pty Ltd');

    // Reopen export dropdown and export PDF
    fireEvent.click(exportBtn);
    const pdfBtn = screen.getByRole('menuitem', { name: /^pdf$/i });
    fireEvent.click(pdfBtn);

    expect(exportHelpers.exportToPdf).toHaveBeenCalledTimes(1);
    const pdfCallArgs = (exportHelpers.exportToPdf as any).mock.calls[0];
    const pdfHeaders = pdfCallArgs[1] as string[];
    const pdfRows = pdfCallArgs[2] as (string | number)[][];

    // Headers must include 'Responsible Party'
    const partyColIndex = pdfHeaders.indexOf('Responsible Party');
    expect(partyColIndex).toBeGreaterThan(-1);

    // Rows must name the party at the corresponding column
    const oceanicPdfRow = pdfRows.find((r) => r[0] === 'Certificate of Class' && r[partyColIndex] === 'Oceanic Horizon Logistics Pty Ltd');
    const chevronPdfRow = pdfRows.find((r) => r[0] === 'Certificate of Class' && r[partyColIndex] === 'Chevron Australia Pty Ltd');

    expect(oceanicPdfRow).toBeDefined();
    expect(chevronPdfRow).toBeDefined();
  });
});
