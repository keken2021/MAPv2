import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { UserRolePersona } from '../types/audit';
import { useMapStore } from '../store/useMapStore';
import { getDemoSessionContext, getSessionUserForPersona } from '../utils/userRoleHelpers';
import { isAssuranceSetAssignedToPersona } from '../utils/rbacHelpers';
import { getAssuranceSetObjects } from '../utils/assuranceTemplates';
import {
  AssuranceObjectsView,
  assuranceObjectsForSession,
  filterAssuranceObjectRows,
  objectsWithKnownOwners,
} from '../views/AssuranceObjectsView';

const ORG = 'Northwind Marine Pty Ltd';

function sessionUser(persona: UserRolePersona, organization = ORG) {
  const { users } = useMapStore.getState();
  return getSessionUserForPersona(
    persona,
    users,
    getDemoSessionContext({ activeDemoOrganization: organization }),
  );
}

function visible(persona: UserRolePersona, organization = ORG) {
  const { assuranceObjects, assuranceSets, vessels } = useMapStore.getState();
  const user = sessionUser(persona, organization);
  return assuranceObjectsForSession(
    objectsWithKnownOwners(assuranceObjects, vessels),
    assuranceSets,
    persona,
    user?.organization || organization,
    user,
  );
}

function signIn(persona: UserRolePersona) {
  useMapStore.setState({
    activePersona: persona,
    activeDemoOrganization: ORG,
    activeSessionUserId: undefined,
    isAuthenticated: true,
    currentHashView: 'objects',
    currentEntityId: undefined,
  });
}

describe('assurance objects list', () => {
  beforeEach(() => {
    signIn('Administrator');
  });

  it('shows a count for every object type', () => {
    const rows = visible('Administrator');
    render(<AssuranceObjectsView />);

    ['All', 'Vessels', 'Persons', 'Equipment', 'Organizations', 'Procedures', 'Documents', 'Methods'].forEach(
      (label) => {
        expect(screen.getByRole('tab', { name: new RegExp(label) })).toBeTruthy();
      },
    );

    expect(screen.getByRole('tab', { name: `All (${rows.length})` })).toBeTruthy();
    expect(screen.getByRole('tab', { name: `Vessels (${rows.filter((row) => row.type === 'vessel').length})` })).toBeTruthy();
    expect(screen.getByRole('tab', { name: `Procedures (${rows.filter((row) => row.type === 'procedure').length})` })).toBeTruthy();
    expect(rows.length).toBeGreaterThan(0);
  });

  it('searches by name and identifier', () => {
    signIn('C Admin');
    const rows = visible('C Admin');
    const sample = rows.find((row) => row.identifier);
    expect(sample?.identifier).toBeTruthy();
    render(<AssuranceObjectsView />);

    fireEvent.change(screen.getByPlaceholderText('Search name or identifier...'), {
      target: { value: sample!.identifier },
    });

    const matched = filterAssuranceObjectRows(
      rows.map((object) => ({ object, verificationStatus: '' })),
      { type: 'all', search: sample!.identifier || '', owner: '', verificationStatus: '' },
    );
    expect(screen.getByRole('tab', { name: `All (${matched.length})` })).toBeTruthy();
    expect(screen.getByText(sample!.name)).toBeTruthy();
  });

  it('filters by owner together with the type tabs', () => {
    signIn('C Admin');
    const rows = visible('C Admin');
    const other = rows.find((row) => !row.ownerOrganization.toLowerCase().includes('northwind'));
    expect(other).toBeTruthy();
    render(<AssuranceObjectsView />);

    fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
    fireEvent.change(screen.getByLabelText('Owner'), { target: { value: other!.ownerOrganization } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    const owned = rows.filter((row) => row.ownerOrganization === other!.ownerOrganization);
    expect(screen.getByRole('tab', { name: `All (${owned.length})` })).toBeTruthy();
    expect(screen.getByText(other!.name)).toBeTruthy();
    expect(screen.queryByRole('tab', { name: `All (${rows.length})` })).toBeNull();
  });

  it('scopes the catalogue by role', () => {
    const admin = visible('Administrator');
    const client = visible('C Admin');
    const submitter = visible('Submitter');
    const verifier = visible('Verifier');
    const inspector = visible('Inspector');
    const approver = visible('Approver');

    expect(admin.every((object) => object.ownerOrganization.toLowerCase().includes('northwind'))).toBe(true);
    expect(client.length).toBeGreaterThan(admin.length);
    expect(client.some((object) => !object.ownerOrganization.toLowerCase().includes('northwind'))).toBe(true);
    expect(admin.some((object) => object.type === 'vessel')).toBe(true);
    admin.forEach((object) => expect(client.some((row) => row.id === object.id)).toBe(true));
    expect(submitter.length).toBeGreaterThan(0);
    expect(submitter.length).toBeLessThan(client.length);

    const onAssignedSets = (persona: UserRolePersona) => {
      const { assuranceSets } = useMapStore.getState();
      const user = sessionUser(persona);
      const ids = new Set<string>();
      assuranceSets
        .filter((set) => isAssuranceSetAssignedToPersona(set, persona, user?.organization || ORG, user))
        .forEach((set) => getAssuranceSetObjects(set).forEach((object) => ids.add(object.id)));
      return ids;
    };

    submitter.forEach((object) => expect(onAssignedSets('Submitter').has(object.id)).toBe(true));
    verifier.forEach((object) => expect(onAssignedSets('Verifier').has(object.id)).toBe(true));
    inspector.forEach((object) => expect(onAssignedSets('Inspector').has(object.id)).toBe(true));
    approver.forEach((object) => expect(onAssignedSets('Approver').has(object.id)).toBe(true));
  });

  it('opens the vessel detail from a vessel row', () => {
    render(<AssuranceObjectsView />);
    const vessel = visible('Administrator')
      .filter((object) => object.type === 'vessel')
      .sort((left, right) => left.name.localeCompare(right.name))[0];
    expect(vessel).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: `View ${vessel!.name}` }));
    expect(useMapStore.getState().currentHashView).toBe('vessels');
    expect(useMapStore.getState().currentEntityId).toBe(vessel!.id);
  });

  it('shows the empty state when nothing matches', () => {
    render(<AssuranceObjectsView />);
    fireEvent.change(screen.getByPlaceholderText('Search name or identifier...'), {
      target: { value: 'no-such-object-zzz' },
    });
    expect(screen.getByTestId('empty-state')).toBeTruthy();
    expect(screen.getByText('No matches')).toBeTruthy();
  });
});
