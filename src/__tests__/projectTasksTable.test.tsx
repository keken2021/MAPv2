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
    const onOpenRequirement = vi.fn();
    const set = createSet('AS-101', 'Offshore Supply Vetting', {
      vesselName: 'MV Deep Venture',
      imoNumber: '9123456',
      requirements: [
        createRequirement({
          id: 'REQ-NAV',
          title: 'ECDIS Operating Safety Protocol',
          category: 'Statutory Certificate',
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
        onOpenRequirement={onOpenRequirement}
        today={TEST_TODAY}
      />
    );

    // Column 1: Task / requirement
    expect(screen.getByText('ECDIS Operating Safety Protocol')).toBeInTheDocument();
    expect(screen.queryByText('Statutory Certificate')).not.toBeInTheDocument();
    const taskLink = screen.getByTestId('task-open-req-REQ-NAV');
    expect(taskLink).toBeInTheDocument();
    expect(taskLink).not.toHaveClass('fw-semibold');
    expect(taskLink).toHaveClass('fw-normal');

    // Column 2: Parent assurance set
    const setLink = screen.getByRole('button', { name: /Offshore Supply Vetting/i });
    expect(setLink).toBeInTheDocument();
    expect(setLink).toHaveAttribute('title', 'Open Offshore Supply Vetting (AS-101)');
    expect(setLink).not.toHaveClass('fw-semibold');
    expect(setLink).toHaveClass('fw-normal');
    expect(screen.queryByText('AS-101')).not.toBeInTheDocument();

    // Column 3: Target object
    const targetObj = screen.getByText('MV Deep Venture');
    expect(targetObj).toBeInTheDocument();
    expect(targetObj).toHaveAttribute('title', 'IMO 9123456');
    expect(targetObj).not.toHaveClass('fw-semibold');
    expect(targetObj).toHaveClass('fw-normal');
    expect(screen.queryByText('IMO 9123456')).not.toBeInTheDocument();

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

  it('groups tasks into Pending, On-going, and Done statuses, with Overdue as a row flag', () => {
    const set = createSet('AS-101', 'Set Alpha', {
      requirements: [
        createRequirement({
          id: 'REQ-PENDING',
          title: 'Unstarted Inspection Document',
          verifierStatus: 'Pending',
          isFulfilled: false,
          targetDate: '2026-11-01', // Overdue relative to TEST_TODAY (2026-11-04)
        }),
        createRequirement({
          id: 'REQ-ONGOING',
          title: 'Submitted Safety Certificate',
          documentId: 'DOC-123',
          verifierStatus: 'Pending',
          isFulfilled: false,
          targetDate: '2026-11-20',
        }),
        createRequirement({
          id: 'REQ-DONE',
          title: 'Completed Class Certificate',
          verifierStatus: 'Verified',
          isFulfilled: true,
          targetDate: '2026-11-15',
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

    // Initial: All tab shows all 3 tasks
    expect(screen.getByText('Unstarted Inspection Document')).toBeInTheDocument();
    expect(screen.getByText('Submitted Safety Certificate')).toBeInTheDocument();
    expect(screen.getByText('Completed Class Certificate')).toBeInTheDocument();

    // Verify overdue flag appears on REQ-PENDING row without replacing status
    expect(screen.getByTestId('task-overdue-flag')).toHaveTextContent('Overdue');

    // 1. Pending tab shows only pending tasks
    const pendingTab = screen.getByRole('tab', { name: /Pending/i });
    fireEvent.click(pendingTab);
    expect(screen.getByText('Unstarted Inspection Document')).toBeInTheDocument();
    expect(screen.queryByText('Submitted Safety Certificate')).not.toBeInTheDocument();
    expect(screen.queryByText('Completed Class Certificate')).not.toBeInTheDocument();

    // 2. On-going tab shows submitted/review/correction/rejected tasks
    const ongoingTab = screen.getByRole('tab', { name: /On-going/i });
    fireEvent.click(ongoingTab);
    expect(screen.queryByText('Unstarted Inspection Document')).not.toBeInTheDocument();
    expect(screen.getByText('Submitted Safety Certificate')).toBeInTheDocument();
    expect(screen.queryByText('Completed Class Certificate')).not.toBeInTheDocument();

    // 3. Done tab shows completed tasks
    const doneTab = screen.getByRole('tab', { name: /Done/i });
    fireEvent.click(doneTab);
    expect(screen.queryByText('Unstarted Inspection Document')).not.toBeInTheDocument();
    expect(screen.queryByText('Submitted Safety Certificate')).not.toBeInTheDocument();
    expect(screen.getByText('Completed Class Certificate')).toBeInTheDocument();

    // 4. All tab shows every task again
    const allTab = screen.getByRole('tab', { name: /All/i });
    fireEvent.click(allTab);
    expect(screen.getByText('Unstarted Inspection Document')).toBeInTheDocument();
    expect(screen.getByText('Submitted Safety Certificate')).toBeInTheDocument();
    expect(screen.getByText('Completed Class Certificate')).toBeInTheDocument();
  });

  it('counts a requirement with reuploadRequested as Pending with Reupload requested reason badge', () => {
    const set = createSet('AS-101', 'Set Alpha', {
      requirements: [
        createRequirement({
          id: 'REQ-REUPLOAD',
          title: 'Class Renewal Certificate',
          verifierStatus: 'Verified',
          isFulfilled: true,
          reuploadRequested: {
            reason: 'Scan is outdated. Please upload 2026 certificate.',
            date: '2026-11-04T10:00:00Z',
            requestedAt: '2026-11-04T10:00:00Z',
          },
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

    // Counts as Pending, not Done
    expect(screen.getByTestId('task-status-badge')).toHaveTextContent('Pending');
    expect(screen.getByTestId('task-reupload-requested-flag')).toHaveTextContent('Reupload requested');
    expect(screen.getByText('Scan is outdated. Please upload 2026 certificate.')).toBeInTheDocument();

    const pendingTab = screen.getByRole('tab', { name: /Pending/i });
    expect(pendingTab).toHaveTextContent(/Pending\s*\(1\)/);

    const doneTab = screen.getByRole('tab', { name: /Done/i });
    expect(doneTab).toHaveTextContent(/Done\s*\(0\)/);
  });

  it('scopes tasks using the scope prop for project, assurance set, and user', () => {
    const setA = createSet('AS-A', 'Alpha Set', {
      projectId: 'PROJ-1',
      requirements: [
        createRequirement({
          id: 'REQ-A1',
          title: 'Project 1 Alpha Task',
          assignedSubmitter: 'Capt. Smith (Northwind Marine)',
        }),
      ],
    });
    const setB = createSet('AS-B', 'Beta Set', {
      projectId: 'PROJ-2',
      requirements: [
        createRequirement({
          id: 'REQ-B1',
          title: 'Project 2 Beta Task',
          assignedSubmitter: 'Eng. Jones (Apex Logistics)',
        }),
      ],
    });

    // 1. Scoped to Project 1
    const { rerender } = render(
      <ProjectTasksTable
        sets={[setA, setB]}
        scope={{ type: 'project', id: 'PROJ-1' }}
        today={TEST_TODAY}
      />
    );
    expect(screen.getByText('Project 1 Alpha Task')).toBeInTheDocument();
    expect(screen.queryByText('Project 2 Beta Task')).not.toBeInTheDocument();

    // 2. Scoped to Assurance Set AS-B
    rerender(
      <ProjectTasksTable
        sets={[setA, setB]}
        scope={{ type: 'set', id: 'AS-B' }}
        today={TEST_TODAY}
      />
    );
    expect(screen.queryByText('Project 1 Alpha Task')).not.toBeInTheDocument();
    expect(screen.getByText('Project 2 Beta Task')).toBeInTheDocument();

    // 3. Scoped to User 'Jones'
    rerender(
      <ProjectTasksTable
        sets={[setA, setB]}
        scope={{ type: 'user', id: 'Jones' }}
        today={TEST_TODAY}
      />
    );
    expect(screen.queryByText('Project 1 Alpha Task')).not.toBeInTheDocument();
    expect(screen.getByText('Project 2 Beta Task')).toBeInTheDocument();
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
  const initialState = useMapStore.getState();

  beforeEach(() => {
    cleanup();
    useMapStore.setState(
      {
        ...initialState,
        isAuthenticated: true,
        activePersona: 'Administrator',
        activeDemoOrganization: 'Northwind Marine Pty Ltd',
        activeSessionUserId: 'USR-101',
      },
      true,
    );
  });

  it('renders Details, Assurance Sets, Objects, and Tasks tabs on project detail', () => {
    const store = useMapStore.getState();
    const targetProject = store.projects[0];

    render(<ProjectDetailView projectId={targetProject.id} />);

    // Verify all 4 tabs exist
    expect(screen.getByRole('tab', { name: 'Details' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Assurance Sets' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Objects' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tasks' })).toBeInTheDocument();
  });

  it('navigates to Tasks tab and renders ProjectTasksTable for the project', () => {
    const store = useMapStore.getState();
    const targetProject = store.projects[0];

    render(<ProjectDetailView projectId={targetProject.id} />);

    const tasksTabBtn = screen.getByRole('tab', { name: 'Tasks' });
    fireEvent.click(tasksTabBtn);

    expect(tasksTabBtn).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('project-tasks-tab')).toBeInTheDocument();
    expect(screen.getByText(/Task \/ requirement/i)).toBeInTheDocument();
    expect(screen.getByText(/Parent assurance set/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search task name, assurance set, assignee.../i)).toBeInTheDocument();
  });

  it('loads MARINE-017, opens Tasks tab, uses search, chips, and follows a set link', () => {
    useMapStore.setState({
      isAuthenticated: true,
      activePersona: 'C Admin',
      activeDemoOrganization: 'Oil Company',
      activeSessionUserId: 'USR-228',
    });
    const store = useMapStore.getState();
    const marineProject = store.projects.find((p) => p.id.includes('MARINE-017'));
    expect(marineProject).toBeDefined();

    render(<ProjectDetailView projectId={marineProject!.id} />);

    // 1. Open the Tasks tab
    const tasksTabBtn = screen.getByRole('tab', { name: 'Tasks' });
    fireEvent.click(tasksTabBtn);
    expect(tasksTabBtn).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('project-tasks-tab')).toBeInTheDocument();

    // 2. Verify no filter-chip-* buttons exist
    expect(screen.queryByTestId(/^filter-chip-/)).toBeNull();

    // 3. Use search and verify removable search chip
    const searchInput = screen.getByPlaceholderText(/Search task name, assurance set, assignee.../i);
    fireEvent.change(searchInput, { target: { value: 'Safety' } });
    expect(searchInput).toHaveValue('Safety');
    const removeSearchChip = screen.getByRole('button', { name: /Remove Search filter/i });
    expect(removeSearchChip).toBeInTheDocument();
    fireEvent.click(removeSearchChip);
    expect(searchInput).toHaveValue('');
    expect(screen.queryByRole('button', { name: /Remove Search filter/i })).toBeNull();

    // 4. Use each count tab: Pending, On-going, Done, All
    const pendingTab = screen.getByRole('tab', { name: /Pending/i });
    fireEvent.click(pendingTab);

    const ongoingTab = screen.getByRole('tab', { name: /On-going/i });
    fireEvent.click(ongoingTab);

    const doneTab = screen.getByRole('tab', { name: /Done/i });
    fireEvent.click(doneTab);

    const allTab = screen.getByRole('tab', { name: /All/i });
    fireEvent.click(allTab);

    // Verify no Task labels read "Needs action", "Action required", or "Awaiting upload"
    const tasksTabContent = screen.getByTestId('project-tasks-tab');
    expect(within(tasksTabContent).queryByText(/Needs action/i)).toBeNull();
    expect(within(tasksTabContent).queryByText(/Action required/i)).toBeNull();
    expect(within(tasksTabContent).queryByText(/Awaiting upload/i)).toBeNull();

    // 5. Follow a set link
    const setLinks = screen.getAllByRole('button').filter((btn) =>
      btn.getAttribute('title')?.startsWith('Open '),
    );
    if (setLinks.length > 0) {
      fireEvent.click(setLinks[0]);
    }
  });
});
