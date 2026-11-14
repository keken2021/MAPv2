import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssuranceSet } from '../types/assurance';
import { MasterDocument } from '../types/document';
import { CapaItem } from '../types/capa';
import { AuditTrailEvent } from '../types/audit';
import { SharedDashboardFrame } from '../components/dashboard/SharedDashboardFrame';
import { DashboardView } from '../views/DashboardView';
import { useMapStore } from '../store/useMapStore';
import {
  formatShortDate,
  isDocumentExpiringIn30Days,
  getSubmitterDashboardConfig,
} from '../utils/roleDashboardConfigs';

const mockSets: AssuranceSet[] = [
  {
    id: 'AS-101',
    title: 'Gorgon Survey',
    vesselName: 'MV Aurora',
    vesselId: 'VES-101',
    stage: 'Verification',
    assignedSubmitter: 'M. Chen (Northwind Marine Pty Ltd)',
    assignedVerifier: 'A. Fontaine',
    charterWindowStart: '2026-11-07T00:00:00Z',
    complianceDeadline: '2026-11-07T00:00:00Z',
    requirements: [
      {
        id: 'REQ-1',
        title: 'Safety Equipment Certificate',
        verifierStatus: 'Correction Requested',
        verificationNotes: 'Expired date on scan',
        isFulfilled: false,
      },
      {
        id: 'REQ-2',
        title: 'Class Notation Document',
        verifierStatus: 'Pending',
        isFulfilled: false,
        documentId: '',
      },
    ],
  } as unknown as AssuranceSet,
];

const mockDocuments: MasterDocument[] = [
  {
    id: 'DOC-1',
    title: 'Radio Station License',
    name: 'Radio Station License',
    vesselName: 'MV Borealis',
    vesselAttributes: { vesselName: 'MV Borealis' },
    vesselId: 'VES-101',
    assuranceSetId: 'AS-101',
    expiryDate: '2026-11-28T00:00:00Z', // 23 days from Nov 5
    verificationStatus: 'Verified',
  } as unknown as MasterDocument,
];

const mockCapas: CapaItem[] = [
  {
    id: 'CAPA-101',
    title: 'Fire drill record missing',
    vesselName: 'MV Aurora',
    assuranceSetId: 'AS-101',
    status: 'Open',
    dueDate: '2026-11-08T00:00:00Z',
  } as unknown as CapaItem,
];

const mockAudit: AuditTrailEvent[] = [
  {
    id: 'AUD-1',
    timestampUtc: '2026-11-04T10:00:00Z',
    userId: 'USR-202',
    userRole: 'Verifier',
    organization: 'Bureau Veritas',
    action: 'Verified Certificate',
    targetAsset: 'Certificate of Class',
    target: { kind: 'document', setId: 'AS-101', documentId: 'DOC-1' },
  },
];

