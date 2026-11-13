/*
  file summary: tests for the sidebar "Viewing as" menu, getSessionUsersForOrgPersona helper, and setActiveSessionUser store action.
  responsibilities: verifies helper filtering for Northwind Submitter/Inspector, store session user switching and invalid user ignoring, and sidebar menu mounting and rendering.
  role in system: test suite for Viewing as user switcher feature.
*/

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { getSessionUsersForOrgPersona } from '../utils/userRoleHelpers';
import { useMapStore } from '../store/useMapStore';
import { MOCK_USERS } from '../store/mockData';
import { AppSidebar } from '../components/layout/AppSidebar';
import { SidebarViewingAsMenu } from '../components/layout/SidebarViewingAsMenu';

describe('Viewing as user switcher', () => {
  beforeEach(() => {
    useMapStore.setState({
      isAuthenticated: true,
      activePersona: 'Submitter',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: 'USR-102',
      currentHashView: 'dashboard',
      users: MOCK_USERS,
    });
  });

  describe('getSessionUsersForOrgPersona helper', () => {
    it('Northwind Submitter = M. Chen, J. Vance, not Simon Peter', () => {
      const submitters = getSessionUsersForOrgPersona(
        MOCK_USERS,
        'Northwind Marine Pty Ltd',
        'Submitter',
      );
      const names = submitters.map((u) => u.name);
      expect(names).toEqual(['M. Chen', 'J. Vance']);
      expect(names).not.toContain('Simon Peter');
      expect(submitters.every((u) => u.status === 'Active')).toBe(true);
    });

    it('Inspector = S. Girard only', () => {
      const inspectors = getSessionUsersForOrgPersona(
        MOCK_USERS,
        'Northwind Marine Pty Ltd',
        'Inspector',
      );
      const names = inspectors.map((u) => u.name);
      expect(names).toEqual(['S. Girard']);
      expect(inspectors[0].id).toBe('USR-250');
      expect(inspectors[0].status).toBe('Active');
    });
  });

  describe('useMapStore.setActiveSessionUser', () => {
    it('setActiveSessionUser("USR-103") as Submitter keeps role', () => {
      const { setActiveSessionUser } = useMapStore.getState();
      act(() => {
        setActiveSessionUser('USR-103');
      });

      const state = useMapStore.getState();
      expect(state.activePersona).toBe('Submitter');
      expect(state.activeSessionUserId).toBe('USR-103');
    });

    it('user without role ignored', () => {
      const { setActiveSessionUser } = useMapStore.getState();
      // USR-204 is P. Nardelli (Approver in Marine Assurance Authority)
      act(() => {
        setActiveSessionUser('USR-204');
      });

      const state = useMapStore.getState();
      expect(state.activePersona).toBe('Submitter');
      expect(state.activeSessionUserId).toBe('USR-102');

      // Also non-existent ID is ignored
      act(() => {
        setActiveSessionUser('NON_EXISTENT_USER');
      });
      expect(useMapStore.getState().activeSessionUserId).toBe('USR-102');
    });
  });

  describe('AppSidebar Viewing as menu', () => {
    it('Submitter shows two people and no other roles', () => {
      render(<AppSidebar />);

      // Find user card trigger
      const trigger = screen.getByText('M. Chen');
      fireEvent.click(trigger);

      expect(screen.getByText('Viewing as')).toBeInTheDocument();
      // M. Chen is in both the footer user card and the Viewing as menu
      expect(screen.getAllByText('M. Chen')).toHaveLength(2);
      expect(screen.getByText('J. Vance')).toBeInTheDocument();

      // Ensure other roles are not listed as choices
      expect(screen.queryByText('Client Admin')).toBeNull();
      expect(screen.queryByText('Vessel Admin')).toBeNull();
      expect(screen.queryByText('Approver')).toBeNull();
      expect(screen.queryByText('Simon Peter')).toBeNull();

      // Current user shows Active badge
      expect(screen.getByText('Active')).toBeInTheDocument();

      // Switching user calls setActiveSessionUser and changes active user
      fireEvent.click(screen.getByRole('button', { name: /J\. Vance/i }));
      expect(useMapStore.getState().activeSessionUserId).toBe('USR-103');
      expect(useMapStore.getState().activePersona).toBe('Submitter');
    });

    it('still opens with one person when persona has single user', () => {
      act(() => {
        useMapStore.setState({
          activePersona: 'Inspector',
          activeSessionUserId: 'USR-250',
        });
      });

      render(<SidebarViewingAsMenu />);
      expect(screen.getByText('Viewing as')).toBeInTheDocument();
      expect(screen.getByText('S. Girard')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.queryByText('M. Chen')).toBeNull();
      expect(screen.queryByText('J. Vance')).toBeNull();
    });
  });
});
