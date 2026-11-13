import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MOCK_USERS } from '../store/mockData';
import { OIL_CO_PILOT_USERS } from '../store/oilCoLngPilotMockData';
import { useMapStore } from '../store/useMapStore';
import { findOtherSingleRoleHolder, getSessionUserForPersona } from '../utils/userRoleHelpers';
import { UserModal } from '../components/modals/UserModal';
import { UserProfile } from '../types/user';

describe('Single active Administrator and C Admin per organization', () => {
  it('ensures seed data has at most one active Administrator and one active C Admin per organization', () => {
    // Deduplicate any shared records between MOCK_USERS and OIL_CO_PILOT_USERS by user ID
    const userMap = new Map<string, UserProfile>();
    for (const u of [...MOCK_USERS, ...OIL_CO_PILOT_USERS]) {
      userMap.set(u.id, u);
    }
    const allUsers = Array.from(userMap.values());

    const activeUsersByOrg = new Map<string, UserProfile[]>();
    for (const user of allUsers) {
      if (user.status !== 'Active') continue;
      const org = user.organization?.trim();
      if (!org) continue;
      const existing = activeUsersByOrg.get(org) ?? [];
      existing.push(user);
      activeUsersByOrg.set(org, existing);
    }

    for (const [org, orgUsers] of activeUsersByOrg.entries()) {
      const activeAdmins = orgUsers.filter((u) => u.roles.includes('Administrator'));
      expect(
        activeAdmins.length,
        `Expected at most 1 active Administrator in ${org}, but found ${activeAdmins.map((u) => u.name).join(', ')}`,
      ).toBeLessThanOrEqual(1);

      const activeCAdmins = orgUsers.filter((u) => u.roles.includes('C Admin'));
      expect(
        activeCAdmins.length,
        `Expected at most 1 active C Admin in ${org}, but found ${activeCAdmins.map((u) => u.name).join(', ')}`,
      ).toBeLessThanOrEqual(1);
    }

    // Specifically verify E. Rostova (USR-104) is Verifier only
    const rostova = allUsers.find((u) => u.id === 'USR-104');
    expect(rostova).toBeDefined();
    expect(rostova?.name).toBe('E. Rostova');
    expect(rostova?.roles).toEqual(['Verifier']);
    expect(rostova?.organization).toBe('Northwind Marine Pty Ltd');
    expect(rostova?.status).toBe('Active');

    // Northwind Marine Pty Ltd has K. Osei as its sole active Administrator
    const northwindAdmins = (activeUsersByOrg.get('Northwind Marine Pty Ltd') ?? []).filter((u) =>
      u.roles.includes('Administrator'),
    );
    expect(northwindAdmins).toHaveLength(1);
    expect(northwindAdmins[0].id).toBe('USR-101');
    expect(northwindAdmins[0].name).toBe('K. Osei');
  });

  describe('findOtherSingleRoleHolder helper', () => {
    const testUsers: UserProfile[] = [
      {
        id: 'U1',
        name: 'Alice Admin',
        email: 'alice@alpha.example',
        roles: ['Administrator'],
        userType: 'Organization',
        organization: 'Alpha Marine Ltd',
        departmentOrScope: 'Operations',
        status: 'Active',
        lastActive: 'Just Now',
      },
      {
        id: 'U2',
        name: 'Bob Inactive Admin',
        email: 'bob@alpha.example',
        roles: ['Administrator'],
        userType: 'Organization',
        organization: 'Alpha Marine Ltd',
        departmentOrScope: 'Operations',
        status: 'Inactive',
        lastActive: '1 day ago',
      },
      {
        id: 'U3',
        name: 'Charlie CAdmin',
        email: 'charlie@alpha.example',
        roles: ['C Admin'],
        userType: 'Organization',
        organization: 'Alpha Marine Ltd',
        departmentOrScope: 'Management',
        status: 'Active',
        lastActive: 'Just Now',
      },
      {
        id: 'U4',
        name: 'Diana Other Org Admin',
        email: 'diana@beta.example',
        roles: ['Administrator'],
        userType: 'Organization',
        organization: 'Beta Services',
        departmentOrScope: 'Management',
        status: 'Active',
        lastActive: 'Just Now',
      },
      {
        id: 'U5',
        name: 'Evan Pending CAdmin',
        email: 'evan@alpha.example',
        roles: ['C Admin'],
        userType: 'Organization',
        organization: 'Alpha Marine Ltd',
        departmentOrScope: 'Operations',
        status: 'Pending Invitation',
        lastActive: 'Invitation Sent',
      },
    ];

    it('finds the other active role holder in the same organization', () => {
      const foundAdmin = findOtherSingleRoleHolder(testUsers, 'Alpha Marine Ltd', 'Administrator');
      expect(foundAdmin?.id).toBe('U1');
      expect(foundAdmin?.name).toBe('Alice Admin');

      const foundCAdmin = findOtherSingleRoleHolder(testUsers, 'Alpha Marine Ltd', 'C Admin');
      expect(foundCAdmin?.id).toBe('U3');
      expect(foundCAdmin?.name).toBe('Charlie CAdmin');
    });

    it('ignores inactive and pending invitation users', () => {
      const usersWithoutActive: UserProfile[] = [
        testUsers[1], // Inactive Administrator
        testUsers[4], // Pending Invitation C Admin
      ];
      expect(findOtherSingleRoleHolder(usersWithoutActive, 'Alpha Marine Ltd', 'Administrator')).toBeUndefined();
      expect(findOtherSingleRoleHolder(usersWithoutActive, 'Alpha Marine Ltd', 'C Admin')).toBeUndefined();
    });

    it('ignores excludeUserId matching the role holder', () => {
      // Exclude U1: should return undefined since U2 is inactive
      const result = findOtherSingleRoleHolder(testUsers, 'Alpha Marine Ltd', 'Administrator', 'U1');
      expect(result).toBeUndefined();

      // Exclude another user: U1 is still found
      const result2 = findOtherSingleRoleHolder(testUsers, 'Alpha Marine Ltd', 'Administrator', 'U99');
      expect(result2?.id).toBe('U1');
    });

    it('matches organization case-insensitively and ignores extra whitespace', () => {
      const found = findOtherSingleRoleHolder(testUsers, '  alpha marine ltd  ', 'Administrator');
      expect(found?.id).toBe('U1');
    });

    it('returns undefined when organization is missing or has no active role holder', () => {
      expect(findOtherSingleRoleHolder(testUsers, undefined, 'Administrator')).toBeUndefined();
      expect(findOtherSingleRoleHolder(testUsers, '', 'Administrator')).toBeUndefined();
      expect(findOtherSingleRoleHolder(testUsers, 'Nonexistent Org', 'Administrator')).toBeUndefined();
    });
  });

  describe('UserModal duplicate Administrator / C Admin guard', () => {
    beforeEach(() => {
      useMapStore.setState({
        activePersona: 'Administrator',
        activeDemoOrganization: 'Northwind Marine Pty Ltd',
      });
    });

    it('blocks adding a second Northwind Administrator, shows error, and saves nothing', () => {
      const initialUsersCount = useMapStore.getState().users.length;
      const onClose = vi.fn();

      render(React.createElement(UserModal, { isOpen: true, onClose, mode: 'add' }));

      // Select Organization Member (Northwind Marine Pty Ltd)
      fireEvent.click(screen.getByLabelText(/Organization Member/));

      // Enter Name and Email
      fireEvent.change(screen.getByPlaceholderText('e.g. Captain H. Vance'), {
        target: { value: 'New Candidate' },
      });
      fireEvent.change(screen.getByPlaceholderText('name@organization.com'), {
        target: { value: 'candidate@northwindmarine.com' },
      });

      // Tick Platform Access (Administrator)
      const adminCheckbox = document.getElementById('role-platform-admin');
      expect(adminCheckbox).toBeInTheDocument();
      fireEvent.click(adminCheckbox!);

      // Submit the form
      const submitButton = screen.getByRole('button', { name: /Provision User Profile/i });
      fireEvent.click(submitButton);

      // Error message is displayed naming the existing Administrator
      expect(
        screen.getByText('Northwind Marine Pty Ltd already has an Administrator: K. Osei. Choose another role.'),
      ).toBeInTheDocument();

      // Modal was not closed and no user was added
      expect(onClose).not.toHaveBeenCalled();
      expect(useMapStore.getState().users.length).toBe(initialUsersCount);
    });

    it('blocks setting an inactive user back to Active if the role is Administrator and another active holder exists', () => {
      const inactiveUser: UserProfile = {
        id: 'USR-TEMP-INACTIVE',
        name: 'Inactive Former Admin',
        email: 'former.admin@northwindmarine.com',
        roles: ['Administrator'],
        userType: 'Organization',
        organization: 'Northwind Marine Pty Ltd',
        departmentOrScope: 'Administration',
        status: 'Inactive',
        lastActive: '2 days ago',
      };

      const onClose = vi.fn();
      render(React.createElement(UserModal, { isOpen: true, onClose, mode: 'edit', user: inactiveUser }));

      // Set status back to Active
      const statusSelect = document.getElementById('edit-user-status') as HTMLSelectElement;
      expect(statusSelect).toBeInTheDocument();
      fireEvent.change(statusSelect, { target: { value: 'Active' } });

      // Click Save
      const saveButton = screen.getByRole('button', { name: 'Save' });
      fireEvent.click(saveButton);

      // Error message is displayed
      expect(
        screen.getByText('Northwind Marine Pty Ltd already has an Administrator: K. Osei. Choose another role.'),
      ).toBeInTheDocument();

      // Modal was not closed
      expect(onClose).not.toHaveBeenCalled();
    });

    it('allows editing the existing Administrator themself without blocking', () => {
      const activeAdmin = useMapStore.getState().users.find((u) => u.id === 'USR-101')!;
      expect(activeAdmin).toBeDefined();

      const onClose = vi.fn();
      render(React.createElement(UserModal, { isOpen: true, onClose, mode: 'edit', user: activeAdmin }));

      // Change department
      const deptInput = document.getElementById('edit-user-scope') as HTMLInputElement;
      expect(deptInput).toBeInTheDocument();
      fireEvent.change(deptInput, { target: { value: 'Updated IT Governance Scope' } });

      // Click Save
      const saveButton = screen.getByRole('button', { name: 'Save' });
      fireEvent.click(saveButton);

      // Modal closes successfully with no error
      expect(onClose).toHaveBeenCalled();
      const updated = useMapStore.getState().users.find((u) => u.id === 'USR-101')!;
      expect(updated.departmentOrScope).toBe('Updated IT Governance Scope');
    });

    it('resolves E. Rostova as active Verifier when selected for Northwind Marine Pty Ltd', () => {
      const users = useMapStore.getState().users;
      const sessionUser = getSessionUserForPersona('Verifier', users, {
        organization: 'Northwind Marine Pty Ltd',
        sessionUserId: 'USR-104',
      });
      expect(sessionUser).toBeDefined();
      expect(sessionUser?.id).toBe('USR-104');
      expect(sessionUser?.name).toBe('E. Rostova');
      expect(sessionUser?.roles).toEqual(['Verifier']);
      expect(sessionUser?.organization).toBe('Northwind Marine Pty Ltd');
    });
  });
});
