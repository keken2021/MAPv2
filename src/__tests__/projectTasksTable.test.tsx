import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ProjectTasksTable } from '../components/tables/ProjectTasksTable';
import { ProjectDetailView } from '../views/ProjectDetailView';
import { useMapStore } from '../store/useMapStore';
import type { AssuranceRequirement, AssuranceSet } from '../types/assurance';
import type { Project } from '../types/project';

const TEST_TODAY = new Date('2026-11-04T12:00:00Z');

function createRequirement(overrides: Partial<AssuranceRequirement> = {}): AssuranceRequirement {
  return {
    id: 'REQ-1',
    category: 'Statutory Certificate',
    title: 'Cargo Ship Safety Construction Certificate',
    isMandatory: true,
    isFulfilled: false,
    ocrConfidence: 95,
    verifierStatus: 'Pending',
    targetDate: '2026-11-20',
    assignedSubmitter: 'M. Chen (Northwind Marine)',
    ...overrides,
  } as AssuranceRequirement;
}

function createSet(id: string, title: string, overrides: Partial<AssuranceSet> = {}): AssuranceSet {
  return {
    id,
    title,
    vesselId: `V-${id}`,
    vesselName: `MV Pacific Supporter`,
    imoNumber: '9456789',
    initiatorOrg: 'Chevron Australia',
    initiatorRole: 'Client Admin',
    clientOrg: 'Chevron Australia',
    serviceProviderOrg: 'Northwind Marine',
    charterWindowStart: '2026-01-01',
    charterWindowEnd: '2026-12-31',
    complianceDeadline: '2026-11-30',
    stage: 'Verification',
    readinessScore: 60,
    requirements: [createRequirement()],
    mandatoryInspectionRequired: false,
    inspectionCompleted: false,
    ...overrides,
  } as AssuranceSet;
}

