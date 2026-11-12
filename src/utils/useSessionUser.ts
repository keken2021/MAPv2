import { useMemo } from 'react';
import { useMapStore } from '../store/useMapStore';
import { UserProfile } from '../types/user';
import { getDemoSessionContext, getSessionUserForPersona } from './userRoleHelpers';

/** Returns the active demo session user for the current persona and organization, failing closed when unmatched. */
export function useSessionUser(): UserProfile | null {
  const { activePersona, activeDemoOrganization, activeSessionUserId, users } = useMapStore();

  return useMemo(() => {
    const demoContext = getDemoSessionContext({
      activeDemoOrganization,
      activeSessionUserId,
    });

    return getSessionUserForPersona(activePersona, users, demoContext) ?? null;
  }, [activePersona, activeDemoOrganization, activeSessionUserId, users]);
}
