import { useMemo } from 'react';
import { useMapStore } from '../store/useMapStore';
import { UserProfile } from '../types/user';
import { getDemoSessionContext, getSessionUserForPersona } from './userRoleHelpers';
import { pickSessionUserForOrgPersona } from './demoSessionHelpers';

/** Returns the active demo session user for the current persona and organization. */
export function useSessionUser(): UserProfile | null {
  const { activePersona, activeDemoOrganization, activeSessionUserId, users } = useMapStore();

  return useMemo(() => {
    const demoContext = getDemoSessionContext({
      activeDemoOrganization,
      activeSessionUserId,
    });

    return (
      getSessionUserForPersona(activePersona, users, demoContext) ??
      pickSessionUserForOrgPersona(users, activeDemoOrganization, activePersona) ??
      users.find((u) => u.roles.includes(activePersona)) ??
      null
    );
  }, [activePersona, activeDemoOrganization, activeSessionUserId, users]);
}
