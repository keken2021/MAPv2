import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AssuranceDetailView } from '../views/AssuranceDetailView';
import { ProjectTasksTable } from '../components/tables/ProjectTasksTable';
import { useMapStore } from '../store/useMapStore';
import type { AssuranceRequirement, AssuranceSet } from '../types/assurance';

describe('Task 5380: Keep search, filters, sort and page on return to Tasks tab', () => {
  const testSetId = 'AS-TASK-5380';

  const makeReq = (id: string, title: string, status: 'Pending' | 'Verified' = 'Pending'): AssuranceRequirement => ({
    id,
    title,
    category: 'Statutory Certificate',
    isMandatory: true,
    isFulfilled: status === 'Verified',
    ocrConfidence: 95,
    verifierStatus: status,
    targetDate: '2026-11-20',
    assignedSubmitter: 'M. Chen (Northwind Marine)',
  });

  const testReqs: AssuranceRequirement[] = [
    makeReq('REQ-5380-01', 'Safety Equipment Certificate', 'Pending'),
    makeReq('REQ-5380-02', 'Radio Safety Certificate', 'Verified'),
    makeReq('REQ-5380-03', 'Load Line Certificate', 'Pending'),
  ];

  const testSet: AssuranceSet = {
    id: testSetId,
    title: 'North Sea Drill Support Set',
    vesselName: 'Pacific Supporter',
    vesselId: 'VES-5380',
    imoNumber: '9123456',
    initiatorOrg: 'Chevron Australia',
    initiatorRole: 'Client Admin',
    clientOrg: 'Chevron Australia',
    requestingParty: 'Chevron Australia',
    serviceProviderOrg: 'Northwind Marine',
    respondingParty: 'Northwind Marine',
    charterWindowStart: '2026-01-01',
    charterWindowEnd: '2026-12-31',
    complianceDeadline: '2026-11-30',
    stage: 'Verification',
    readinessScore: 50,
    requirements: testReqs,
    mandatoryInspectionRequired: false,
    inspectionCompleted: false,
  };

  beforeEach(() => {
    cleanup();
    useMapStore.setState({
      assuranceSets: [testSet],
      activePersona: 'Submitter',
      activeDemoOrganization: 'Northwind Marine',
    });
  });

  it('preserves search input and selected filter tab when returning from requirement detail', () => {
    render(<AssuranceDetailView setId={testSetId} initialTab="tasks" />);

    // Confirm Tasks tab pane is visible
    const pane = screen.getByTestId('assurance-detail-tasks-tab-pane');
    expect(pane).toHaveStyle({ display: 'flex' });

    // Enter a search term
    const searchInput = screen.getByPlaceholderText(/Search task name/i) as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'Safety' } });
    expect(searchInput.value).toBe('Safety');

    // Click 'Pending' tab filter
    const pendingTab = screen.getByRole('tab', { name: /^Pending/i });
    fireEvent.click(pendingTab);
    expect(pendingTab).toHaveAttribute('aria-selected', 'true');

    // Navigate to requirement detail via action button
    const actionBtn = screen.getByTestId('task-action-btn-REQ-5380-01');
    fireEvent.click(actionBtn);

    // Requirements tab is active, Tasks pane is now hidden with display: none
    expect(screen.getByRole('tab', { name: 'Requirements' })).toHaveAttribute('aria-selected', 'true');
    expect(pane).toHaveStyle({ display: 'none' });

    // Click "Back to tasks"
    const backBtn = screen.getByRole('button', { name: /Back to tasks/i });
    fireEvent.click(backBtn);

    // Tasks tab is active again and pane is display: flex
    expect(screen.getByRole('tab', { name: 'Tasks' })).toHaveAttribute('aria-selected', 'true');
    expect(pane).toHaveStyle({ display: 'flex' });

    // Search query and filter tab are fully preserved
    const searchInputAfter = screen.getByPlaceholderText(/Search task name/i) as HTMLInputElement;
    expect(searchInputAfter.value).toBe('Safety');
    const pendingTabAfter = screen.getByRole('tab', { name: /^Pending/i });
    expect(pendingTabAfter).toHaveAttribute('aria-selected', 'true');
  });

  it('supports initial and controlled state props on ProjectTasksTable', () => {
    let currentSearch = 'InitQuery';
    let currentStatus = 'pending';

    const { rerender } = render(
      <ProjectTasksTable
        sets={[testSet]}
        scope={{ type: 'set', id: testSet.id }}
        searchTerm={currentSearch}
        onSearchChange={(v) => {
          currentSearch = v;
        }}
        statusTab={currentStatus}
        onStatusTabChange={(tab) => {
          currentStatus = tab;
        }}
      />,
    );

    const input = screen.getByPlaceholderText(/Search task name/i) as HTMLInputElement;
    expect(input.value).toBe('InitQuery');
    const pendingTab = screen.getByRole('tab', { name: /^Pending/i });
    expect(pendingTab).toHaveAttribute('aria-selected', 'true');

    // Fire search change
    fireEvent.change(input, { target: { value: 'UpdatedQuery' } });
    expect(currentSearch).toBe('UpdatedQuery');

    // Rerender with controlled update
    rerender(
      <ProjectTasksTable
        sets={[testSet]}
        scope={{ type: 'set', id: testSet.id }}
        searchTerm={currentSearch}
        onSearchChange={(v) => {
          currentSearch = v;
        }}
        statusTab="done"
        onStatusTabChange={(tab) => {
          currentStatus = tab;
        }}
      />,
    );

    const updatedInput = screen.getByPlaceholderText(/Search task name/i) as HTMLInputElement;
    expect(updatedInput.value).toBe('UpdatedQuery');
    const doneTab = screen.getByRole('tab', { name: /^Done/i });
    expect(doneTab).toHaveAttribute('aria-selected', 'true');
  });
});