describe('ProjectTasksTable', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders the standard 5 columns with correct headers', () => {
    const sets = [createSet('AS-101', 'Set Alpha')];
    render(
      <ProjectTasksTable
        sets={sets}
        onOpenSet={vi.fn()}
        today={TEST_TODAY}
      />
    );

    expect(screen.getByText(/Task \/ requirement/i)).toBeInTheDocument();
    expect(screen.getByText(/Parent assurance set/i)).toBeInTheDocument();
    expect(screen.getByText(/Target object/i)).toBeInTheDocument();
    expect(screen.getByText(/Assignee/i)).toBeInTheDocument();
    expect(screen.getByText(/^Status/i)).toBeInTheDocument();
  });

  it('renders task details across all 5 columns and opens set when link is clicked', () => {
    const onOpenSet = vi.fn();
    const set = createSet('AS-101', 'Offshore Supply Vetting', {
      vesselName: 'MV Deep Venture',
      imoNumber: '9123456',
      requirements: [
        createRequirement({
          id: 'REQ-NAV',
          title: 'ECDIS Operating Safety Protocol',
          category: 'Navigation',
          assignedSubmitter: 'Capt. Smith (Northwind Marine)',
          targetDate: '2026-11-25',
          verifierStatus: 'Pending',
        }),
      ],
    });

    render(
      <ProjectTasksTable
        sets={[set]}
        onOpenSet={onOpenSet}
        today={TEST_TODAY}
      />
    );

    // Column 1: Task / requirement
    expect(screen.getByText('ECDIS Operating Safety Protocol')).toBeInTheDocument();
    expect(screen.getByText('Navigation')).toBeInTheDocument();

    // Column 2: Parent assurance set
    const setLink = screen.getByRole('button', { name: /Offshore Supply Vetting/i });
    expect(setLink).toBeInTheDocument();
    expect(screen.getByText('AS-101')).toBeInTheDocument();

    // Column 3: Target object
    expect(screen.getByText('MV Deep Venture')).toBeInTheDocument();
    expect(screen.getByText('IMO 9123456')).toBeInTheDocument();

    // Column 4: Assignee
    expect(screen.getByText('Capt. Smith (Northwind Marine)')).toBeInTheDocument();

    // Column 5: Status with target date
    expect(screen.getByTestId('task-status-badge')).toHaveTextContent('Pending');
    expect(screen.getByText('Due: 2026-11-25')).toBeInTheDocument();

    // Test clicking parent assurance set link
    fireEvent.click(setLink);
    expect(onOpenSet).toHaveBeenCalledTimes(1);
    expect(onOpenSet).toHaveBeenCalledWith(set);
  });

  it('hides completed tasks by default and shows them when completed toggle is switched on', () => {
    const set = createSet('AS-101', 'Set Alpha', {
      requirements: [
        createRequirement({
          id: 'REQ-OPEN',
          title: 'Open Safety Document',
          verifierStatus: 'Pending',
          isFulfilled: false,
        }),
        createRequirement({
          id: 'REQ-DONE',
          title: 'Completed Class Certificate',
          verifierStatus: 'Verified',
          isFulfilled: true,
        }),
      ],
    });

    render(
      <ProjectTasksTable
        sets={[set]}
        onOpenSet={vi.fn()}
        today={TEST_TODAY}
      />
    );

    // Default: completed task is hidden, open task is shown
    expect(screen.getByText('Open Safety Document')).toBeInTheDocument();
    expect(screen.queryByText('Completed Class Certificate')).not.toBeInTheDocument();

    // Switch on completed tasks toggle
    const toggle = screen.getByRole('switch', { name: /Show completed tasks/i });
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    expect(toggle).toBeChecked();

    // Both tasks are now visible
    expect(screen.getByText('Open Safety Document')).toBeInTheDocument();
    expect(screen.getByText('Completed Class Certificate')).toBeInTheDocument();

    // Switch off again
    fireEvent.click(toggle);
    expect(screen.getByText('Open Safety Document')).toBeInTheDocument();
    expect(screen.queryByText('Completed Class Certificate')).not.toBeInTheDocument();
  });

  it('filters correctly with each quick filter chip: Overdue, Blocking, Pending approval, My organization', () => {
    const set = createSet('AS-101', 'Field Development Set', {
      requirements: [
        createRequirement({
          id: 'REQ-OVERDUE',
          title: 'Overdue Lifting Inspection',
          targetDate: '2026-11-01', // Before TEST_TODAY (2026-11-04)
          verifierStatus: 'Pending',
          assignedSubmitter: 'A. Inspector (Apex Logistics)',
        }),
        createRequirement({
          id: 'REQ-BLOCKING',
          title: 'Rejected Hull Thickness Measurement',
          targetDate: '2026-11-20',
          verifierStatus: 'Rejected',
          assignedSubmitter: 'B. Engineer (Apex Logistics)',
        }),
        createRequirement({
          id: 'REQ-PENDING-APP',
          title: 'Submitted Bunker Delivery Note',
          targetDate: '2026-11-20',
          documentId: 'DOC-BUNKER-101',
          verifierStatus: 'Pending',
          assignedSubmitter: 'C. Officer (Northwind Marine)',
        }),
        createRequirement({
          id: 'REQ-MY-ORG',
          title: 'My Org Emergency Response Drill',
          targetDate: '2026-11-22',
          verifierStatus: 'Pending',
          assignedSubmitter: 'D. Crew (Northwind Marine)',
        }),
      ],
    });

    render(
      <ProjectTasksTable
        sets={[set]}
        activeDemoOrganization="Northwind Marine"
        onOpenSet={vi.fn()}
        today={TEST_TODAY}
      />
    );

    // Initial: all 4 open tasks are visible
    expect(screen.getByText('Overdue Lifting Inspection')).toBeInTheDocument();
    expect(screen.getByText('Rejected Hull Thickness Measurement')).toBeInTheDocument();
    expect(screen.getByText('Submitted Bunker Delivery Note')).toBeInTheDocument();
    expect(screen.getByText('My Org Emergency Response Drill')).toBeInTheDocument();

    // 1. Overdue chip
    const overdueChip = screen.getByTestId('filter-chip-overdue');
    fireEvent.click(overdueChip);
    expect(screen.getByText('Overdue Lifting Inspection')).toBeInTheDocument();
    expect(screen.queryByText('Rejected Hull Thickness Measurement')).not.toBeInTheDocument();
    expect(screen.queryByText('Submitted Bunker Delivery Note')).not.toBeInTheDocument();
    expect(screen.queryByText('My Org Emergency Response Drill')).not.toBeInTheDocument();

    // Toggle overdue off
    fireEvent.click(overdueChip);
    expect(screen.getByText('Rejected Hull Thickness Measurement')).toBeInTheDocument();

    // 2. Blocking chip
    const blockingChip = screen.getByTestId('filter-chip-blocking');
    fireEvent.click(blockingChip);
    expect(screen.getByText('Rejected Hull Thickness Measurement')).toBeInTheDocument();
    expect(screen.queryByText('Submitted Bunker Delivery Note')).not.toBeInTheDocument();
    expect(screen.queryByText('My Org Emergency Response Drill')).not.toBeInTheDocument();
    fireEvent.click(blockingChip);

    // 3. Pending approval chip
    const pendingAppChip = screen.getByTestId('filter-chip-pending_approval');
    fireEvent.click(pendingAppChip);
    expect(screen.getByText('Submitted Bunker Delivery Note')).toBeInTheDocument();
    expect(screen.queryByText('Rejected Hull Thickness Measurement')).not.toBeInTheDocument();
    expect(screen.queryByText('Overdue Lifting Inspection')).not.toBeInTheDocument();
    fireEvent.click(pendingAppChip);

    // 4. My organization chip
    const myOrgChip = screen.getByTestId('filter-chip-my_org');
    fireEvent.click(myOrgChip);
    expect(screen.getByText('Submitted Bunker Delivery Note')).toBeInTheDocument();
    expect(screen.getByText('My Org Emergency Response Drill')).toBeInTheDocument();
    expect(screen.queryByText('Overdue Lifting Inspection')).not.toBeInTheDocument();
    expect(screen.queryByText('Rejected Hull Thickness Measurement')).not.toBeInTheDocument();
  });

  it('filters rows using search box matching task name, parent assurance set, and assignee', () => {
    const setA = createSet('AS-ALPHA', 'Alpha Dredging Campaign', {
      requirements: [
        createRequirement({
          id: 'REQ-1',
          title: 'Ballast Water Log',
          assignedSubmitter: 'Chief Mate Wilson',
        }),
      ],
    });
    const setB = createSet('AS-BETA', 'Beta Pipelay Campaign', {
      requirements: [
        createRequirement({
          id: 'REQ-2',
          title: 'Crane Load Test Protocol',
          assignedSubmitter: 'Rigging Lead Jensen',
        }),
      ],
    });

    render(
      <ProjectTasksTable
        sets={[setA, setB]}
        onOpenSet={vi.fn()}
        today={TEST_TODAY}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Search task name, assurance set, assignee.../i);

    // Search by task name
    fireEvent.change(searchInput, { target: { value: 'Ballast Water' } });
    expect(screen.getByText('Ballast Water Log')).toBeInTheDocument();
    expect(screen.queryByText('Crane Load Test Protocol')).not.toBeInTheDocument();

    // Search by parent assurance set
    fireEvent.change(searchInput, { target: { value: 'Beta Pipelay' } });
    expect(screen.queryByText('Ballast Water Log')).not.toBeInTheDocument();
    expect(screen.getByText('Crane Load Test Protocol')).toBeInTheDocument();

    // Search by assignee
    fireEvent.change(searchInput, { target: { value: 'Wilson' } });
    expect(screen.getByText('Ballast Water Log')).toBeInTheDocument();
    expect(screen.queryByText('Crane Load Test Protocol')).not.toBeInTheDocument();

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('Ballast Water Log')).toBeInTheDocument();
    expect(screen.getByText('Crane Load Test Protocol')).toBeInTheDocument();
  });

  it('pages at 20 rows per page with pagination controls', () => {
    // Generate 25 open requirements
    const reqs: AssuranceRequirement[] = Array.from({ length: 25 }, (_, i) =>
      createRequirement({
        id: `REQ-${i + 1}`,
        title: `Task Requirement Number ${String(i + 1).padStart(2, '0')}`,
        targetDate: '2026-11-20',
      }),
    );
    const set = createSet('AS-PAGINATE', 'Large Project Set', { requirements: reqs });

    render(
      <ProjectTasksTable
        sets={[set]}
        onOpenSet={vi.fn()}
        today={TEST_TODAY}
      />
    );

    // Page 1 should show 20 rows
    expect(screen.getByText('Showing 1-20 of 25')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Task Requirement Number 01')).toBeInTheDocument();
    expect(screen.getByText('Task Requirement Number 20')).toBeInTheDocument();
    expect(screen.queryByText('Task Requirement Number 21')).not.toBeInTheDocument();

    // Click Next page
    const nextBtn = screen.getByRole('button', { name: /Next page/i });
    fireEvent.click(nextBtn);

    // Page 2 should show remaining 5 rows
    expect(screen.getByText('Showing 21-25 of 25')).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    expect(screen.getByText('Task Requirement Number 21')).toBeInTheDocument();
    expect(screen.getByText('Task Requirement Number 25')).toBeInTheDocument();
    expect(screen.queryByText('Task Requirement Number 01')).not.toBeInTheDocument();

    // Click Previous page
    const prevBtn = screen.getByRole('button', { name: /Previous page/i });
    fireEvent.click(prevBtn);
    expect(screen.getByText('Showing 1-20 of 25')).toBeInTheDocument();
  });
});

