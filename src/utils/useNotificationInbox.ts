/*
  file summary: react hook exposing the signed-in user's notification inbox and its row actions.
  responsibilities: resolves the session user, filters notifications to that recipient, resolves each row action and runs it against the store.
  role in system: shared by NotificationPanel.tsx (header bell) and NotificationsView.tsx so both behave identically.
*/

import { useCallback, useMemo } from 'react';
import { useMapStore } from '../store/useMapStore';
import { ENABLE_ROLES_AND_PERMISSIONS } from '../config/featureFlags';
import { AppNotification } from '../types/notification';
import { UserProfile } from '../types/user';
import {
  NotificationAction,
  countUnread,
  filterNotificationsForUser,
  getNotificationAction,
} from './notificationHelpers';
import { isViewAccessibleToPersona } from './rbacHelpers';
import { getDemoSessionContext, getSessionUserForPersona } from './userRoleHelpers';

export interface NotificationInbox {
  sessionUser?: UserProfile;
  /** notifications addressed to the session user, newest first */
  inbox: AppNotification[];
  unreadCount: number;
  getAction: (notification: AppNotification) => NotificationAction;
  runAction: (notification: AppNotification) => void;
}

/**
  what: inbox state and actions for the user the active persona is signed in as; takes no input.
  how: reads the store, keeps only notifications whose recipient is the session user, and maps each to its row action; runAction records the open and navigates, or hands an assurance set request to the creation wizard.
  with what file: src/utils/useNotificationInbox.ts used by NotificationPanel.tsx and NotificationsView.tsx; relies on notificationHelpers.ts and useMapStore.ts.
*/
export function useNotificationInbox(): NotificationInbox {
  const {
    notifications,
    users,
    activePersona,
    activeDemoOrganization,
    activeSessionUserId,
    assuranceSets,
    documents,
    capaItems,
    projects,
    rolePermissionDefaults,
    userPermissionOverrides,
    openNotification,
    markNotificationRead,
    setReturnToProjectId,
    setLockedProjectId,
    setPendingAssuranceRequestNotificationId,
    setCurrentHashView,
  } = useMapStore();

  const sessionUser = useMemo(
    () =>
      getSessionUserForPersona(
        activePersona,
        users,
        getDemoSessionContext({ activeDemoOrganization, activeSessionUserId }),
      ),
    [activePersona, activeDemoOrganization, activeSessionUserId, users],
  );

  const inbox = useMemo(
    () => filterNotificationsForUser(notifications, sessionUser?.id),
    [notifications, sessionUser],
  );

  const getAction = useCallback(
    (notification: AppNotification) => {
      /* same user the route guard in App.tsx evaluates matrix overrides for */
      const matrixUser = users.find((u) => u.roles.includes(activePersona)) ?? null;
      return getNotificationAction(notification, {
        assuranceSets,
        documents,
        capaItems,
        projects,
        canAccessView: (view, entityId) =>
          isViewAccessibleToPersona(
            view,
            entityId,
            activePersona,
            ENABLE_ROLES_AND_PERMISSIONS ? rolePermissionDefaults : undefined,
            ENABLE_ROLES_AND_PERMISSIONS ? userPermissionOverrides : undefined,
            matrixUser,
          ),
      });
    },
    [
      users,
      activePersona,
      assuranceSets,
      documents,
      capaItems,
      projects,
      rolePermissionDefaults,
      userPermissionOverrides,
    ],
  );

  const runAction = useCallback(
    (notification: AppNotification) => {
      const action = getAction(notification);
      if (action.disabledReason) return;

      if (action.opensRequestWizard) {
        /* the wizard reads the request to lock the project, client and creator */
        markNotificationRead(notification.id);
        setReturnToProjectId(notification.projectId);
        setLockedProjectId(notification.projectId);
        setPendingAssuranceRequestNotificationId(notification.id);
        setCurrentHashView('create-assurance-set');
        return;
      }

      openNotification(notification.id);
      setCurrentHashView(action.view, action.entityId);
    },
    [
      getAction,
      markNotificationRead,
      openNotification,
      setReturnToProjectId,
      setLockedProjectId,
      setPendingAssuranceRequestNotificationId,
      setCurrentHashView,
    ],
  );

  return {
    sessionUser,
    inbox,
    unreadCount: countUnread(inbox),
    getAction,
    runAction,
  };
}
