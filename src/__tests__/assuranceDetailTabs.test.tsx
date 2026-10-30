import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AssuranceDetailView } from '../views/AssuranceDetailView';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet } from '../types/assurance';
import { AuditTrailEvent } from '../types/audit';

describe('Assurance Detail Tabs and Audit Trail (Task 5269)', () => {
  const originalHash = window.location.hash;

  beforeEach(() => {
    window.location.hash = '';
    useMapStore.setState({
      activePersona: 'C Admin',
      activeDemoOrganization: 'Oil Co Global',
      isAuthenticated: true,
      activeSessionUserId: 'USR-101',
    });
  });

  afterEach(() => {
    window.location.hash = originalHash;
  });

  it('renders one tab row in exact order: Details | Requirements | Tasks | Audit Trail', () => {
    render(<AssuranceDetailView setId="AS-2026-001" />);

    const tabList = screen.getByRole('tablist');
    expect(tabList).toBeDefined();

    const tabs = within(tabList).getAllByRole('tab');
    expect(tabs.length).toBe(4);
    expect(tabs[0].textContent?.trim()).toBe('Details');
    expect(tabs[1].textContent?.trim()).toBe('Requirements');
    expect(tabs[2].textContent?.trim()).toBe('Tasks');
    expect(tabs[3].textContent?.trim()).toBe('Audit Trail');

    // Stage is not a tab
    expect(within(tabList).queryByRole('tab', { name: /stage/i })).toBeNull();
  });

  it('Details tab opens by default and holds summary card, stage pipeline stepper, and readiness gauge', () => {
    const { container } = render(<AssuranceDetailView setId="AS-2026-001" />);

    const detailsTab = screen.getByRole('tab', { name: /^details$/i });
    expect(detailsTab.getAttribute('aria-selected')).toBe('true');

    // Summary info card is visible
    expect(container.querySelector('.col-lg-8 .card.map-card-custom')).not.toBeNull();

    // Stage pipeline stepper is visible inside Details tab
    expect(screen.getByText('Stage')).toBeDefined();
    expect(container.querySelector('.pipeline-stepper, [data-testid="pipeline-stepper"], .d-flex.flex-column')).not.toBeNull();

    // Readiness gauge is visible inside Details tab
    expect(screen.getByText('Readiness')).toBeDefined();

    // Requirements table is not rendered while Details tab is active
    expect(screen.queryByText(/Requirements Register/i)).toBeNull();
    expect(screen.queryByRole('table', { name: /requirements/i })).toBeNull();
  });

  it('Requirements tab displays requirements register table unchanged', () => {
    render(<AssuranceDetailView setId="AS-2026-001" />);

    fireEvent.click(screen.getByRole('tab', { name: /requirements/i }));

    const reqTab = screen.getByRole('tab', { name: /requirements/i });
    expect(reqTab.getAttribute('aria-selected')).toBe('true');

    // Requirements header inside card
    const reqElements = screen.getAllByText('Requirements');
    expect(reqElements.length).toBeGreaterThanOrEqual(2);

    // Requirement rows are visible
    const table = screen.getByRole('table');
    expect(table).toBeDefined();
    expect(within(table).getByText(/Certificate of Class/i)).toBeDefined();
  });

  it('Tasks tab holds task section cards and their exempt and edit actions', () => {
    render(<AssuranceDetailView setId="AS-2026-001" />);

    fireEvent.click(screen.getByRole('tab', { name: /tasks/i }));

    const tasksTab = screen.getByRole('tab', { name: /tasks/i });
    expect(tasksTab.getAttribute('aria-selected')).toBe('true');

    // Task sections card is present
    expect(screen.getByText('Task sections')).toBeDefined();
  });

  it('Audit Trail tab lists this set\'s audit events with time, person and role, action, and deltas', () => {
    const state = useMapStore.getState();
    const testSetId = 'AS-TEST-AUDIT-01';

    const testSet: AssuranceSet = {
      ...state.assuranceSets[0],
      id: testSetId,
      title: 'Audit Set Alpha',
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
      targetDateHistory: [],
    };

    useMapStore.setState({
      assuranceSets: [emptySet, ...state.assuranceSets.filter((s) => s.id !== emptySetId)],
      auditEvents: [],
      activePersona: 'Administrator',
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
      serviceProviderOrg: 'Northwind Marine',
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
      activeSessionUserId: 'USR-102',
    });

    render(<AssuranceDetailView setId={testSetId} />);
    fireEvent.click(screen.getByRole('tab', { name: /audit trail/i }));

    // Submitter sees their own event
    expect(screen.getByText('Uploaded Document')).toBeDefined();
    // Submitter does not see the Administrator's internal set date change event
    expect(screen.queryByText('Updated compliance deadline')).toBeNull();
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
});
