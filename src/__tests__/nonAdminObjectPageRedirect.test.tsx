/* 
  file summary: tests verifying non-admin roles (Submitter, Verifier, Inspector, Approver) are redirected to dashboard on object URLs.
  responsibilities: asserts that navigating to vessels, equipment, crew, objects, and activities URLs redirects non-admin personas to dashboard while Administrator and Administrator as client keep access.
  role in system: test suite for non-admin object browsing prevention.
*/

import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import App from '../App';
import { useMapStore } from '../store/useMapStore';
import { UserRolePersona } from '../types/audit';

describe('Non-admin object page redirects (Task 5483)', () => {
  beforeEach(() => {
    cleanup();
    window.location.hash = '#/dashboard';
    useMapStore.setState({
      isAuthenticated: true,
      activePersona: 'Submitter',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      currentHashView: 'dashboard',
      currentEntityId: undefined,
    });
  });

  const nonAdminRoles: UserRolePersona[] = ['Submitter', 'Verifier', 'Inspector', 'Approver'];
  const objectViews = ['vessels', 'equipment', 'crew', 'objects', 'activities'];

  nonAdminRoles.forEach((role) => {
    objectViews.forEach((view) => {
      it(`redirects ${role} from #${view} to dashboard`, async () => {
        window.location.hash = `#/${view}`;
        useMapStore.setState({
          isAuthenticated: true,
          activePersona: role,
          activeDemoOrganization: role === 'Submitter' ? 'Northwind Marine Pty Ltd' : 'Bureau Veritas Inspectorate',
          currentHashView: view,
        });

        render(<App />);

        await waitFor(() => {
          const state = useMapStore.getState();
          expect(state.currentHashView).toBe('dashboard');
          expect(window.location.hash).toBe('#/dashboard');
        });
      });
    });
  });

  it('keeps object page access for Administrator and Administrator as client (C Admin)', async () => {
    window.location.hash = '#/vessels';
    useMapStore.setState({
      isAuthenticated: true,
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      currentHashView: 'vessels',
    });

    render(<App />);

    await waitFor(() => {
      expect(useMapStore.getState().currentHashView).toBe('vessels');
    });

    cleanup();

    window.location.hash = '#/vessels';
    useMapStore.setState({
      isAuthenticated: true,
      activePersona: 'C Admin',
      activeDemoOrganization: 'Chevron Australia Pty Ltd',
      currentHashView: 'vessels',
    });

    render(<App />);

    await waitFor(() => {
      expect(useMapStore.getState().currentHashView).toBe('vessels');
    });
  });
});