describe('Submitter dashboard config (Task 5386)', () => {
  const fixedNow = new Date('2026-11-05T00:00:00Z');

  it('formats short dates correctly', () => {
    expect(formatShortDate('2026-11-08T00:00:00Z')).toBe('8 Nov');
    expect(formatShortDate('2026-11-28T00:00:00Z')).toBe('28 Nov');
  });

  it('detects documents expiring in 30 days', () => {
    expect(isDocumentExpiringIn30Days(mockDocuments[0], fixedNow)).toBe(true);
    const futureDoc = {
      ...mockDocuments[0],
      expiryDate: '2027-05-01T00:00:00Z',
    };
    expect(isDocumentExpiringIn30Days(futureDoc, fixedNow)).toBe(false);
  });

  it('builds KPI tiles with correct tones and labels', () => {
    const setCurrentHashView = vi.fn();
    const config = getSubmitterDashboardConfig({
      assuranceSets: mockSets,
      documents: mockDocuments,
      capaItems: mockCapas,
      auditEvents: mockAudit,
      sessionUser: { id: 'USR-102', name: 'M. Chen', organization: 'Northwind Marine Pty Ltd' },
      activeOrganization: 'Northwind Marine Pty Ltd',
      setCurrentHashView,
      now: fixedNow,
    });

    expect(config.roleTitle).toBe('Submitter');
    expect(config.tiles).toHaveLength(4);

    const [returnedTile, missingTile, expiringTile, findingsTile] = config.tiles;
    expect(returnedTile.label).toBe('Returned');
    expect(returnedTile.tone).toBe('bad');
    expect(returnedTile.value).toBe(1);

    expect(missingTile.label).toBe('Missing');
    expect(missingTile.tone).toBe('warn');
    expect(missingTile.value).toBe(1);

    expect(expiringTile.label).toBe('Expiring in 30 days');
    expect(expiringTile.tone).toBe('warn');
    expect(expiringTile.value).toBe(1);

    expect(findingsTile.label).toBe('Open findings');
    expect(findingsTile.tone).toBe('neutral');
    expect(findingsTile.value).toBe(1);
  });

  it('orders Needs your action strictly: Returned (Re-upload) -> Finding (Respond) -> Missing (Upload) -> Expiring (Renew)', () => {
    const setCurrentHashView = vi.fn();
    const config = getSubmitterDashboardConfig({
      assuranceSets: mockSets,
      documents: mockDocuments,
      capaItems: mockCapas,
      auditEvents: mockAudit,
      sessionUser: { id: 'USR-102', name: 'M. Chen', organization: 'Northwind Marine Pty Ltd' },
      activeOrganization: 'Northwind Marine Pty Ltd',
      setCurrentHashView,
      now: fixedNow,
    });

    expect(config.actionItems).toHaveLength(4);

    // 1. Returned document
    const row1 = config.actionItems[0];
    expect(row1.tag).toBe('Returned');
    expect(row1.buttonLabel).toBe('Re-upload');
    expect(row1.subtitle).toBe('Expired date on scan');

    // 2. Finding
    const row2 = config.actionItems[1];
    expect(row2.tag).toBe('Finding');
    expect(row2.buttonLabel).toBe('Respond');
    expect(row2.subtitle).toBe('Response due 8 Nov');

    // 3. Missing document
    const row3 = config.actionItems[2];
    expect(row3.tag).toBe('Missing');
    expect(row3.buttonLabel).toBe('Upload');
    expect(row3.subtitle).toBe('Set due 7 Nov');

    // 4. Expiring certificate
    const row4 = config.actionItems[3];
    expect(row4.tag).toBe('Expiring');
    expect(row4.buttonLabel).toBe('Renew');
    expect(row4.subtitle).toBe('Expires 28 Nov');

    // Test button actions
    sessionStorage.clear();
    row1.onAction?.();
    expect(setCurrentHashView).toHaveBeenCalledWith('assurance-sets', 'AS-101');
    expect(sessionStorage.getItem('map_assurance_detail_tab_preselect')).toBe('tasks');
    expect(sessionStorage.getItem('map_assurance_focus_req_id')).toBe('REQ-1');

    sessionStorage.clear();
    row2.onAction?.();
    expect(setCurrentHashView).toHaveBeenCalledWith('assurance-sets', 'AS-101');
    expect(sessionStorage.getItem('map_assurance_detail_tab_preselect')).toBe('tasks');
    expect(sessionStorage.getItem('map_assurance_focus_capa_id')).toBe('CAPA-101');

    sessionStorage.clear();
    row3.onAction?.();
    expect(setCurrentHashView).toHaveBeenCalledWith('assurance-sets', 'AS-101');
    expect(sessionStorage.getItem('map_assurance_detail_tab_preselect')).toBe('tasks');
    expect(sessionStorage.getItem('map_assurance_focus_req_id')).toBe('REQ-2');

    row4.onAction?.();
    expect(setCurrentHashView).toHaveBeenCalledWith('documents', 'DOC-1');
  });

  it('renders SharedDashboardFrame with Submitter config and all button interactions', () => {
    sessionStorage.clear();
    const setCurrentHashView = vi.fn();
    const config = getSubmitterDashboardConfig({
      assuranceSets: mockSets,
      documents: mockDocuments,
      capaItems: mockCapas,
      auditEvents: mockAudit,
      sessionUser: { id: 'USR-102', name: 'M. Chen', organization: 'Northwind Marine Pty Ltd' },
      activeOrganization: 'Northwind Marine Pty Ltd',
      setCurrentHashView,
      now: fixedNow,
    });

    render(<SharedDashboardFrame config={config} />);

    expect(screen.getByTestId('shared-dashboard-frame')).toBeInTheDocument();

    // Check tags
    expect(screen.getAllByText('Returned').length).toBeGreaterThan(0);
    expect(screen.getByText('Finding')).toBeInTheDocument();
    expect(screen.getAllByText('Missing').length).toBeGreaterThan(0);
    expect(screen.getByText('Expiring')).toBeInTheDocument();

    // Check action buttons
    const reuploadBtn = screen.getByRole('button', { name: 'Re-upload' });
    const respondBtn = screen.getByRole('button', { name: 'Respond' });
    const uploadBtn = screen.getByRole('button', { name: 'Upload' });
    const renewBtn = screen.getByRole('button', { name: 'Renew' });

    fireEvent.click(reuploadBtn);
    expect(setCurrentHashView).toHaveBeenCalledWith('assurance-sets', 'AS-101');
    expect(sessionStorage.getItem('map_assurance_detail_tab_preselect')).toBe('tasks');

    fireEvent.click(respondBtn);
    expect(setCurrentHashView).toHaveBeenCalledWith('assurance-sets', 'AS-101');
    expect(sessionStorage.getItem('map_assurance_focus_capa_id')).toBe('CAPA-101');

    fireEvent.click(uploadBtn);
    expect(setCurrentHashView).toHaveBeenCalledWith('assurance-sets', 'AS-101');

    fireEvent.click(renewBtn);
    expect(setCurrentHashView).toHaveBeenCalledWith('documents', 'DOC-1');
  });

  /**
    what: verifies Submitter dashboard shows no vessel cards or fleet totals while keeping assigned sets and documents.
    how: renders DashboardView for Submitter persona and verifies absence of vessel tiles/fleet totals and presence of assigned sets subtitle and document action items.
    with what file: src/__tests__/submitterDashboardConfig.test.tsx (Task 5483).
  */
  it('renders Submitter dashboard without vessel tiles or fleet totals, keeping assigned sets and documents', () => {
    useMapStore.setState({
      isAuthenticated: true,
      activePersona: 'Submitter',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: 'USR-102',
      currentHashView: 'dashboard',
    });

    render(<DashboardView />);

    expect(screen.getByTestId('shared-dashboard-frame')).toBeInTheDocument();

    // Must not show any vessel cards or fleet count
    expect(screen.queryByText(/Fleet Total/i)).toBeNull();
    expect(screen.queryByText(/Vessel Cards/i)).toBeNull();
    expect(screen.queryByText(/All Fleet Vessels/i)).toBeNull();

    // Must keep assigned sets and documents
    expect(screen.getByTestId('kpi-tile-returned')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-tile-missing')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-tile-expiring')).toBeInTheDocument();
    expect(screen.getByTestId('needs-your-action-section')).toBeInTheDocument();
  });
});
