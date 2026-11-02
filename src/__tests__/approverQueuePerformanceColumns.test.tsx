import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ApproverDashboardView } from '../views/ApproverDashboardView';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet } from '../types/assurance';
import { CapaItem } from '../types/capa';
import {
  getAssuranceSetOnTimeStatus,
  getAssuranceSetOpenFindingsCount,
  getAssuranceSetRemainingItems,
} from '../utils/readinessHelpers';

const seededSet: AssuranceSet = {
  id: 'AS-PERF-01',
  title: 'Approver performance columns',
  vesselId: 'VESSEL-PERF',
  vesselName: 'Performance Horn',
  imoNumber: '9000001',
  initiatorOrg: 'Oceanic Logistics',
  initiatorRole: 'Vessel Provider',
  charterWindowStart: '2026-11-01',
  charterWindowEnd: '2026-12-31',
  complianceDeadline: '2026-12-31',
  stage: 'Approval',
  approverDecision: 'Pending',
  verificationRequired: true,
  requirements: [
    {
      id: 'REQ-PERF-1',
      category: 'Statutory Certificate',
      title: 'Safety Management Certificate',
      isMandatory: true,
      isFulfilled: false,
      verifierStatus: 'Pending',
      ocrConfidence: 90,
    },
  ],
  assignedApprover: 'P. Nardelli',
  readinessScore: 40,
  mandatoryInspectionRequired: false,
  inspectionCompleted: true,
};

const seededFinding: CapaItem = {
  id: 'CAPA-PERF-01',
  vesselName: 'Performance Horn',
  vesselId: 'VESSEL-PERF',
  assuranceSetId: 'AS-PERF-01',
  checklistItemTitle: 'Open finding',
  title: 'Open finding',
  findingDescription: 'One open finding on the seeded set',
  owner: 'Inspector',
  dueDate: '2026-12-31',
  status: 'Open',
  evidences: [],
  createdDate: '2026-11-01',
};

describe('Approver queue performance columns', () => {
  const initialStore = useMapStore.getState();

  beforeEach(() => {
    useMapStore.setState({
      activePersona: 'Approver',
      isAuthenticated: true,
      activeDemoOrganization: '',
      activeSessionUserId: 'USR-204',
      currentEntityId: undefined,
      assuranceSets: [seededSet],
      capaItems: [seededFinding],
    });
  });

  afterEach(() => {
    useMapStore.setState(initialStore, true);
  });

  it('renders On-Time, Findings and Remaining with the seeded set values', () => {
    render(<ApproverDashboardView />);

    expect(screen.getByRole('columnheader', { name: 'On-Time' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Findings' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Remaining' })).toBeInTheDocument();

    const onTime = getAssuranceSetOnTimeStatus(seededSet);
    const openFindings = getAssuranceSetOpenFindingsCount(seededSet, [seededFinding]);
    const remaining = getAssuranceSetRemainingItems(seededSet);
    const row = screen.getByText('AS-PERF-01').closest('tr') as HTMLTableRowElement;
    const cells = within(row).getAllByRole('cell');

    expect(cells[6]).toHaveTextContent(onTime.statusLabel);
    expect(cells[7]).toHaveTextContent(`${openFindings} open`);
    expect(cells[8]).toHaveTextContent(`${remaining.remainingTasks} task`);
    expect(cells[8]).toHaveTextContent(`${remaining.remainingCertificates} cert`);
    expect(row.closest('.table-responsive')).not.toBeNull();
  });

  it('spans the empty row across the added columns', () => {
    render(<ApproverDashboardView />);
    fireEvent.change(screen.getByPlaceholderText('Search assurance sets...'), {
      target: { value: 'no-such-set' },
    });
    const emptyCell = screen.getByText('No matches').closest('td');
    expect(emptyCell).toHaveAttribute('colspan', '10');
  });
});