describe('ProjectDetailView - Tasks Tab Integration', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders Details, Assurance Sets, Objects, and Tasks tabs on project detail', () => {
    const store = useMapStore.getState();
    const targetProject = store.projects[0];

    render(<ProjectDetailView projectId={targetProject.id} />);

    // Verify all 4 tabs exist
    expect(screen.getByRole('button', { name: 'Details' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Assurance Sets' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Objects' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tasks' })).toBeInTheDocument();
  });

  it('navigates to Tasks tab and renders ProjectTasksTable for the project', () => {
    const store = useMapStore.getState();
    const targetProject = store.projects[0];

    render(<ProjectDetailView projectId={targetProject.id} />);

    const tasksTabBtn = screen.getByRole('button', { name: 'Tasks' });
    fireEvent.click(tasksTabBtn);

    expect(tasksTabBtn).toHaveClass('active');
    expect(screen.getByTestId('project-tasks-tab')).toBeInTheDocument();
    expect(screen.getByText(/Task \/ requirement/i)).toBeInTheDocument();
    expect(screen.getByText(/Parent assurance set/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search task name, assurance set, assignee.../i)).toBeInTheDocument();
  });

  it('loads MARINE-017, opens Tasks tab, uses search, chips, and follows a set link', () => {
    const store = useMapStore.getState();
    const marineProject = store.projects.find((p) => p.id.includes('MARINE-017'));
    expect(marineProject).toBeDefined();

    render(<ProjectDetailView projectId={marineProject!.id} />);

    // 1. Open the Tasks tab
    const tasksTabBtn = screen.getByRole('button', { name: 'Tasks' });
    fireEvent.click(tasksTabBtn);
    expect(tasksTabBtn).toHaveClass('active');
    expect(screen.getByTestId('project-tasks-tab')).toBeInTheDocument();

    // 2. Use search
    const searchInput = screen.getByPlaceholderText(/Search task name, assurance set, assignee.../i);
    fireEvent.change(searchInput, { target: { value: 'Safety' } });
    expect(searchInput).toHaveValue('Safety');
    fireEvent.change(searchInput, { target: { value: '' } });

    // 3. Use each filter chip
    const overdueChip = screen.getByTestId('filter-chip-overdue');
    fireEvent.click(overdueChip);
    fireEvent.click(overdueChip);

    const blockingChip = screen.getByTestId('filter-chip-blocking');
    fireEvent.click(blockingChip);
    fireEvent.click(blockingChip);

    const pendingAppChip = screen.getByTestId('filter-chip-pending_approval');
    fireEvent.click(pendingAppChip);
    fireEvent.click(pendingAppChip);

    const myOrgChip = screen.getByTestId('filter-chip-my_org');
    fireEvent.click(myOrgChip);
    fireEvent.click(myOrgChip);

    // 4. Follow a set link
    const setLinks = screen.getAllByRole('button').filter((btn) =>
      btn.getAttribute('title')?.startsWith('Open '),
    );
    if (setLinks.length > 0) {
      fireEvent.click(setLinks[0]);
    }
  });
});
