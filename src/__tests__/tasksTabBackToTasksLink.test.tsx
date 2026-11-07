import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AssuranceDetailView } from '../views/AssuranceDetailView';
import { useMapStore } from '../store/useMapStore';
import type { AssuranceRequirement, AssuranceSet } from '../types/assurance';

describe('Task 5379: Back to tasks link after opening a requirement', () => {
  const testSetId = 'AS-TASK-5379';

  beforeEach(() => {
    cleanup();
    const testReq: AssuranceRequirement = {
      id: 'REQ-5379-01',
      title: 'Safety Equipment Certificate',
      category: 'Statutory Certificate',
      isMandatory: true,
      isFulfilled: false,
      ocrConfidence: 95,
      verifierStatus: 'Pending',
      targetDate: '2026-11-20',
      assignedSubmitter: 'M. Chen (Northwind Marine)',
    };

    const testSet: AssuranceSet = {
      id: testSetId,
      title: 'North Sea Drill Support Set',
      vesselName: 'Pacific Supporter',
      vesselId: 'VES-5379',
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
      requirements: [testReq],
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
    };

    useMapStore.setState({
      assuranceSets: [testSet],
      activePersona: 'Submitter',
      activeDemoOrganization: 'Northwind Marine',
    });
  });

  it('shows Back to tasks link after opening a requirement from the Tasks tab, returns to Tasks on click, and clears itself', () => {
    render(<AssuranceDetailView setId={testSetId} initialTab="tasks" />);

    // 1. Initially on Tasks tab: Back to tasks link does not exist
    expect(screen.queryByRole('button', { name: /Back to tasks/i })).toBeNull();
    expect(screen.getByTestId('project-tasks-tab')).toBeInTheDocument();

    // 2. Click the Upload action button on the task row
    const uploadBtn = screen.getByTestId('task-action-btn-REQ-5379-01');
    expect(uploadBtn).toHaveTextContent('Upload');
    fireEvent.click(uploadBtn);

    // 3. Lands on Requirements tab and Back to tasks link is now displayed in the header
    const backToTasksBtn = screen.getByRole('button', { name: /Back to tasks/i });
    expect(backToTasksBtn).toBeInTheDocument();
    expect(screen.getByText('Back to tasks')).toBeInTheDocument();

    // Requirements tab is active
    const reqTab = screen.getByRole('tab', { name: /^Requirements/ });
    expect(reqTab).toHaveAttribute('aria-selected', 'true');

    // 4. Click Back to tasks
    fireEvent.click(backToTasksBtn);

    // 5. Lands on Tasks tab and the link is gone
    const tasksTab = screen.getByRole('tab', { name: 'Tasks' });
    expect(tasksTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('project-tasks-tab')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Back to tasks/i })).toBeNull();
  });

  it('clears Back to tasks link when switching tabs by hand', () => {
    render(<AssuranceDetailView setId={testSetId} initialTab="tasks" />);

    // Open requirement from Tasks tab
    const uploadBtn = screen.getByTestId('task-action-btn-REQ-5379-01');
    fireEvent.click(uploadBtn);

    // Back to tasks link appears
    expect(screen.getByRole('button', { name: /Back to tasks/i })).toBeInTheDocument();

    // Switch to Details tab by hand
    const detailsTab = screen.getByRole('tab', { name: 'Details' });
    fireEvent.click(detailsTab);
    expect(detailsTab).toHaveAttribute('aria-selected', 'true');

    // Link must be cleared
    expect(screen.queryByRole('button', { name: /Back to tasks/i })).toBeNull();

    // Switch to Requirements tab by hand directly
    const reqTab = screen.getByRole('tab', { name: /^Requirements/ });
    fireEvent.click(reqTab);
    expect(reqTab).toHaveAttribute('aria-selected', 'true');

    // Link must still be absent because it wasn't reached from opening a task
    expect(screen.queryByRole('button', { name: /Back to tasks/i })).toBeNull();
  });
});

