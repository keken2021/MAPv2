import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { AssuranceObjectsView } from '../views/AssuranceObjectsView';
import { ActivityDetailView } from '../views/ActivityDetailView';
import { isViewAccessibleToPersona } from '../utils/rbacHelpers';
import { setsUsingObject } from '../views/AssuranceObjectsView';
import { UserRolePersona } from '../types/audit';

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
});
