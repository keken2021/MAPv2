import { describe, expect, it, beforeEach } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { UserProfile } from '../types/user';

describe('useMapStore login and setActivePersona fallbacks (Step 5)', () => {
  beforeEach(() => {
    useMapStore.setState({
      isAuthenticated: false,
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: 'USR-101',
    });
  });

  it('login falls back to the first active user holding that role and uses their organization', () => {
    const customUser: UserProfile = {
      id: 'USR-TEST-FALLBACK',
      name: 'Custom Test Role Holder',
      email: 'custom@example.com',
      roles: ['Inspector'],
      organization: 'Austral Classification Society',
      userType: 'Third-Party',
      departmentOrScope: 'Operations',
      lastActive: '2026-11-13 00:00 UTC',
      status: 'Active',
    };

    // Set users with only one inspector who does not match the default session IDs
    useMapStore.setState({
      users: [customUser],
    });

    useMapStore.getState().login('Inspector');

    const state = useMapStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.activePersona).toBe('Inspector');
    expect(state.activeSessionUserId).toBe('USR-TEST-FALLBACK');
    expect(state.activeDemoOrganization).toBe('Austral Classification Society');
  });

  it('setActivePersona falls back to first user holding that role when pickSessionUser finds none', () => {
    const customUser: UserProfile = {
      id: 'USR-TEST-CADMIN',
      name: 'Custom Client Admin',
      email: 'custom.cadmin@example.com',
      roles: ['C Admin'],
      organization: 'Beach Energy Ltd',
      userType: 'Organization',
      departmentOrScope: 'Administration',
      lastActive: '2026-11-13 00:00 UTC',
      status: 'Active',
    };

    useMapStore.setState({
      activeDemoOrganization: 'Beach Energy Ltd',
      activePersona: 'Administrator',
      users: [customUser],
    });

    useMapStore.getState().setActivePersona('C Admin');

    const state = useMapStore.getState();
    expect(state.activePersona).toBe('C Admin');
    expect(state.activeSessionUserId).toBe('USR-TEST-CADMIN');
  });
});

