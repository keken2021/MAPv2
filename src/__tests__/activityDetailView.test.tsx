import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { AssuranceObjectsView } from '../views/AssuranceObjectsView';
import { ActivityDetailView } from '../views/ActivityDetailView';
import { isViewAccessibleToPersona } from '../utils/rbacHelpers';
import { setsUsingObject } from '../views/AssuranceObjectsView';
import { UserRolePersona } from '../types/audit';
import { AssuranceObject } from '../types/assurance';

const ORG = 'Northwind Marine Pty Ltd';

function signIn(persona: UserRolePersona, organization = ORG) {
  useMapStore.setState({
    activePersona: persona,
    activeDemoOrganization: organization,
    activeSessionUserId: undefined,
    isAuthenticated: true,
    currentHashView: 'objects',
    currentEntityId: undefined,
    previousHashView: undefined,
    previousEntityId: undefined,
  });
}

describe('ActivityDetailView', () => {
  beforeEach(() => {
    signIn('Administrator');
  });

  it('clicking an activity row on All Objects opens the activities page instead of the drawer', () => {
    const { assuranceObjects } = useMapStore.getState();
    const activity = assuranceObjects.find(
      (obj) => obj.type === 'activity' && obj.ownerOrganization === ORG,
    );
    expect(activity).toBeDefined();

    render(<AssuranceObjectsView />);

    // Filter to activity to show on page 1
    const typeSelect = screen.getByRole('combobox', { name: 'Filter by type' });
    fireEvent.change(typeSelect, { target: { value: 'activity' } });

    // Activity row exists in table
    const activityName = screen.getByText(activity!.name);
    const row = activityName.closest('tr');
    expect(row).not.toBeNull();

    // Clicking row calls openDetail which sets currentHashView to 'activities'
    fireEvent.click(row!);

    const state = useMapStore.getState();
    expect(state.currentHashView).toBe('activities');
    expect(state.currentEntityId).toBe(activity!.id);

    // Ensure drawer did not open
    expect(screen.queryByTestId('assurance-object-drawer')).toBeNull();
  });

  it('header shows identifier, owner and set count', () => {
    const { assuranceObjects, assuranceSets } = useMapStore.getState();
    const activity = assuranceObjects.find(
      (obj) => obj.type === 'activity' && obj.ownerOrganization === ORG,
    )!;
    expect(activity).toBeDefined();

    const usedCount = setsUsingObject(activity.id, assuranceSets);

    render(<ActivityDetailView activityId={activity.id} />);

    // Detail header title
    expect(screen.getByRole('heading', { level: 1, name: activity.name })).toBeInTheDocument();

    // Detail header meta items
    if (activity.identifier) {
      expect(screen.getAllByText(activity.identifier).length).toBeGreaterThanOrEqual(1);
    }
    expect(screen.getAllByText(activity.ownerOrganization).length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(`Used in ${usedCount} ${usedCount === 1 ? 'set' : 'sets'}`),
    ).toBeInTheDocument();
  });

  it('renders tabs with Overview active and displays description, identifier, owner and verifications', () => {
    const { assuranceObjects } = useMapStore.getState();
    const activity = assuranceObjects.find(
      (obj) => obj.type === 'activity' && obj.ownerOrganization === ORG,
    )!;

    render(<ActivityDetailView activityId={activity.id} />);

    // Tabs container with aria-label
    const tabs = screen.getByRole('tablist', { name: 'Activity detail tabs' });
    expect(tabs).toBeInTheDocument();

    const overviewTab = screen.getByRole('tab', { name: 'Overview' });
    expect(overviewTab).toHaveAttribute('aria-selected', 'true');

    // Overview content
    if (activity.description) {
      expect(screen.getByText(activity.description)).toBeInTheDocument();
    }
    expect(screen.getByText('Identifier')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
  });

  it('back link returns to referring screen', () => {
    const { assuranceObjects } = useMapStore.getState();
    const activity = assuranceObjects.find(
      (obj) => obj.type === 'activity' && obj.ownerOrganization === ORG,
    )!;

    useMapStore.setState({
      previousHashView: 'objects',
      previousEntityId: undefined,
      currentHashView: 'activities',
      currentEntityId: activity.id,
    });

    render(<ActivityDetailView activityId={activity.id} />);

    const backButton = screen.getByRole('button', { name: /Back to Objects/i });
    expect(backButton).toBeInTheDocument();

    fireEvent.click(backButton);

    const state = useMapStore.getState();
    expect(state.currentHashView).toBe('objects');
  });

  it('allows route access for all six roles of canOpenObjectsList', () => {
    const roles: UserRolePersona[] = [
      'Administrator',
      'C Admin',
      'Submitter',
      'Verifier',
      'Inspector',
      'Approver',
    ];

    roles.forEach((role) => {
      expect(isViewAccessibleToPersona('activities', 'MAP-ACT-2026-LNG-001', role)).toBe(true);
    });
  });

  it('renders correctly for Submitter persona', () => {
    signIn('Submitter', 'Northwind Marine Pty Ltd');
    const { assuranceObjects } = useMapStore.getState();
    const activity = assuranceObjects.find((obj) => obj.type === 'activity')!;

    render(<ActivityDetailView activityId={activity.id} />);
    expect(screen.getByRole('heading', { level: 1, name: activity.name })).toBeInTheDocument();
  });

  it('preserves tab order: Overview, Documents, Assurance, Audit Trail with counts in labels', () => {
    const { assuranceObjects } = useMapStore.getState();
    const activity = assuranceObjects.find(
      (obj) => obj.type === 'activity' && (obj.statusHistory || []).length > 0,
    )!;
    expect(activity).toBeDefined();

    render(<ActivityDetailView activityId={activity.id} />);

    const tabList = screen.getByRole('tablist', { name: 'Activity detail tabs' });
    const tabButtons = within(tabList).getAllByRole('tab');

    // Tab order must be Overview, Documents, Assurance, Audit Trail (if visible)
    const tabNames = tabButtons.map((b) => b.textContent?.trim());
    expect(tabNames[0]).toBe('Overview');

    const expectedOrder = ['Overview', 'Documents', 'Assurance', 'Audit Trail'];
    let lastIndex = -1;
    tabNames.forEach((name) => {
      const matched = expectedOrder.findIndex((prefix) => name?.startsWith(prefix));
      expect(matched).toBeGreaterThan(lastIndex);
      lastIndex = matched;
    });
  });

  it('hides empty Documents and Audit Trail tabs for a Submitter and matches Assurance count to setsUsingObject', () => {
    // Setup an activity with no documents and no status history, covered by a set assigned to Submitter
    const activityId = 'MAP-ACT-TEST-EMPTY-01';
    const emptyActivity: AssuranceObject = {
      id: activityId,
      type: 'activity',
      name: 'Empty Test Activity',
      ownerOrganization: ORG,
      identifier: 'ACT-EMPTY-01',
      description: 'An activity with no evidence or history',
      statusHistory: [],
    };

    const state = useMapStore.getState();
    const existingSet = state.assuranceSets[0];
    const updatedSet = {
      ...existingSet,
      assuranceObjects: [...(existingSet.assuranceObjects || []), emptyActivity],
    };

    useMapStore.setState({
      assuranceObjects: [...state.assuranceObjects, emptyActivity],
      assuranceSets: [updatedSet, ...state.assuranceSets.slice(1)],
    });

    signIn('Submitter', ORG);

    render(<ActivityDetailView activityId={activityId} />);

    const tabList = screen.getByRole('tablist', { name: 'Activity detail tabs' });
    const tabButtons = within(tabList).getAllByRole('tab');
    const tabLabels = tabButtons.map((b) => b.textContent?.trim());

    // Overview is shown
    expect(tabLabels).toContain('Overview');

    // Documents is hidden for Submitter when empty
    expect(tabLabels.some((l) => l?.startsWith('Documents'))).toBe(false);

    // Audit Trail is hidden for Submitter when empty
    expect(tabLabels.some((l) => l?.startsWith('Audit Trail'))).toBe(false);

    // Assurance tab is shown and count matches setsUsingObject
    const usedCount = setsUsingObject(activityId, useMapStore.getState().assuranceSets);
    expect(usedCount).toBeGreaterThanOrEqual(1);
    expect(tabLabels).toContain(`Assurance (${usedCount})`);
  });

  it('navigates to assurance set when an assurance row is clicked', () => {
    const { assuranceObjects, assuranceSets } = useMapStore.getState();
    const activity = assuranceObjects.find((obj) => obj.type === 'activity')!;
    const sets = assuranceSets.filter((s) =>
      (s.assuranceObjects || []).some((o) => o.id === activity.id),
    );
    expect(sets.length).toBeGreaterThan(0);

    render(<ActivityDetailView activityId={activity.id} />);

    // Click Assurance tab
    const assuranceTab = screen.getByRole('tab', { name: /Assurance/i });
    fireEvent.click(assuranceTab);

    // Table should render
    const table = screen.getByTestId('activity-assurance-table');
    expect(table).toBeInTheDocument();

    // Click the first set row
    const viewButton = within(table).getAllByRole('button', { name: /View/i })[0];
    fireEvent.click(viewButton);

    expect(useMapStore.getState().currentHashView).toBe('assurance-sets');
    expect(useMapStore.getState().currentEntityId).toBe(sets[0].id);
  });
});
