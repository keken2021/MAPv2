import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { App } from '../App';
import { useMapStore } from '../store/useMapStore';
import { UserRolePersona } from '../types/audit';

const openAs = (persona: UserRolePersona, view: string, organization: string, userId: string) => {
  window.location.hash = `#/${view}`;
  useMapStore.setState({
    isAuthenticated: true,
    activePersona: persona,
    activeDemoOrganization: organization,
    activeSessionUserId: userId,
    currentHashView: view,
    currentEntityId: undefined,
  });
  render(<App />);
};

describe('access denied state', () => {
  beforeEach(() => {
    window.location.hash = '#/dashboard';
  });

  it('keeps a blocked verifier route and shows none of the vessel list', () => {
    openAs('Verifier', 'vessels', 'Bureau Veritas Inspectorate', 'USR-202');

    expect(screen.getByRole('heading', { name: "You don't have access to this page" })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back to Dashboard' })).toBeTruthy();
    expect(window.location.hash).toBe('#/vessels');
    expect(screen.queryByRole('columnheader', { name: /imo number/i })).toBeNull();
  });

  it('returns to the dashboard from the access denied state', () => {
    openAs('Verifier', 'vessels', 'Bureau Veritas Inspectorate', 'USR-202');

    fireEvent.click(screen.getByRole('button', { name: 'Back to Dashboard' }));

    expect(window.location.hash).toBe('#/dashboard');
    expect(screen.queryByRole('heading', { name: "You don't have access to this page" })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeTruthy();
  });

  it('still opens a route the role is allowed to see', () => {
    openAs('Verifier', 'audit', 'Bureau Veritas Inspectorate', 'USR-202');

    expect(screen.queryByRole('heading', { name: "You don't have access to this page" })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Audit Trail' })).toBeTruthy();
    expect(window.location.hash).toBe('#/audit');
  });
});
