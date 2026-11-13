import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AssuranceDetailView } from '../views/AssuranceDetailView';
import { ProjectTasksTable } from '../components/tables/ProjectTasksTable';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet } from '../types/assurance';
import { AuditTrailEvent } from '../types/audit';
import { getInspectionTaskStatus, getApprovalTaskStatus } from '../utils/stageTasks';

describe('Assurance Detail Tabs and Audit Trail (Task 5269)', () => {
  const originalHash = window.location.hash;
  const initialState = useMapStore.getState();

  beforeEach(() => {
    window.location.hash = '';
    useMapStore.setState({
      ...initialState,
      activePersona: 'C Admin',
      activeDemoOrganization: 'Chevron Australia Pty Ltd',
      isAuthenticated: true,
      activeSessionUserId: 'USR-221',
    }, true);
  });

  afterEach(() => {
    window.location.hash = originalHash;
  });

  it('renders one tab row in exact order: Details | Requirements | Tasks | Audit Trail', () => {
    render(<AssuranceDetailView setId="AS-2026-001" />);

    const tabList = screen.getByRole('tablist');
    expect(tabList).toBeDefined();

    const tabs = within(tabList).getAllByRole('tab');
    expect(tabs.length).toBe(5);
    expect(tabs[0].textContent?.trim()).toBe('Details');
    expect(tabs[1].textContent?.trim()).toBe('Objects');
    expect(tabs[2].textContent?.trim()).toBe('Requirements');
    expect(tabs[3].textContent?.trim()).toBe('Tasks');
    expect(tabs[4].textContent?.trim()).toBe('Audit Trail');

    // Stage is not a tab
    expect(within(tabList).queryByRole('tab', { name: /stage/i })).toBeNull();
  });

  it('Objects tab displays objects under this set with Belongs To column', () => {
    render(<AssuranceDetailView setId="AS-2026-001" />);

    fireEvent.click(screen.getByRole('tab', { name: /^objects$/i }));

    const objectsTab = screen.getByRole('tab', { name: /^objects$/i });
    expect(objectsTab.getAttribute('aria-selected')).toBe('true');

    expect(screen.getByText('Belongs To')).toBeDefined();
    expect(screen.getByPlaceholderText('Search objects...')).toBeDefined();
  });

  it('Details tab opens by default and holds summary card', () => {
    const { container } = render(<AssuranceDetailView setId="AS-2026-001" />);

    const detailsTab = screen.getByRole('tab', { name: /^details$/i });
    expect(detailsTab.getAttribute('aria-selected')).toBe('true');

    // Summary info card is visible
    expect(container.querySelector('.col-lg-8 .card.map-card-custom')).not.toBeNull();

    // Requirements table is not rendered while Details tab is active
    expect(screen.queryByText(/Requirements Register/i)).toBeNull();
    expect(screen.queryByRole('table', { name: /requirements/i })).toBeNull();
  });

  it('Requirements tab displays stage and readiness as one summary line without stepper, and link opens Details', () => {
    const { container } = render(<AssuranceDetailView setId="AS-2026-001" />);

    fireEvent.click(screen.getByRole('tab', { name: /requirements/i }));

    const reqTab = screen.getByRole('tab', { name: /requirements/i });
    expect(reqTab.getAttribute('aria-selected')).toBe('true');

    // Stepper and gauge are not rendered inside Requirements tab
    expect(container.querySelector('.pipeline-stepper, [data-testid="pipeline-stepper"]')).toBeNull();

    // Summary line is visible with stage and readiness %
    const summaryLine = screen.getByTestId('requirements-summary-line');
    expect(summaryLine).toBeInTheDocument();
    expect(within(summaryLine).getByText(/Stage:/i)).toBeInTheDocument();
    expect(within(summaryLine).getByText(/Readiness:/i)).toBeInTheDocument();

    // Requirements table is visible
    const table = screen.getByRole('table');
    expect(table).toBeDefined();
    expect(within(table).getByText(/Certificate of Class/i)).toBeDefined();

    // Clicking "View stage" link opens Details tab
    const viewStageLink = within(summaryLine).getByRole('link', { name: /view stage/i });
    expect(viewStageLink).toBeInTheDocument();
    fireEvent.click(viewStageLink);

    const detailsTab = screen.getByRole('tab', { name: /^details$/i });
    expect(detailsTab.getAttribute('aria-selected')).toBe('true');

    // PipelineStepper and ReadinessGauge are present on Details tab
    expect(container.querySelector('.pipeline-stepper, [data-testid="pipeline-stepper"]')).not.toBeNull();
    expect(screen.getByText('Readiness')).toBeDefined();
  });

  it('Tasks tab holds task section cards and shared Tasks table whose counts match its requirements and opens requirement', () => {
    const state = useMapStore.getState();
    const testSet = state.assuranceSets.find((s) => s.id === 'AS-2026-001') || state.assuranceSets[0];
    const totalReqs = testSet.requirements.length;

    render(<AssuranceDetailView setId={testSet.id} />);

    fireEvent.click(screen.getByRole('tab', { name: /^tasks$/i }));

    const tasksTab = screen.getByRole('tab', { name: /^tasks$/i });
    expect(tasksTab.getAttribute('aria-selected')).toBe('true');

    // Tasks pane + shared Tasks table are present
    expect(screen.getByTestId('assurance-detail-tasks-tab-pane')).toBeInTheDocument();
    const tasksTableTab = screen.getByTestId('project-tasks-tab');
    expect(tasksTableTab).toBeInTheDocument();

    // CountTabs are present: All, Pending, On-going, Done
    const allTab = within(tasksTableTab).getByRole('tab', { name: /all/i });
    const pendingTab = within(tasksTableTab).getByRole('tab', { name: /pending/i });
    const onGoingTab = within(tasksTableTab).getByRole('tab', { name: /on-going/i });
    const doneTab = within(tasksTableTab).getByRole('tab', { name: /done/i });

    expect(allTab).toBeInTheDocument();
    expect(pendingTab).toBeInTheDocument();
    expect(onGoingTab).toBeInTheDocument();
    expect(doneTab).toBeInTheDocument();

    // All count matches total tasks (requirements + stage tasks)
    const expectedTasks =
      totalReqs +
      (getInspectionTaskStatus(testSet) ? 1 : 0) +
      (getApprovalTaskStatus(testSet) ? 1 : 0);
    expect(allTab.textContent).toContain(String(expectedTasks));

    // Standard task table columns
    expect(within(tasksTableTab).getByText(/Task \/ requirement/i)).toBeInTheDocument();
    expect(within(tasksTableTab).getByText(/^Status/i)).toBeInTheDocument();

    // Clicking a requirement title opens the matching requirement
    const firstReq = testSet.requirements[0];
    const openReqBtn = within(tasksTableTab).getByTestId(`task-open-req-${firstReq.id}`);
    expect(openReqBtn).toBeInTheDocument();
    fireEvent.click(openReqBtn);

    // Switched to Requirements tab
    const reqTab = screen.getByRole('tab', { name: /^requirements$/i });
    expect(reqTab.getAttribute('aria-selected')).toBe('true');
  });

  it('displays certificate expiry warning in the Tasks tab instead of the Requirements tab', () => {
    const state = useMapStore.getState();
    const testSet = state.assuranceSets.find((s) => s.id === 'AS-2026-001') || state.assuranceSets[0];

    render(<AssuranceDetailView setId={testSet.id} />);

    // In Requirements tab, the warning banner is not present
    fireEvent.click(screen.getByRole('tab', { name: /^requirements$/i }));
    expect(screen.queryByText(/certificate expires before the contract ends/i)).toBeNull();

    // In Tasks tab, the warning banner is present
    fireEvent.click(screen.getByRole('tab', { name: /^tasks$/i }));
    expect(screen.getByText(/1 certificate expires before the contract ends on 01 NOV 2027\./i)).toBeInTheDocument();
  });

  it('Audit Trail tab lists this set\'s audit events with time, person and role, action, and deltas', () => {
    const state = useMapStore.getState();
    const testSetId = 'AS-TEST-AUDIT-01';

    const testSet: AssuranceSet = {
      ...state.assuranceSets[0],
      id: testSetId,
      title: 'Audit Set Alpha',
      initiatorOrg: 'Northwind Marine Pty Ltd',
      createdByUserId: 'USR-101',
      createdByName: 'K. Osei',
      createdByPersona: 'Administrator',
      targetDateHistory: [
        {
          id: 'TDH-001',
          setId: testSetId,
          scope: 'set',
          targetType: 'set',
          oldDate: '2026-11-01',
          newDate: '2026-11-15',
          changedBy: 'K. Osei',
          changedAt: '2026-10-20T10:00:00Z',
          reason: 'Laycan extension approved by charterer',
        },
      ],
    };

    const directAuditEvent: AuditTrailEvent = {
      id: 'AUD-001',
      timestampUtc: '2026-10-25T14:30:00Z',
      userId: 'USR-101',
      userRole: 'Administrator',
      organization: 'Oil Co Global',
      action: 'Updated status',
      targetAsset: `${testSetId} (Audit Set Alpha)`,
      target: { kind: 'set', setId: testSetId },
      fieldDelta: {
        fieldName: 'Stage',
        oldValue: 'Preparation',
        newValue: 'Verification',
      },
      justificationNotes: 'All preparatory documentation validated.',
    };

    useMapStore.setState({
      assuranceSets: [testSet, ...state.assuranceSets.filter((s) => s.id !== testSetId)],
      auditEvents: [directAuditEvent, ...state.auditEvents],
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: 'USR-101',
    });

    render(<AssuranceDetailView setId={testSetId} />);

    fireEvent.click(screen.getByRole('tab', { name: /audit trail/i }));

    const auditTab = screen.getByRole('tab', { name: /audit trail/i });
    expect(auditTab.getAttribute('aria-selected')).toBe('true');

    // Audit Trail card and heading
    expect(screen.getByRole('heading', { name: /audit trail/i })).toBeDefined();

    // Table rows exist
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThan(1);

    // Direct event displayed with action, delta, and note
    expect(screen.getByText('Updated status')).toBeDefined();
    expect(screen.getByText(/Stage: Preparation to Verification/i)).toBeDefined();
    expect(screen.getByText('All preparatory documentation validated.')).toBeDefined();

    // Target date history appears once in audit trail
    expect(screen.getByText('Changed date')).toBeDefined();
    expect(screen.getByText(/Laycan extension approved by charterer/i)).toBeDefined();
  });

  it('deduplicates date change events so a date change is listed once', () => {
    const state = useMapStore.getState();
    const testSetId = 'AS-TEST-DEDUP-01';

    const testSet: AssuranceSet = {
      ...state.assuranceSets[0],
      id: testSetId,
      title: 'Dedup Set',
      initiatorOrg: 'Northwind Marine Pty Ltd',
      createdByUserId: 'USR-101',
      createdByName: 'K. Osei',
      createdByPersona: 'Administrator',
      targetDateHistory: [
        {
          id: 'TDH-DEDUP-01',
          setId: testSetId,
          scope: 'set',
          targetType: 'set',
          oldDate: '2026-11-01',
          newDate: '2026-11-15',
          changedBy: 'K. Osei',
          changedAt: '2026-10-20T10:00:00Z',
          reason: 'Date changed',
        },
      ],
    };

    // An event matching the exact same targetDateHistory record
    const duplicatedEvent: AuditTrailEvent = {
      id: 'TDH-DEDUP-01',
      timestampUtc: '2026-10-20T10:00:00Z',
      userId: 'USR-101',
      userRole: 'Administrator',
      organization: 'Oil Co Global',
      action: 'Changed date',
      targetAsset: `${testSetId} (Dedup Set)`,
      target: { kind: 'date', setId: testSetId, dateField: 'complianceDeadline' },
      fieldDelta: {
        fieldName: 'Compliance deadline',
        oldValue: '2026-11-01',
        newValue: '2026-11-15',
      },
      justificationNotes: 'Date changed',
    };

    useMapStore.setState({
      assuranceSets: [testSet, ...state.assuranceSets.filter((s) => s.id !== testSetId)],
      auditEvents: [duplicatedEvent, ...state.auditEvents],
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: 'USR-101',
    });

    render(<AssuranceDetailView setId={testSetId} />);
    fireEvent.click(screen.getByRole('tab', { name: /audit trail/i }));

    const dateActionCells = screen.getAllByText('Changed date');
    expect(dateActionCells.length).toBe(1);
  });

  it('removes Date History button and Target Date Change History modal', () => {
    render(<AssuranceDetailView setId="AS-2026-001" />);

    // No Date History button in DOM
    expect(screen.queryByRole('button', { name: /date history/i })).toBeNull();

    // No Target Date Change History modal dialog
    expect(screen.queryByRole('dialog', { name: /target date change history/i })).toBeNull();
  });

  it('shows shared EmptyState when assurance set has no audit events', () => {
    const state = useMapStore.getState();
    const emptySetId = 'AS-EMPTY-AUDIT';

    const emptySet: AssuranceSet = {
      ...state.assuranceSets[0],
      id: emptySetId,
      title: 'Empty Audit Set',
      initiatorOrg: 'Northwind Marine Pty Ltd',
      createdByUserId: 'USR-101',
      createdByName: 'K. Osei',
      createdByPersona: 'Administrator',
      targetDateHistory: [],
    };

    useMapStore.setState({
      assuranceSets: [emptySet, ...state.assuranceSets.filter((s) => s.id !== emptySetId)],
      auditEvents: [],
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: 'USR-101',
    });

    render(<AssuranceDetailView setId={emptySetId} />);
    fireEvent.click(screen.getByRole('tab', { name: /audit trail/i }));

    // Empty state rendered
    expect(screen.getByText('No audit events recorded')).toBeDefined();
    expect(screen.getByText('There are no audit events recorded for this assurance set.')).toBeDefined();
  });

  it('filters audit events according to persona permissions via filterAuditTrailForPersona', () => {
    const state = useMapStore.getState();
    const testSetId = 'AS-TEST-PERSONA-01';

    const testSet: AssuranceSet = {
      ...state.assuranceSets[0],
      id: testSetId,
      title: 'Persona Test Set',
      serviceProviderOrg: 'Northwind Marine Pty Ltd',
      assignedSubmitter: 'M. Chen (Northwind Marine Pty Ltd)',
      clientOrg: 'Oil Co Global',
      targetDateHistory: [],
    };

    // Event by Administrator USR-101
    const adminEvent: AuditTrailEvent = {
      id: 'EV-ADMIN-01',
      timestampUtc: '2026-10-22T08:00:00Z',
      userId: 'USR-101',
      userRole: 'Administrator',
      organization: 'Oil Co Global',
      action: 'Updated compliance deadline',
      targetAsset: `${testSetId}`,
      target: { kind: 'set', setId: testSetId },
      fieldDelta: { fieldName: 'Deadline', oldValue: '2026-11-01', newValue: '2026-11-15' },
    };

    // Event by Submitter USR-102
    const submitterEvent: AuditTrailEvent = {
      id: 'EV-SUBMITTER-01',
      timestampUtc: '2026-10-23T09:00:00Z',
      userId: 'USR-102',
      userRole: 'Submitter',
      organization: 'Northwind Marine',
      action: 'Uploaded Document',
      targetAsset: `${testSetId}`,
      target: { kind: 'set', setId: testSetId },
      fieldDelta: { fieldName: 'Status', oldValue: 'Pending', newValue: 'Uploaded' },
    };

    useMapStore.setState({
      assuranceSets: [testSet, ...state.assuranceSets.filter((s) => s.id !== testSetId)],
      auditEvents: [adminEvent, submitterEvent],
      activePersona: 'Submitter',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: 'USR-102',
    });

    render(<AssuranceDetailView setId={testSetId} />);
    fireEvent.click(screen.getByRole('tab', { name: /audit trail/i }));

    // Submitter sees their own event
    expect(screen.getByText('Uploaded Document')).toBeDefined();
    // Submitter does not see the Administrator's internal set date change event
    expect(screen.queryByText('Updated compliance deadline')).toBeNull();
  });

  it('allows Approver to see every audit record of a set while Submitter sees only their own', () => {
    const state = useMapStore.getState();
    const testSetId = 'AS-TEST-APPROVER-ALL-AUDIT';

    const testSet: AssuranceSet = {
      ...state.assuranceSets[0],
      id: testSetId,
      title: 'Approver Audit Set',
      serviceProviderOrg: 'Northwind Marine Pty Ltd',
      clientOrg: 'Southern Basin Energy Pty Ltd',
      assignedSubmitter: 'M. Chen (Northwind Marine Pty Ltd)',
      assignedApprover: 'P. Nardelli (Marine Assurance Authority)',
      stage: 'Approval',
      targetDateHistory: [],
    };

    const adminEvent: AuditTrailEvent = {
      id: 'EV-APP-ADMIN-01',
      timestampUtc: '2026-10-22T08:00:00Z',
      userId: 'USR-101',
      userRole: 'Administrator',
      organization: 'Northwind Marine Pty Ltd',
      action: 'Updated compliance deadline',
      targetAsset: `${testSetId}`,
      target: { kind: 'set', setId: testSetId },
      fieldDelta: { fieldName: 'Deadline', oldValue: '2026-11-01', newValue: '2026-11-15' },
    };

    const submitterEvent: AuditTrailEvent = {
      id: 'EV-APP-SUBMITTER-01',
      timestampUtc: '2026-10-23T09:00:00Z',
      userId: 'USR-102',
      userRole: 'Submitter',
      organization: 'Northwind Marine Pty Ltd',
      action: 'Uploaded Document',
      targetAsset: `${testSetId}`,
      target: { kind: 'set', setId: testSetId },
      fieldDelta: { fieldName: 'Status', oldValue: 'Pending', newValue: 'Uploaded' },
    };

    const verifierEvent: AuditTrailEvent = {
      id: 'EV-APP-VERIFIER-01',
      timestampUtc: '2026-10-24T10:00:00Z',
      userId: 'USR-103',
      userRole: 'Verifier',
      organization: 'Bureau Veritas Inspectorate',
      action: 'Verified Document',
      targetAsset: `${testSetId}`,
      target: { kind: 'set', setId: testSetId },
      fieldDelta: { fieldName: 'Status', oldValue: 'Pending', newValue: 'Verified' },
    };

    useMapStore.setState({
      assuranceSets: [testSet, ...state.assuranceSets.filter((s) => s.id !== testSetId)],
      auditEvents: [adminEvent, submitterEvent, verifierEvent],
      activePersona: 'Approver',
      activeDemoOrganization: 'Marine Assurance Authority',
      activeSessionUserId: 'USR-204',
    });

    const { unmount } = render(<AssuranceDetailView setId={testSetId} />);
    fireEvent.click(screen.getByRole('tab', { name: /audit trail/i }));

    expect(screen.getByText('Updated compliance deadline')).toBeDefined();
    expect(screen.getByText('Uploaded Document')).toBeDefined();
    expect(screen.getByText('Verified Document')).toBeDefined();
    unmount();

    useMapStore.setState({
      activePersona: 'Submitter',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: 'USR-102',
    });

    render(<AssuranceDetailView setId={testSetId} />);
    fireEvent.click(screen.getByRole('tab', { name: /audit trail/i }));

    expect(screen.getByText('Uploaded Document')).toBeDefined();
    expect(screen.queryByText('Updated compliance deadline')).toBeNull();
    expect(screen.queryByText('Verified Document')).toBeNull();

    useMapStore.setState({
      assuranceSets: state.assuranceSets,
      auditEvents: state.auditEvents,
      activePersona: 'C Admin',
      activeDemoOrganization: 'Chevron Australia Pty Ltd',
      activeSessionUserId: 'USR-221',
    });
  });

  it('keeps page header and cancelled banner above the tabs regardless of active tab', () => {
    const state = useMapStore.getState();
    const cancelledSetId = 'AS-TEST-CANCELLED-TABS';

    const cancelledSet: AssuranceSet = {
      ...state.assuranceSets[0],
      id: cancelledSetId,
      stage: 'Cancelled',
      cancelledAt: '2026-10-15',
      cancellationReason: 'Project chartered elsewhere',
    };

    useMapStore.setState({
      assuranceSets: [cancelledSet, ...state.assuranceSets.filter((s) => s.id !== cancelledSetId)],
    });

    render(<AssuranceDetailView setId={cancelledSetId} />);

    // Cancelled banner is present on Details tab
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText(/Chartered elsewhere/i)).toBeDefined();

    // Switch to Requirements tab: cancelled banner remains visible above
    fireEvent.click(screen.getByRole('tab', { name: /requirements/i }));
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText(/Chartered elsewhere/i)).toBeDefined();

    // Switch to Audit Trail tab: cancelled banner remains visible above
    fireEvent.click(screen.getByRole('tab', { name: /audit trail/i }));
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText(/Chartered elsewhere/i)).toBeDefined();
  });

  it('syncs chosen tab with URL query parameter ?tab=...', () => {
    render(<AssuranceDetailView setId="AS-2026-001" />);

    // Click Requirements tab
    fireEvent.click(screen.getByRole('tab', { name: /requirements/i }));
    expect(window.location.hash).toContain('tab=requirements');

    // Click Tasks tab
    fireEvent.click(screen.getByRole('tab', { name: /tasks/i }));
    expect(window.location.hash).toContain('tab=tasks');

    // Click Audit Trail tab
    fireEvent.click(screen.getByRole('tab', { name: /audit trail/i }));
    expect(window.location.hash).toContain('tab=audit-trail');

    // Click Details tab returns to base URL without tab query parameter
    fireEvent.click(screen.getByRole('tab', { name: /^details$/i }));
    expect(window.location.hash).toBe('#/assurance-sets/AS-2026-001');
  });

  it('focused requirement opens the Requirements tab automatically', () => {
    useMapStore.setState({
      focusedRequirementId: 'REQ-101',
    });

    render(<AssuranceDetailView setId="AS-2026-001" />);

    const reqTab = screen.getByRole('tab', { name: /requirements/i });
    expect(reqTab.getAttribute('aria-selected')).toBe('true');
  });

  it('Audit Trail tab includes events across all 10 domain target kinds for this assurance set', () => {
    const testSetId = 'AS-10-DOMAINS-01';
    const baseSet: AssuranceSet = {
      ...useMapStore.getState().assuranceSets[0],
      id: testSetId,
      title: 'Ten Domains Assurance Set',
      initiatorOrg: 'Northwind Marine Pty Ltd',
      createdByUserId: 'USR-101',
      createdByName: 'K. Osei',
      createdByPersona: 'Administrator',
      targetDateHistory: [],
    };

    const domainEvents: AuditTrailEvent[] = [
      {
        id: 'EV-SET-01',
        timestampUtc: '2026-10-25T10:00:00Z',
        userId: 'USR-101',
        userRole: 'Administrator',
        organization: 'Oil Co Global',
        action: 'Updated status',
        targetAsset: `${testSetId}`,
        target: { kind: 'set', setId: testSetId },
      },
      {
        id: 'EV-STAGE-01',
        timestampUtc: '2026-10-25T10:05:00Z',
        userId: 'USR-101',
        userRole: 'Administrator',
        organization: 'Oil Co Global',
        action: 'System Transition: Preparation -> Verification',
        targetAsset: `${testSetId}`,
        target: { kind: 'stage', setId: testSetId, stage: 'Verification' },
        fieldDelta: { fieldName: 'Stage', oldValue: 'Preparation', newValue: 'Verification' },
      },
      {
        id: 'EV-OBJ-01',
        timestampUtc: '2026-10-25T10:10:00Z',
        userId: 'USR-101',
        userRole: 'Administrator',
        organization: 'Oil Co Global',
        action: 'Attached vessel object',
        targetAsset: `${testSetId}`,
        target: { kind: 'object', setId: testSetId, objectId: 'VESSEL-001' },
      },
      {
        id: 'EV-REQ-01',
        timestampUtc: '2026-10-25T10:15:00Z',
        userId: 'USR-101',
        userRole: 'Administrator',
        organization: 'Oil Co Global',
        action: 'Updated requirement priority',
        targetAsset: `${testSetId}`,
        target: { kind: 'requirement', setId: testSetId, requirementId: 'REQ-101' },
      },
      {
        id: 'EV-DOC-01',
        timestampUtc: '2026-10-25T10:20:00Z',
        userId: 'USR-101',
        userRole: 'Administrator',
        organization: 'Oil Co Global',
        action: 'Uploaded revision',
        targetAsset: `${testSetId}`,
        target: { kind: 'document', setId: testSetId, documentId: 'MAP-DOC-001', version: 'v2.0' },
        fieldDelta: { fieldName: 'Version', oldValue: 'v1.0', newValue: 'v2.0' },
      },
      {
        id: 'EV-TASK-01',
        timestampUtc: '2026-10-25T10:25:00Z',
        userId: 'USR-101',
        userRole: 'Administrator',
        organization: 'Oil Co Global',
        action: 'Exempted task',
        targetAsset: `${testSetId}`,
        target: { kind: 'task', setId: testSetId, taskId: 'TASK-101' },
        fieldDelta: { fieldName: 'Exemption', oldValue: 'Active', newValue: 'Exempted until 2026-12-01' },
      },
      {
        id: 'EV-STAKE-01',
        timestampUtc: '2026-10-25T10:30:00Z',
        userId: 'USR-101',
        userRole: 'Administrator',
        organization: 'Oil Co Global',
        action: 'Assigned stakeholder',
        targetAsset: `${testSetId}`,
        target: { kind: 'stakeholder', setId: testSetId, userId: 'USR-102', role: 'Verifier' },
        fieldDelta: { fieldName: 'Verifier', oldValue: '—', newValue: 'USR-102' },
      },
      {
        id: 'EV-PARTY-01',
        timestampUtc: '2026-10-25T10:35:00Z',
        userId: 'USR-101',
        userRole: 'Administrator',
        organization: 'Oil Co Global',
        action: 'Changed party',
        targetAsset: `${testSetId}`,
        target: { kind: 'party', setId: testSetId, organization: 'Northwind Marine', partyRole: 'Service Provider' },
        fieldDelta: { fieldName: 'Service Provider', oldValue: '—', newValue: 'Northwind Marine' },
      },
      {
        id: 'EV-FIND-01',
        timestampUtc: '2026-10-25T10:40:00Z',
        userId: 'USR-101',
        userRole: 'Administrator',
        organization: 'Oil Co Global',
        action: 'Raised finding CAPA-001',
        targetAsset: `${testSetId}`,
        target: { kind: 'finding', setId: testSetId, findingId: 'CAPA-001' },
      },
      {
        id: 'EV-DATE-01',
        timestampUtc: '2026-10-25T10:45:00Z',
        userId: 'USR-101',
        userRole: 'Administrator',
        organization: 'Oil Co Global',
        action: 'Changed date',
        targetAsset: `${testSetId}`,
        target: { kind: 'date', setId: testSetId, dateField: 'complianceDeadline' },
        fieldDelta: { fieldName: 'Compliance deadline', oldValue: '2026-11-01', newValue: '2026-11-20' },
      },
    ];

    useMapStore.setState({
      assuranceSets: [baseSet, ...useMapStore.getState().assuranceSets.filter((s) => s.id !== testSetId)],
      auditEvents: domainEvents,
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: 'USR-101',
    });

    render(<AssuranceDetailView setId={testSetId} />);
    fireEvent.click(screen.getByRole('tab', { name: /audit trail/i }));

    // All 10 domain targets rendered
    expect(screen.getByText(`Set ${testSetId}`)).toBeInTheDocument();
    expect(screen.getByText(`Stage Verification · Set ${testSetId}`)).toBeInTheDocument();
    expect(screen.getByText(`Object VESSEL-001 · Set ${testSetId}`)).toBeInTheDocument();
    expect(screen.getByText(`Requirement REQ-101 · Set ${testSetId}`)).toBeInTheDocument();
    expect(screen.getByText(`Document MAP-DOC-001 (v2.0) · Set ${testSetId}`)).toBeInTheDocument();
    expect(screen.getByText(`Task TASK-101 · Set ${testSetId}`)).toBeInTheDocument();
    expect(screen.getByText(`Stakeholder Verifier · USR-102 · Set ${testSetId}`)).toBeInTheDocument();
    expect(screen.getByText(`Party Northwind Marine · Service Provider · Set ${testSetId}`)).toBeInTheDocument();
    expect(screen.getByText(`Finding CAPA-001 · Set ${testSetId}`)).toBeInTheDocument();
    expect(screen.getByText(`Date Compliance deadline · Set ${testSetId}`)).toBeInTheDocument();
  });

  it('Audit Trail tab live search and category filter filter events', () => {
    const testSetId = 'AS-FILTER-TEST-01';
    const baseSet: AssuranceSet = {
      ...useMapStore.getState().assuranceSets[0],
      id: testSetId,
      title: 'Filter Test Set',
      initiatorOrg: 'Northwind Marine Pty Ltd',
      createdByUserId: 'USR-101',
      createdByName: 'K. Osei',
      createdByPersona: 'Administrator',
      targetDateHistory: [],
    };

    const events: AuditTrailEvent[] = [
      {
        id: 'EV-STG-1',
        timestampUtc: '2026-10-25T10:00:00Z',
        userId: 'USR-101',
        userRole: 'Administrator',
        organization: 'Oil Co Global',
        action: 'System Transition: Preparation -> Verification',
        targetAsset: `${testSetId}`,
        target: { kind: 'stage', setId: testSetId, stage: 'Verification' },
        fieldDelta: { fieldName: 'Stage', oldValue: 'Preparation', newValue: 'Verification' },
      },
      {
        id: 'EV-DOC-1',
        timestampUtc: '2026-10-25T10:05:00Z',
        userId: 'USR-101',
        userRole: 'Administrator',
        organization: 'Oil Co Global',
        action: 'Uploaded revision',
        targetAsset: `${testSetId}`,
        target: { kind: 'document', setId: testSetId, documentId: 'MAP-DOC-001', version: 'v2.0' },
        fieldDelta: { fieldName: 'Version', oldValue: 'v1.0', newValue: 'v2.0' },
      },
      {
        id: 'EV-STK-1',
        timestampUtc: '2026-10-25T10:10:00Z',
        userId: 'USR-101',
        userRole: 'Administrator',
        organization: 'Oil Co Global',
        action: 'Assigned stakeholder',
        targetAsset: `${testSetId}`,
        target: { kind: 'stakeholder', setId: testSetId, userId: 'USR-102', role: 'Verifier' },
        fieldDelta: { fieldName: 'Verifier', oldValue: '—', newValue: 'USR-102' },
      },
    ];

    useMapStore.setState({
      assuranceSets: [baseSet, ...useMapStore.getState().assuranceSets.filter((s) => s.id !== testSetId)],
      auditEvents: events,
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: 'USR-101',
    });

    render(<AssuranceDetailView setId={testSetId} />);
    fireEvent.click(screen.getByRole('tab', { name: /audit trail/i }));

    const searchInput = screen.getByPlaceholderText('Search audit trail...');
    expect(searchInput).toBeInTheDocument();

    // Type "revision" in search input
    fireEvent.change(searchInput, { target: { value: 'revision' } });
    expect(screen.getByText('Uploaded revision')).toBeInTheDocument();
    expect(screen.queryByText(/System Transition/i)).toBeNull();
    expect(screen.queryByText('Assigned stakeholder')).toBeNull();

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText(/System Transition/i)).toBeInTheDocument();

    // Filter by category: "Documents & Requirements"
    const categorySelect = screen.getByLabelText(/filter by category/i);
    fireEvent.change(categorySelect, { target: { value: 'docs_reqs' } });
    expect(screen.getByText('Uploaded revision')).toBeInTheDocument();
    expect(screen.queryByText(/System Transition/i)).toBeNull();
    expect(screen.queryByText('Assigned stakeholder')).toBeNull();

    // Filter by category: "Stakeholders & Parties"
    fireEvent.change(categorySelect, { target: { value: 'stakeholders_parties' } });
    expect(screen.getByText('Assigned stakeholder')).toBeInTheDocument();
    expect(screen.queryByText('Uploaded revision')).toBeNull();
  });

  it('Audit Trail tab export buttons invoke logExport with format, setId, and screen details', () => {
    const testSetId = 'AS-EXPORT-TEST-01';
    const baseSet: AssuranceSet = {
      ...useMapStore.getState().assuranceSets[0],
      id: testSetId,
      title: 'Export Test Set',
      initiatorOrg: 'Northwind Marine Pty Ltd',
      createdByUserId: 'USR-101',
      createdByName: 'K. Osei',
      createdByPersona: 'Administrator',
      targetDateHistory: [],
    };

    const events: AuditTrailEvent[] = [
      {
        id: 'EV-EXP-1',
        timestampUtc: '2026-10-25T10:00:00Z',
        userId: 'USR-101',
        userRole: 'Administrator',
        organization: 'Oil Co Global',
        action: 'System Transition: Preparation -> Verification',
        targetAsset: `${testSetId}`,
        target: { kind: 'stage', setId: testSetId, stage: 'Verification' },
        fieldDelta: { fieldName: 'Stage', oldValue: 'Preparation', newValue: 'Verification' },
      },
    ];

    const logExportSpy = vi.fn();
    useMapStore.setState({
      assuranceSets: [baseSet, ...useMapStore.getState().assuranceSets.filter((s) => s.id !== testSetId)],
      auditEvents: events,
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: 'USR-101',
      logExport: logExportSpy,
    });

    // Mock link click and window open
    const clickMock = vi.fn();
    HTMLAnchorElement.prototype.click = clickMock;
    window.open = vi.fn().mockReturnValue({
      document: { write: vi.fn(), close: vi.fn() },
      print: vi.fn(),
      close: vi.fn(),
      focus: vi.fn(),
    });

    render(<AssuranceDetailView setId={testSetId} />);
    fireEvent.click(screen.getByRole('tab', { name: /audit trail/i }));

    // Audit tab keeps a single Export control (CSV/PDF live in the menu)
    const exportButtons = screen.getAllByRole('button', { name: /^export options$/i });
    expect(exportButtons).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /^export csv$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^export pdf$/i })).toBeNull();

    fireEvent.click(exportButtons[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: /^csv$/i }));
    expect(logExportSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        screen: 'Assurance set detail - Audit',
        format: 'CSV',
        setId: testSetId,
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: /^export options$/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^pdf$/i }));
    expect(logExportSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        screen: 'Assurance set detail - Audit',
        format: 'PDF',
        setId: testSetId,
      }),
    );
  });

  it('Audit Trail tab integrates pagination controls when event count exceeds page size', () => {
    const testSetId = 'AS-PAGE-TEST-01';
    const baseSet: AssuranceSet = {
      ...useMapStore.getState().assuranceSets[0],
      id: testSetId,
      title: 'Pagination Test Set',
      initiatorOrg: 'Northwind Marine Pty Ltd',
      createdByUserId: 'USR-101',
      createdByName: 'K. Osei',
      createdByPersona: 'Administrator',
      targetDateHistory: [],
    };

    // 15 events
    const events: AuditTrailEvent[] = Array.from({ length: 15 }, (_, i) => ({
      id: `EV-PAGE-${i + 1}`,
      timestampUtc: `2026-10-${String(10 + i).padStart(2, '0')}T10:00:00Z`,
      userId: 'USR-101',
      userRole: 'Administrator',
      organization: 'Oil Co Global',
      action: `Action ${i + 1}`,
      targetAsset: `${testSetId}`,
      target: { kind: 'set', setId: testSetId },
    }));

    useMapStore.setState({
      assuranceSets: [baseSet, ...useMapStore.getState().assuranceSets.filter((s) => s.id !== testSetId)],
      auditEvents: events,
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: 'USR-101',
    });

    render(<AssuranceDetailView setId={testSetId} />);
    fireEvent.click(screen.getByRole('tab', { name: /audit trail/i }));

    // Pagination nav is displayed
    const paginationNav = screen.getByRole('navigation', { name: /table pagination/i });
    expect(paginationNav).toBeInTheDocument();
    expect(screen.getByText(/showing 1-10 of 15/i)).toBeInTheDocument();

    // Page size dropdown exists with 10, 25, 50
    const pageSizeSelect = screen.getByRole('combobox', { name: /rows per page/i });
    expect(pageSizeSelect).toBeInTheDocument();
    expect(within(pageSizeSelect).getByRole('option', { name: '10' })).toBeInTheDocument();
    expect(within(pageSizeSelect).getByRole('option', { name: '25' })).toBeInTheDocument();
    expect(within(pageSizeSelect).getByRole('option', { name: '50' })).toBeInTheDocument();
  });

  it('Requirements tab consolidates Add Task and Add custom section in one Add menu, and Submitter sees no Add Task', () => {
    const state = useMapStore.getState();
    const testSetId = 'AS-TEST-ADD-MENU';
    const testSet: AssuranceSet = {
      ...state.assuranceSets[0],
      id: testSetId,
      initiatorOrg: 'Northwind Marine Pty Ltd',
      createdByUserId: 'USR-101',
      createdByName: 'K. Osei',
      createdByPersona: 'Administrator',
      assignedSubmitter: 'M. Chen (Northwind Marine Pty Ltd)',
    };

    // 1. As Administrator (creator who can manage tasks)
    useMapStore.setState({
      assuranceSets: [testSet, ...state.assuranceSets.filter((s) => s.id !== testSetId)],
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: 'USR-101',
    });

    const { rerender } = render(<AssuranceDetailView setId={testSetId} />);
    fireEvent.click(screen.getByRole('tab', { name: /requirements/i }));

    // Both Add menu and primary Upload Document button are present
    const addMenuBtn = screen.getByRole('button', { name: /^add$/i });
    expect(addMenuBtn).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /upload document/i })).toBeNull();

    // Opening Add menu reveals both actions
    fireEvent.click(addMenuBtn);
    expect(screen.getByRole('button', { name: /add task/i })).toBeInTheDocument();
    expect(screen.getByTestId('btn-add-custom-section')).toBeInTheDocument();

    // 2. As Submitter
    useMapStore.setState({
      activePersona: 'Submitter',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: 'USR-102',
    });

    rerender(<AssuranceDetailView setId={testSetId} />);

    // Submitter can open Add menu
    const submitterAddBtn = screen.getByRole('button', { name: /^add$/i });
    fireEvent.click(submitterAddBtn);

    // Submitter sees Add custom section, but no Add Task
    expect(screen.getByTestId('btn-add-custom-section')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add task/i })).toBeNull();
  });

  it('Requirements tab renders four table columns and expandable requirement rows toggled by click and Enter', () => {
    useMapStore.setState({
      activePersona: 'C Admin',
      activeDemoOrganization: 'Chevron Australia Pty Ltd',
      activeSessionUserId: 'USR-221',
    });

    render(<AssuranceDetailView setId="AS-2026-001" />);
    fireEvent.click(screen.getByRole('tab', { name: /requirements/i }));

    // 1. Table has four columns: Title, Target Object, Status, Actions (no OCR Confidence header)
    const table = screen.getByRole('table');
    const headerRow = table.querySelector('thead tr');
    expect(headerRow).not.toBeNull();
    const ths = within(headerRow as HTMLElement).getAllByRole('columnheader');
    expect(ths.length).toBe(4);
    expect(ths[0].textContent).toContain('Title');
    expect(ths[1].textContent).toContain('Target Object');
    expect(ths[2].textContent).toContain('Status');
    expect(ths[3].textContent).toContain('Actions');
    expect(within(headerRow as HTMLElement).queryByText(/ocr confidence/i)).toBeNull();

    // 2. Requirement row starts collapsed: description and OCR badge are not visible
    const firstReqToggle = screen.getByTestId('toggle-req-REQ-101');
    expect(firstReqToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('req-detail-REQ-101')).toBeNull();
    expect(screen.queryByText(/Classification society certificate issued by IACS authority/i)).toBeNull();

    // 3. Clicking chevron expands the row and reveals description and OCR badge
    fireEvent.click(firstReqToggle);
    expect(firstReqToggle).toHaveAttribute('aria-expanded', 'true');
    const detailRow = screen.getByTestId('req-detail-REQ-101');
    expect(detailRow).toBeInTheDocument();
    expect(within(detailRow).getByText(/Classification society certificate issued by IACS authority/i)).toBeInTheDocument();
    expect(within(detailRow).getByText(/ocr confidence:/i)).toBeInTheDocument();
    const confBadge = detailRow.querySelector('.badge-conf-low, [class*="badge-conf"]');
    expect(confBadge).not.toBeNull();
    expect(confBadge?.textContent).toContain('98%');

    // 4. Keyboard Enter toggles the row
    fireEvent.keyDown(firstReqToggle, { key: 'Enter', code: 'Enter' });
    expect(firstReqToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('req-detail-REQ-101')).toBeNull();

    // Re-opening with Enter
    fireEvent.keyDown(firstReqToggle, { key: 'Enter', code: 'Enter' });
    expect(firstReqToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('req-detail-REQ-101')).toBeInTheDocument();
  });

  it('Task 5364: shows at most one status badge on requirement row with precedence (Exempted > Shared > Lapsed), moving secondary badges to detail row', () => {
    const testSetId = 'AS-TASK-5364-ONE-BADGE';
    const baseSet = useMapStore.getState().assuranceSets[0];

    const defaultReq = useMapStore.getState().assuranceSets[0].requirements[0];

    const testSet: AssuranceSet = {
      ...baseSet,
      id: testSetId,
      title: 'One Status Badge Test Set',
      initiatorOrg: 'Northwind Marine Pty Ltd',
      createdByUserId: 'USR-101',
      createdByName: 'K. Osei',
      createdByPersona: 'Administrator',
      charterWindowStart: '2026-01-01',
      charterWindowEnd: '2026-12-31',
      requirements: [
        // 1. Exemption + Attempt + Version + Added by client + Lapsed doc
        // Precedence: Exempted wins over Lapsed, and Version/Attempt/Added by client move to detail row
        {
          ...defaultReq,
          id: 'REQ-BADGE-01',
          title: 'Exempted Priority Requirement',
          category: 'Statutory Certificate',
          sectionId: 'sec-statutory',
          verifierStatus: 'Verified',
          documentVersion: 'v2.1',
          attemptNumber: 3,
          isOtherDocument: true,
          isSpecialized: true,
          documentId: 'DOC-LAPSED-01',
          exemption: {
            reason: 'Flag state waiver granted',
            grantedBy: 'Maritime Authority',
            grantedAt: '2026-10-01T00:00:00Z',
            newDate: '2026-12-31',
          },
        },
        // 2. Shared requirement with 2 parties (no exemption)
        // Precedence: Shared (2 parties)
        {
          ...defaultReq,
          id: 'REQ-BADGE-02-A',
          requirementGroupId: 'grp-badge-02',
          title: 'Shared Radio Operator Requirement',
          category: 'Crew Endorsement',
          sectionId: 'sec-crew',
          verifierStatus: 'Pending',
          responsibleParty: 'Alpha Maritime',
        },
        {
          ...defaultReq,
          id: 'REQ-BADGE-02-B',
          requirementGroupId: 'grp-badge-02',
          title: 'Shared Radio Operator Requirement',
          category: 'Crew Endorsement',
          sectionId: 'sec-crew',
          verifierStatus: 'Pending',
          responsibleParty: 'Beta Shipping',
        },
        // 3. Lapsed document requirement (no exemption, not shared)
        // Precedence: Lapsed
        {
          ...defaultReq,
          id: 'REQ-BADGE-03',
          title: 'Lapsed Certificate Requirement',
          category: 'Statutory Certificate',
          sectionId: 'sec-statutory',
          verifierStatus: 'Pending',
          documentId: 'DOC-LAPSED-02',
        },
      ],
    };

    const lapsedDoc1 = {
      ...useMapStore.getState().documents[0],
      id: 'DOC-LAPSED-01',
      title: 'Expired Certificate 1',
      expiryDate: '2020-01-01',
      currentVersion: 'v2.1',
      status: 'Active' as const,
      category: 'Statutory Certificate',
      uploadedAt: '2020-01-01T00:00:00Z',
      fileSize: 1024,
      fileType: 'pdf',
      ocrConfidence: 95,
    };

    const lapsedDoc2 = {
      ...useMapStore.getState().documents[0],
      id: 'DOC-LAPSED-02',
      title: 'Expired Certificate 2',
      expiryDate: '2021-06-01',
      currentVersion: 'v1.0',
      status: 'Active' as const,
      category: 'Statutory Certificate',
      uploadedAt: '2021-06-01T00:00:00Z',
      fileSize: 1024,
      fileType: 'pdf',
      ocrConfidence: 90,
    };

    useMapStore.setState({
      assuranceSets: [testSet, ...useMapStore.getState().assuranceSets.filter((s) => s.id !== testSetId)],
      documents: [lapsedDoc1, lapsedDoc2, ...useMapStore.getState().documents],
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: 'USR-101',
    });

    render(<AssuranceDetailView setId={testSetId} />);
    fireEvent.click(screen.getByRole('tab', { name: /requirements/i }));

    // Requirement 1 Row: Has Exemption -> ONLY Exempted badge is on the row
    const row1 = screen.getByTestId('toggle-req-REQ-BADGE-01').closest('tr');
    expect(row1).not.toBeNull();
    expect(within(row1!).getByTestId('badge-exempted-REQ-BADGE-01')).toBeInTheDocument();
    // Secondary badges NOT on the row
    expect(within(row1!).queryByTestId('badge-other-doc-REQ-BADGE-01')).toBeNull();
    expect(within(row1!).queryByText('Attempt 3')).toBeNull();
    expect(within(row1!).queryByText('Custom')).toBeNull();
    expect(within(row1!).queryByText('v2.1')).toBeNull();
    expect(within(row1!).queryByTestId('badge-lapsed-REQ-BADGE-01')).toBeNull();

    // Expand Requirement 1: Secondary badges appear in detail row
    fireEvent.click(screen.getByTestId('toggle-req-REQ-BADGE-01'));
    const detailRow1 = screen.getByTestId('req-detail-REQ-BADGE-01');
    expect(detailRow1).toBeInTheDocument();
    expect(within(detailRow1).getByTestId('badge-other-doc-REQ-BADGE-01')).toBeInTheDocument();
    expect(within(detailRow1).getByText('Attempt 3')).toBeInTheDocument();
    expect(within(detailRow1).getByText('Custom')).toBeInTheDocument();
    expect(within(detailRow1).getByText('v2.1')).toBeInTheDocument();

    // Requirement 2 Row: Shared across multiple parties -> Shared (2 parties) badge
    expect(screen.getByTestId('badge-shared-requirement')).toBeInTheDocument();
    expect(screen.getByTestId('badge-shared-requirement').textContent).toContain('Shared (2 parties)');

    // Requirement 3 Row: Has Lapsed doc and no exemption -> Lapsed badge
    const row3 = screen.getByTestId('toggle-req-REQ-BADGE-03').closest('tr');
    expect(row3).not.toBeNull();
    expect(within(row3!).getByTestId('badge-lapsed-REQ-BADGE-03')).toBeInTheDocument();
    expect(within(row3!).getByTestId('badge-lapsed-REQ-BADGE-03').textContent).toBe('Lapsed');
  });

  it('Task 5365: renders persona-tailored columns and actions for Submitter and Verifier', () => {
    const testSetId = 'AS-TASK-5365-PERSONA-ROWS';
    const baseSet = useMapStore.getState().assuranceSets[0];
    const defaultReq = baseSet.requirements[0];

    const testSet: AssuranceSet = {
      ...baseSet,
      id: testSetId,
      title: 'Persona Rows Test Set',
      serviceProviderOrg: 'Northwind Marine Pty Ltd',
      assignedSubmitter: 'M. Chen (Northwind Marine Pty Ltd)',
      assignedVerifier: 'A. Fontaine (Bureau Veritas Inspectorate)',
      requirements: [
        {
          ...defaultReq,
          id: 'REQ-PERSONA-01',
          title: 'Vessel Safety Radio Certificate',
          category: 'Statutory Certificate',
          sectionId: 'sec-statutory',
          verifierStatus: 'Pending',
          documentId: 'DOC-PERSONA-01',
          documentVersion: 'v3.2',
        },
      ],
    };

    const testDoc = {
      ...useMapStore.getState().documents[0],
      id: 'DOC-PERSONA-01',
      title: 'Safety Radio Certificate',
      currentVersion: 'v3.2',
      status: 'Active' as const,
      category: 'Statutory Certificate',
    };

    useMapStore.setState({
      assuranceSets: [testSet, ...useMapStore.getState().assuranceSets.filter((s) => s.id !== testSetId)],
      documents: [testDoc, ...useMapStore.getState().documents],
    });

    // 1. Submitter Persona: Title, Status, Actions (3 columns); Upload action, NO PDF review
    useMapStore.setState({
      activePersona: 'Submitter',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: 'USR-102',
    });
    const { unmount: unmountSubmitter } = render(<AssuranceDetailView setId={testSetId} />);
    fireEvent.click(screen.getByRole('tab', { name: /requirements/i }));

    const submitterTable = screen.getByRole('table');
    const submitterHeaders = within(submitterTable.querySelector('thead tr') as HTMLElement).getAllByRole('columnheader');
    expect(submitterHeaders.length).toBe(3);
    expect(submitterHeaders[0].textContent).toContain('Title');
    expect(submitterHeaders[1].textContent).toContain('Status');
    expect(submitterHeaders[2].textContent).toContain('Actions');

    const submitterRow = screen.getByTestId('toggle-req-REQ-PERSONA-01').closest('tr');
    expect(submitterRow).not.toBeNull();
    expect(within(submitterRow!).queryByTitle(/upload/i)).toBeNull();
    expect(within(submitterRow!).queryByTitle(/pdf review/i)).toBeNull();

    // In expanded detail row, Target Object is available
    fireEvent.click(screen.getByTestId('toggle-req-REQ-PERSONA-01'));
    const submitterDetail = screen.getByTestId('req-detail-REQ-PERSONA-01');
    expect(within(submitterDetail).getByText(/target object:/i)).toBeInTheDocument();

    unmountSubmitter();

    // 2. Verifier Persona: Title, Version, Status, Actions (4 columns); Version and PDF review, NO Upload
    useMapStore.setState({
      activePersona: 'Verifier',
      activeDemoOrganization: 'Bureau Veritas Inspectorate',
      activeSessionUserId: 'USR-202',
    });
    const { unmount: unmountVerifier } = render(<AssuranceDetailView setId={testSetId} />);
    fireEvent.click(screen.getByRole('tab', { name: /requirements/i }));

    const verifierTable = screen.getByRole('table');
    const verifierHeaders = within(verifierTable.querySelector('thead tr') as HTMLElement).getAllByRole('columnheader');
    expect(verifierHeaders.length).toBe(4);
    expect(verifierHeaders[0].textContent).toContain('Title');
    expect(verifierHeaders[1].textContent).toContain('Version');
    expect(verifierHeaders[2].textContent).toContain('Status');
    expect(verifierHeaders[3].textContent).toContain('Actions');

    const verifierRow = screen.getByTestId('toggle-req-REQ-PERSONA-01').closest('tr');
    expect(verifierRow).not.toBeNull();
    // Verifier row has Version and PDF review and no Upload
    expect(within(verifierRow!).getByText('v3.2')).toBeInTheDocument();
    expect(within(verifierRow!).getByTitle(/pdf review/i)).toBeInTheDocument();
    expect(within(verifierRow!).queryByTitle(/upload/i)).toBeNull();

    unmountVerifier();
  });

  it('Task 5366: renders persona-tailored columns and actions for Approver, Inspector and Administrator with section counts', () => {
    const testSetId = 'AS-TASK-5366-ADMIN-APPROVER';
    const baseSet = useMapStore.getState().assuranceSets[0];
    const defaultReq = baseSet.requirements[0];

    const testSet: AssuranceSet = {
      ...baseSet,
      id: testSetId,
      title: 'Approver Inspector Admin Test Set',
      initiatorOrg: 'Northwind Marine Pty Ltd',
      createdByUserId: 'USR-101',
      createdByName: 'K. Osei',
      createdByPersona: 'Administrator',
      mandatoryInspectionRequired: true,
      assignedInspector: 'N. Technical (Bureau Veritas Inspectorate)',
      assignedApprover: 'P. Nardelli (Marine Assurance Authority)',
      stage: 'Verification',
      approverDecision: undefined,
      charterWindowStart: '2026-01-01',
      charterWindowEnd: '2026-12-31',
      cancelledAt: undefined,
      cancellationReason: undefined,
      sections: [
        { id: 'sec-statutory', name: 'Statutory Certificates', order: 1 },
      ],
      requirements: [
        // Req 1: Verified (Done) with document valid in contract period
        {
          ...defaultReq,
          id: 'REQ-APP-01',
          title: 'Load Line Certificate',
          category: 'Statutory Certificate',
          sectionId: 'sec-statutory',
          verifierStatus: 'Verified',
          isFulfilled: true,
          documentId: 'DOC-APP-01',
        },
        // Req 2: Pending (Open)
        {
          ...defaultReq,
          id: 'REQ-APP-02',
          title: 'Safety Radio Certificate',
          category: 'Statutory Certificate',
          sectionId: 'sec-statutory',
          verifierStatus: 'Pending',
          isFulfilled: false,
          documentId: 'DOC-APP-02',
        },
      ],
    };

    const doc1 = {
      ...useMapStore.getState().documents[0],
      id: 'DOC-APP-01',
      title: 'Load Line Cert',
      expiryDate: '2027-06-01',
      currentVersion: 'v1.0',
      status: 'Active' as const,
      category: 'Statutory Certificate',
    };

    const doc2 = {
      ...useMapStore.getState().documents[0],
      id: 'DOC-APP-02',
      title: 'Safety Radio Cert',
      expiryDate: '2026-06-01',
      currentVersion: 'v1.0',
      status: 'Active' as const,
      category: 'Statutory Certificate',
    };

    useMapStore.setState({
      assuranceSets: [testSet, ...useMapStore.getState().assuranceSets.filter((s) => s.id !== testSetId)],
      documents: [doc1, doc2, ...useMapStore.getState().documents],
    });

    // 1. Administrator Persona:
    // - Header has Target Object
    // - Section header shows done/total count (e.g. 1/2)
    // - Row has Edit and Remove actions
    useMapStore.setState({
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: 'USR-101',
    });
    const { unmount: unmountAdmin } = render(<AssuranceDetailView setId={testSetId} />);
    fireEvent.click(screen.getByRole('tab', { name: /requirements/i }));

    const adminTable = screen.getByRole('table');
    const adminHeaders = within(adminTable.querySelector('thead tr') as HTMLElement).getAllByRole('columnheader');
    expect(adminHeaders.length).toBe(4);
    expect(adminHeaders[1].textContent).toContain('Target Object');

    // Section header reads 1/2
    const sectionCountBadge = screen.getByTestId('section-count-statutory-certificates');
    expect(sectionCountBadge).toBeInTheDocument();
    expect(sectionCountBadge.textContent).toBe('1/2');

    // Row has Edit and Remove
    const adminRow = screen.getByTestId('toggle-req-REQ-APP-01').closest('tr');
    expect(within(adminRow!).getByTitle(/edit task/i)).toBeInTheDocument();
    expect(within(adminRow!).getByTitle(/remove task/i)).toBeInTheDocument();

    unmountAdmin();

    // 2. Approver Persona:
    // - Header has Validity column
    // - Section header does NOT show count badge
    // - Row has validity badge (e.g. Valid Through Contract Period)
    // - Row has NO Edit or Remove actions
    useMapStore.setState({
      activePersona: 'Approver',
      activeDemoOrganization: 'Marine Assurance Authority',
      activeSessionUserId: 'USR-204',
    });
    const { unmount: unmountApprover } = render(<AssuranceDetailView setId={testSetId} />);
    fireEvent.click(screen.getByRole('tab', { name: /requirements/i }));

    const approverTable = screen.getByRole('table');
    const approverHeaders = within(approverTable.querySelector('thead tr') as HTMLElement).getAllByRole('columnheader');
    expect(approverHeaders.length).toBe(4);
    expect(approverHeaders[1].textContent).toContain('Validity');

    // Section header does not have count badge
    expect(screen.queryByTestId('section-count-statutory-certificates')).toBeNull();

    // Row has validity badge and no Edit
    const approverRow = screen.getByTestId('toggle-req-REQ-APP-01').closest('tr');
    expect(within(approverRow!).getByTestId('badge-validity-REQ-APP-01')).toBeInTheDocument();
    expect(within(approverRow!).getByTestId('badge-validity-REQ-APP-01').textContent).toBe('Valid Through Contract Period');
    expect(within(approverRow!).queryByTitle(/edit task/i)).toBeNull();
    expect(within(approverRow!).queryByTitle(/remove task/i)).toBeNull();

    unmountApprover();

    // 3. Inspector Persona:
    // - Row has validity badge and no Edit or Remove actions
    useMapStore.setState({
      activePersona: 'Inspector',
      activeDemoOrganization: 'Bureau Veritas Inspectorate',
      activeSessionUserId: 'USR-203',
    });
    const { unmount: unmountInspector } = render(<AssuranceDetailView setId={testSetId} />);
    fireEvent.click(screen.getByRole('tab', { name: /requirements/i }));

    const inspectorRow = screen.getByTestId('toggle-req-REQ-APP-02').closest('tr');
    expect(within(inspectorRow!).getByTestId('badge-validity-REQ-APP-02')).toBeInTheDocument();
    expect(within(inspectorRow!).queryByTitle(/edit task/i)).toBeNull();
    expect(within(inspectorRow!).queryByTitle(/remove task/i)).toBeNull();

    unmountInspector();
  });

  describe('Inspection as a task in Tasks tab', () => {
    const inspectionTestSetId = 'AS-INSP-TASK-TEST-01';

    beforeEach(() => {
      const state = useMapStore.getState();
      const testSet: AssuranceSet = {
        id: inspectionTestSetId,
        title: 'Rig Tender Inspection Campaign',
        vesselName: 'MV Deep Venture',
        stage: 'Inspection',
        mandatoryInspectionRequired: true,
        inspectionCompleted: false,
        targetDate: '2026-11-20',
        assignedInspector: 'N. Technical (Bureau Veritas Inspectorate)',
        assignedSubmitter: 'M. Chen (Northwind Marine Pty Ltd)',
        assignedVerifier: 'A. Fontaine (Bureau Veritas Inspectorate)',
        requirements: [
          {
            id: 'REQ-INSP-01',
            category: 'Statutory Certificates',
            title: 'Load Line Certificate',
            isMandatory: true,
            isFulfilled: true,
            verifierStatus: 'Verified',
            ocrConfidence: 99,
          },
        ],
      } as unknown as AssuranceSet;

      useMapStore.setState({
        assuranceSets: [testSet, ...state.assuranceSets.filter((s) => s.id !== inspectionTestSetId)],
        activePersona: 'Inspector',
        activeDemoOrganization: 'Bureau Veritas Inspectorate',
        activeSessionUserId: 'USR-203',
        isAuthenticated: true,
      });
    });

    it('shows Tasks tab badge count 1, renders inspection row with Inspect button, and header Open Inspection button is gone', () => {
      render(<AssuranceDetailView setId={inspectionTestSetId} />);

      // 1. Header Open Inspection button is removed
      expect(screen.queryByRole('button', { name: /open inspection/i })).toBeNull();

      // 2. Tasks tab badge shows 1 for assigned inspector
      const tasksTab = screen.getByRole('tab', { name: /^Tasks/i });
      expect(tasksTab).toBeInTheDocument();
      expect(within(tasksTab).getByText('1')).toBeInTheDocument();

      // 3. Open Tasks tab
      fireEvent.click(tasksTab);

      // 4. Inspection task row is present
      const inspectRow = screen.getByTestId(`task-open-req-${inspectionTestSetId}-INSPECTION`).closest('tr');
      expect(inspectRow).not.toBeNull();
      expect(within(inspectRow!).getByTestId(`task-open-req-${inspectionTestSetId}-INSPECTION`)).toHaveTextContent('Inspection');
      expect(within(inspectRow!).getByText('To Inspect')).toBeInTheDocument();
      const statusBadge = within(inspectRow!).getByTestId('task-status-badge');
      expect(statusBadge).toHaveClass('badge', 'bg-secondary', 'text-white');

      // 5. Inspect button
      const inspectBtn = within(inspectRow!).getByTestId(`task-action-btn-${inspectionTestSetId}-INSPECTION`);
      expect(inspectBtn).toHaveTextContent('Inspect');
      expect(inspectBtn).toHaveClass('btn', 'btn-sm', 'btn-primary');

      // 6. Clicking Inspect navigates to inspector checklist view
      fireEvent.click(inspectBtn);
      expect(useMapStore.getState().currentHashView).toBe('inspector');
      expect(useMapStore.getState().currentEntityId).toBe(inspectionTestSetId);
    });

    it('After an inspection pass, a non-inspector sees the Inspection row as Done, Passed, with View', () => {
      const state = useMapStore.getState();
      useMapStore.setState({
        assuranceSets: state.assuranceSets.map((s) =>
          s.id === inspectionTestSetId ? { ...s, inspectionCompleted: true, stage: 'Approval' } : s,
        ),
        activePersona: 'Submitter',
        activeDemoOrganization: 'Northwind Marine Pty Ltd',
        activeSessionUserId: 'USR-102',
      });

      render(<AssuranceDetailView setId={inspectionTestSetId} />);

      const tasksTab = screen.getByRole('tab', { name: /^Tasks/i });
      fireEvent.click(tasksTab);

      const inspectRow = screen.getByTestId(`task-open-req-${inspectionTestSetId}-INSPECTION`).closest('tr');
      expect(inspectRow).not.toBeNull();
      expect(within(inspectRow!).getByText('Done')).toBeInTheDocument();
      expect(within(inspectRow!).getByText('Passed')).toBeInTheDocument();
      const actionBtn = within(inspectRow!).getByTestId(`task-action-btn-${inspectionTestSetId}-INSPECTION`);
      expect(actionBtn).toHaveTextContent('View');
      expect(actionBtn).toHaveClass('btn', 'btn-sm', 'btn-outline-primary');
    });

    it('Only the inspector gets Inspect while it is open, everyone else gets View', () => {
      // 1. Inspector gets Inspect
      const { unmount } = render(<AssuranceDetailView setId={inspectionTestSetId} />);
      const tasksTab = screen.getByRole('tab', { name: /^Tasks/i });
      fireEvent.click(tasksTab);

      const inspectRow = screen.getByTestId(`task-open-req-${inspectionTestSetId}-INSPECTION`).closest('tr');
      const inspectBtn = within(inspectRow!).getByTestId(`task-action-btn-${inspectionTestSetId}-INSPECTION`);
      expect(inspectBtn).toHaveTextContent('Inspect');
      expect(inspectBtn).toHaveClass('btn-primary');
      unmount();

      // 2. Non-inspector (e.g. Submitter) gets View
      useMapStore.setState({
        activePersona: 'Submitter',
        activeDemoOrganization: 'Northwind Marine Pty Ltd',
        activeSessionUserId: 'USR-102',
      });
      render(<AssuranceDetailView setId={inspectionTestSetId} />);
      const subTasksTab = screen.getByRole('tab', { name: /^Tasks/i });
      fireEvent.click(subTasksTab);

      const subInspectRow = screen.getByTestId(`task-open-req-${inspectionTestSetId}-INSPECTION`).closest('tr');
      const viewBtn = within(subInspectRow!).getByTestId(`task-action-btn-${inspectionTestSetId}-INSPECTION`);
      expect(viewBtn).toHaveTextContent('View');
      expect(viewBtn).toHaveClass('btn-outline-primary');
    });

    it('Return, then resubmit, then Approve leaves exactly one Approval row, ending Done, Approved', () => {
      const state = useMapStore.getState();
      const approvalSetId = 'AS-APPR-CYCLE-TEST';
      const testApprovalSet: AssuranceSet = {
        id: approvalSetId,
        title: 'Approval Cycle Set',
        vesselName: 'MV Deep Venture',
        stage: 'Approval',
        mandatoryInspectionRequired: false,
        inspectionCompleted: false,
        assignedApprover: 'Elena Gomez (Southern Basin Energy Pty Ltd)',
        assignedSubmitter: 'M. Chen (Northwind Marine Pty Ltd)',
        clientOrg: 'Southern Basin Energy Pty Ltd',
        serviceProviderOrg: 'Northwind Marine Pty Ltd',
        requirements: [
          {
            id: 'REQ-APPR-01',
            category: 'Statutory Certificates',
            title: 'Safety Equipment Certificate',
            isMandatory: true,
            isFulfilled: true,
            verifierStatus: 'Verified',
          },
        ],
      } as unknown as AssuranceSet;

      useMapStore.setState({
        assuranceSets: [testApprovalSet, ...state.assuranceSets.filter((s) => s.id !== approvalSetId)],
        activePersona: 'Approver',
        activeDemoOrganization: 'Southern Basin Energy Pty Ltd',
        activeSessionUserId: 'USR-208',
      });

      const { unmount } = render(<AssuranceDetailView setId={approvalSetId} />);
      fireEvent.click(screen.getByRole('tab', { name: /^Tasks/i }));

      // Initially in Approval: exactly one Approval row with To Approve and Approve button
      let approvalRows = screen.getAllByTestId(`task-open-req-${approvalSetId}-APPROVAL`);
      expect(approvalRows.length).toBe(1);
      const approveBtn = screen.getByTestId(`task-action-btn-${approvalSetId}-APPROVAL`);
      expect(approveBtn).toHaveTextContent('Approve');
      expect(approveBtn).toHaveClass('btn-primary');

      // 1. Approver returns set for correction
      useMapStore.getState().setApproverDecision(approvalSetId, 'Returned for Correction', 'Update certificate.');
      // Stage moved back before Approval (e.g. Verification)
      useMapStore.setState((s) => ({
        assuranceSets: s.assuranceSets.map((set) =>
          set.id === approvalSetId ? { ...set, stage: 'Verification' } : set,
        ),
      }));

      unmount();
      const { unmount: unmount2 } = render(<AssuranceDetailView setId={approvalSetId} />);
      fireEvent.click(screen.getByRole('tab', { name: /^Tasks/i }));

      // After return: exactly one Approval row, status On-going, note "Returned for correction", button: none
      approvalRows = screen.getAllByTestId(`task-open-req-${approvalSetId}-APPROVAL`);
      expect(approvalRows.length).toBe(1);
      const returnedRow = approvalRows[0].closest('tr');
      expect(within(returnedRow!).getByText('On-going')).toBeInTheDocument();
      expect(within(returnedRow!).getByText('Returned for correction')).toBeInTheDocument();
      expect(within(returnedRow!).queryByTestId(`task-action-btn-${approvalSetId}-APPROVAL`)).toBeNull();

      // 2. Resubmit: documents verified, stage transitions back to Approval
      // Reset approverDecision to 'Pending' and mark requirements verified
      useMapStore.setState((s) => ({
        assuranceSets: s.assuranceSets.map((set) =>
          set.id === approvalSetId
            ? {
                ...set,
                stage: 'Approval',
                approverDecision: 'Pending',
                requirements: (set.requirements || []).map((r) => ({
                  ...r,
                  isFulfilled: true,
                  verifierStatus: 'Verified' as const,
                })),
              }
            : set,
        ),
      }));

      unmount2();
      const { unmount: unmount3 } = render(<AssuranceDetailView setId={approvalSetId} />);
      fireEvent.click(screen.getByRole('tab', { name: /^Tasks/i }));

      // After resubmission: exactly one row, To Approve
      approvalRows = screen.getAllByTestId(`task-open-req-${approvalSetId}-APPROVAL`);
      expect(approvalRows.length).toBe(1);
      expect(within(approvalRows[0].closest('tr')!).getByText('To Approve')).toBeInTheDocument();

      // 3. Approve
      useMapStore.getState().setApproverDecision(approvalSetId, 'Approved', 'Approved.');
      unmount3();
      render(<AssuranceDetailView setId={approvalSetId} />);
      fireEvent.click(screen.getByRole('tab', { name: /^Tasks/i }));

      // Leaves exactly one Approval row, ending Done, Approved
      approvalRows = screen.getAllByTestId(`task-open-req-${approvalSetId}-APPROVAL`);
      expect(approvalRows.length).toBe(1);
      const approvedRow = approvalRows[0].closest('tr');
      expect(within(approvedRow!).getByText('Done')).toBeInTheDocument();
      expect(within(approvedRow!).getByText('Approved')).toBeInTheDocument();
      expect(within(approvedRow!).getByTestId(`task-action-btn-${approvalSetId}-APPROVAL`)).toHaveTextContent('View');
    });

    it('The set Tasks tab has no "Parent assurance set" header, and a project-scope table still has one', () => {
      // 1. Set Tasks tab (scope.type === 'set')
      const { unmount } = render(<AssuranceDetailView setId={inspectionTestSetId} />);
      fireEvent.click(screen.getByRole('tab', { name: /^Tasks/i }));
      expect(screen.queryByRole('columnheader', { name: /parent assurance set/i })).toBeNull();
      expect(screen.queryByText(/parent assurance set/i)).toBeNull();
      unmount();

      // 2. Project-scope table (scope.type === 'project')
      render(
        <ProjectTasksTable
          sets={useMapStore.getState().assuranceSets}
          scope={{ type: 'project', id: 'PROJ-TEST-01' }}
          showActions
        />
      );
      expect(screen.getByRole('columnheader', { name: /parent assurance set/i })).toBeInTheDocument();
    });
  });
});
