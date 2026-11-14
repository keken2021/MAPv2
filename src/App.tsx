/* 
  file summary: root application shell component managing hash routing, top header banner, sidebar navigation, and main view router.
  responsibilities: synchronizes browser window hash location with zustand state and renders active view component with global audit drawer.
  role in system: primary application shell mounted by main.tsx.
*/

import React, { Suspense, useEffect, useMemo } from 'react';
import { useMapStore } from './store/useMapStore';
import { HeaderBanner } from './components/layout/HeaderBanner';
import { AppSidebar } from './components/layout/AppSidebar';
import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { FleetRegistryView } from './views/FleetRegistryView';
import { EquipmentView } from './views/EquipmentView';
import { EquipmentDetailView } from './views/EquipmentDetailView';
import { VesselDetailView } from './views/VesselDetailView';
import { AssuranceSetsView } from './views/AssuranceSetsView';
import { CreateAssuranceSetView } from './views/CreateAssuranceSetView';
import { AssuranceDetailView } from './views/AssuranceDetailView';
import { DocumentLibraryView } from './views/DocumentLibraryView';
import { DocumentDetailView } from './views/DocumentDetailView';
import { VerifierWorkspaceView } from './views/VerifierWorkspaceView';
import { InspectorWorkspaceView } from './views/InspectorWorkspaceView';
import { InspectionChecklistView } from './views/InspectionChecklistView';
import { AuditTrailView } from './views/AuditTrailView';
import { UserManagementView } from './views/UserManagementView';
import { RolesAndPermissionsView } from './views/RolesAndPermissionsView';
import { OrganizationProfileView } from './views/OrganizationProfileView';
import { CrewView } from './views/CrewView';
import { CrewDetailView } from './views/CrewDetailView';
import { CrewGroupDetailView } from './views/CrewGroupDetailView';
import { CapaManagementView } from './views/CapaManagementView';
import { ApproverDashboardView } from './views/ApproverDashboardView';
import { ProjectView } from './views/ProjectView';
import { ProjectDetailView } from './views/ProjectDetailView';
import { CreateProjectView } from './views/CreateProjectView';
import { MarketplaceView } from './views/MarketplaceView';
import { AssuranceObjectsView, canOpenObjectsList } from './views/AssuranceObjectsView';
import { ActivityDetailView } from './views/ActivityDetailView';
import './App.css';

import { AccessDeniedState } from './components/common/AccessDeniedState';
import {
  filterEquipmentForPersona,
  filterVesselsForPersona,
  isAdminReadOnlyWorkView,
  isAssuranceSetAssignedToPersona,
  isProjectOwnerWithoutSubSetGroup,
  isViewAccessibleToPersona,
  orgFieldMatches,
} from './utils/rbacHelpers';
import { isCrewOwnedByOrganization, isProjectAccessibleToUser } from './utils/projectHelpers';
import { getAssuranceSetCrewIds, getAssuranceSetObjects } from './utils/assuranceTemplates';
import { canOpenAssuranceRequestWizard } from './utils/notificationHelpers';
import { getDemoSessionContext, getSessionUserForPersona } from './utils/userRoleHelpers';
import { ENABLE_ROLES_AND_PERMISSIONS } from './config/featureFlags';

/* route-level view loaded on demand */
const NotificationsView = React.lazy(() => import('./views/NotificationsView'));

/**
  what: renders the root application shell and handles window hash change navigation or login page.
  how: checks isAuthenticated state from store and parses window.location.hash string to update store currentHashView.
  with what file: src/App.tsx mounted by src/main.tsx.
*/
export const App: React.FC = () => {
  const {
    currentHashView,
    currentEntityId,
    setCurrentHashView,
    isAuthenticated,
    activePersona,
    activeDemoOrganization,
    activeSessionUserId,
    rolePermissionDefaults,
    userPermissionOverrides,
    users,
    notifications,
    assuranceSets,
    projects,
    vessels,
    equipment,
    crew,
    assuranceObjects,
    pendingAssuranceRequestNotificationId,
    setPendingAssuranceRequestNotificationId,
    raiseDocumentRenewalNotifications,
  } = useMapStore();

  /* no scheduler in the prototype: documents are checked for renewal once the user is signed in */
  useEffect(() => {
    if (isAuthenticated) raiseDocumentRenewalNotifications();
  }, [isAuthenticated, raiseDocumentRenewalNotifications]);

  useEffect(() => {
    /* parse initial hash route on mount or enforce login view on reload */
    const parseHash = () => {
      if (!isAuthenticated) {
        window.location.hash = '#/login';
        setCurrentHashView('login');
        return;
      }

      const hash = window.location.hash.replace(/^#\/?/, '');
      if (hash && hash !== 'login') {
        const pathPart = hash.split('?')[0];
        const parts = pathPart.split('/');
        const newView = parts[0];
        const newEntityId = parts[1] ? decodeURIComponent(parts[1]) : undefined;
        const state = useMapStore.getState();
        const isNonAdminRole = state.activePersona !== 'Administrator' && state.activePersona !== 'C Admin';
        if (isNonAdminRole && ['vessels', 'equipment', 'crew', 'objects', 'activities'].includes(newView)) {
          window.location.hash = '#/dashboard';
          if (state.currentHashView !== 'dashboard') {
            setCurrentHashView('dashboard');
          }
          return;
        }
        if (state.currentHashView !== newView || state.currentEntityId !== newEntityId) {
          setCurrentHashView(newView, newEntityId);
        }
      } else {
        const state = useMapStore.getState();
        if (state.currentHashView !== 'dashboard') {
          setCurrentHashView('dashboard');
        }
      }
    };

    parseHash();

    const handleHashChange = () => parseHash();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isAuthenticated, setCurrentHashView]);

  const routeAllowed = useMemo(() => {
    if (!isAuthenticated || currentHashView === 'login') return true;

    const demoContext = getDemoSessionContext({
      activeDemoOrganization,
      activeSessionUserId,
    });
    const matchingUser = getSessionUserForPersona(activePersona, users, demoContext) ?? null;

    /* roles-permissions is persona-gated (Administrator settings); skip matrix revoke on blank role_rights */
    /* organization-profile is Settings: any signed-in persona may open; the view itself gates edit to Administrator */
    const allowedByRole =
      currentHashView === 'objects' || currentHashView === 'activities'
        ? canOpenObjectsList(activePersona)
        : currentHashView === 'roles-permissions'
        ? isViewAccessibleToPersona(currentHashView, currentEntityId, activePersona)
        : currentHashView === 'organization-profile'
        ? true
        : isViewAccessibleToPersona(
          currentHashView,
          currentEntityId,
          activePersona,
          ENABLE_ROLES_AND_PERMISSIONS ? rolePermissionDefaults : undefined,
          ENABLE_ROLES_AND_PERMISSIONS ? userPermissionOverrides : undefined,
          matchingUser,
        );

    /* the user an assurance set request is assigned to may open the wizard for that request only */
    const requestNotification = notifications.find((n) => n.id === pendingAssuranceRequestNotificationId);
    const allowedByRequest =
      currentHashView === 'create-assurance-set' &&
      canOpenAssuranceRequestWizard(requestNotification, matchingUser);

    if (!allowedByRole && !allowedByRequest) return false;
    if (!matchingUser) return false;

    const effectiveOrg = activeDemoOrganization || matchingUser.organization || '';

    if (currentHashView === 'assurance-sets' && currentEntityId) {
      const targetSet = assuranceSets.find((s) => s.id === currentEntityId);
      if (targetSet) {
        if (!isAssuranceSetAssignedToPersona(targetSet, activePersona, effectiveOrg, matchingUser, users)) {
          return false;
        }
        const linkedProject = targetSet.projectId
          ? projects.find((p) => p.id === targetSet.projectId)
          : undefined;
        if (linkedProject && isProjectOwnerWithoutSubSetGroup(targetSet, linkedProject, effectiveOrg, matchingUser)) {
          return false;
        }
      }
    }

    if (currentHashView === 'project' && currentEntityId) {
      if (currentEntityId === 'new') {
        return activePersona === 'Administrator' || activePersona === 'C Admin';
      }
      const targetProject = projects.find((p) => p.id === currentEntityId);
      if (
        targetProject &&
        !isProjectAccessibleToUser(
          targetProject,
          activePersona,
          users,
          assuranceSets,
          effectiveOrg,
          matchingUser,
          notifications,
        )
      ) {
        return false;
      }
    }

    if (currentHashView === 'approver' && currentEntityId) {
      const targetSet = assuranceSets.find((s) => s.id === currentEntityId);
      if (
        targetSet &&
        !isAssuranceSetAssignedToPersona(targetSet, activePersona, effectiveOrg, matchingUser, users)
      ) {
        return false;
      }
    }

    if ((currentHashView === 'inspector' || currentHashView === 'inspection') && currentEntityId) {
      const decoded = decodeURIComponent(currentEntityId);
      const matchingSets = assuranceSets.filter(
        (s) => s.id === decoded || s.vesselId === decoded || s.vesselName === decoded,
      );
      const isReadOnlyAdmin = isAdminReadOnlyWorkView(currentHashView, activePersona);
      if (matchingSets.length > 0) {
        const hasAccessibleInspectionSet = matchingSets.some(
          (s) =>
            (isReadOnlyAdmin || (activePersona === 'Inspector' && Boolean(s.mandatoryInspectionRequired))) &&
            isAssuranceSetAssignedToPersona(s, activePersona, effectiveOrg, matchingUser, users),
        );
        if (!hasAccessibleInspectionSet) return false;
      } else if (!isReadOnlyAdmin && activePersona !== 'Inspector') {
        return false;
      }
    }

    if (currentHashView === 'create-assurance-set' && currentEntityId && !allowedByRequest) {
      const templateSet = assuranceSets.find((s) => s.id === currentEntityId);
      if (
        templateSet &&
        !isAssuranceSetAssignedToPersona(templateSet, activePersona, effectiveOrg, matchingUser, users)
      ) {
        return false;
      }
    }

    if (currentHashView === 'documents' && currentEntityId) {
      const docSets = assuranceSets.filter((s) =>
        s.requirements.some((r) => r.documentId === currentEntityId || r.linkedDocumentId === currentEntityId),
      );
      if (docSets.length > 0) {
        const hasAssignedSetForDoc = docSets.some((s) =>
          isAssuranceSetAssignedToPersona(s, activePersona, effectiveOrg, matchingUser, users),
        );
        if (!hasAssignedSetForDoc) return false;
      }
    }

    if (currentHashView === 'activities' && currentEntityId) {
      const activity = assuranceObjects.find((obj) => obj.id === currentEntityId && obj.type === 'activity');
      if (activity) {
        const ownsActivity =
          (activePersona === 'Administrator' || activePersona === 'C Admin') &&
          Boolean(effectiveOrg && activity.ownerOrganization && orgFieldMatches(effectiveOrg, activity.ownerOrganization));
        const hasAssignedSetForActivity = assuranceSets.some(
          (s) =>
            getAssuranceSetObjects(s).some((obj) => obj.id === activity.id) &&
            isAssuranceSetAssignedToPersona(s, activePersona, effectiveOrg, matchingUser, users),
        );
        if (!ownsActivity && !hasAssignedSetForActivity) return false;
      }
    }

    if (currentHashView === 'vessels' && currentEntityId) {
      const vesselExists = vessels.some((v) => v.id === currentEntityId);
      if (
        vesselExists &&
        !filterVesselsForPersona(vessels, assuranceSets, activePersona, effectiveOrg, matchingUser).some(
          (v) => v.id === currentEntityId,
        )
      ) {
        return false;
      }
    }

    if (currentHashView === 'equipment' && currentEntityId) {
      const eqExists = equipment.some((e) => e.id === currentEntityId);
      if (
        eqExists &&
        !filterEquipmentForPersona(equipment, vessels, assuranceSets, activePersona, effectiveOrg, matchingUser).some(
          (e) => e.id === currentEntityId,
        )
      ) {
        return false;
      }
    }

    if (currentHashView === 'crew' && currentEntityId) {
      const crewRecord = crew.find((c) => c.id === currentEntityId);
      if (crewRecord) {
        const ownsCrew =
          (activePersona === 'Administrator' || activePersona === 'Submitter') &&
          Boolean(effectiveOrg && isCrewOwnedByOrganization(crewRecord, effectiveOrg));
        const hasAssignedSetForCrew = assuranceSets.some(
          (s) =>
            getAssuranceSetCrewIds(s).includes(crewRecord.id) &&
            isAssuranceSetAssignedToPersona(s, activePersona, effectiveOrg, matchingUser, users),
        );
        if (!ownsCrew && !hasAssignedSetForCrew) return false;
      }
    }

    return true;
  }, [
    activePersona,
    activeDemoOrganization,
    activeSessionUserId,
    currentHashView,
    currentEntityId,
    isAuthenticated,
    rolePermissionDefaults,
    userPermissionOverrides,
    users,
    notifications,
    assuranceSets,
    projects,
    vessels,
    equipment,
    crew,
    assuranceObjects,
    pendingAssuranceRequestNotificationId,
  ]);

  useEffect(() => {
    const isNonAdminRole = activePersona !== 'Administrator' && activePersona !== 'C Admin';
    const isObjectView =
      currentHashView === 'vessels' ||
      currentHashView === 'equipment' ||
      currentHashView === 'crew' ||
      currentHashView === 'objects' ||
      currentHashView === 'activities';

    if (isNonAdminRole && isObjectView) {
      window.location.hash = '#/dashboard';
      setCurrentHashView('dashboard');
      return;
    }

    if (currentHashView === 'objects' && currentEntityId !== 'activity') {
      setCurrentHashView('vessels');
    }
  }, [activePersona, currentHashView, currentEntityId, setCurrentHashView]);

    /* a request only grants wizard access while the wizard is open; leaving it ends the grant */
  useEffect(() => {
    if (currentHashView !== 'create-assurance-set' && pendingAssuranceRequestNotificationId) {
      setPendingAssuranceRequestNotificationId(undefined);
    }
  }, [
    currentHashView,
    pendingAssuranceRequestNotificationId,
    setPendingAssuranceRequestNotificationId,
  ]);

  /* render login view if user is unauthenticated or on login view */
  if (!isAuthenticated || currentHashView === 'login') {
    return <LoginView />;
  }

  /* view router lookup */
  const renderCurrentView = () => {
    if (!routeAllowed) {
      return <AccessDeniedState onBack={() => setCurrentHashView('dashboard')} />;
    }

    switch (currentHashView) {
      case 'objects':
        if (currentEntityId === 'activity') {
          return <AssuranceObjectsView />;
        }
        return <FleetRegistryView />;
      case 'activities':
        return currentEntityId ? <ActivityDetailView activityId={currentEntityId} /> : <AssuranceObjectsView />;
      case 'vessels':
        return currentEntityId ? <VesselDetailView vesselId={currentEntityId} /> : <FleetRegistryView />;
      case 'equipment':
        return currentEntityId ? <EquipmentDetailView equipmentId={currentEntityId} /> : <EquipmentView />;
      case 'project':
        if (currentEntityId === 'new') return <CreateProjectView />;
        return currentEntityId ? <ProjectDetailView projectId={currentEntityId} /> : <ProjectView />;
      case 'marketplace':
        return <MarketplaceView />;
      case 'notifications':
        return (
          <Suspense
            fallback={
              <div className="map-view-skeleton" role="status" aria-busy="true">
                <span className="visually-hidden">Loading notifications</span>
              </div>
            }
          >
            <NotificationsView />
          </Suspense>
        );
      case 'assurance-sets':
        return currentEntityId ? <AssuranceDetailView setId={currentEntityId} /> : <AssuranceSetsView />;
      case 'create-assurance-set':
        return <CreateAssuranceSetView templateSetId={currentEntityId} />;
      case 'documents':
        return currentEntityId ? <DocumentDetailView documentId={currentEntityId} /> : <DocumentLibraryView />;
      case 'verifier':
        return <VerifierWorkspaceView />;
      case 'approver':
        return <ApproverDashboardView />;
      case 'inspection':
      case 'inspector':
        return currentEntityId ? <InspectionChecklistView vesselName={currentEntityId} /> : <InspectorWorkspaceView />;
      case 'capa':
      case 'capas':
        return <CapaManagementView vesselName={currentEntityId} />;
      case 'audit':
        return <AuditTrailView />;
      case 'users':
        return <UserManagementView />;
      case 'roles-permissions':
        return ENABLE_ROLES_AND_PERMISSIONS ? (
          <RolesAndPermissionsView />
        ) : (
          <DashboardView />
        );
      case 'organization-profile':
        return <OrganizationProfileView />;
      case 'crew-group':
      case 'crew-groups':
        return currentEntityId ? <CrewGroupDetailView groupId={currentEntityId} /> : <CrewView />;
      case 'crew':
        return currentEntityId ? <CrewDetailView crewId={currentEntityId} /> : <CrewView />;
      case 'dashboard':
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="map-app-shell">
      {/* 100vh sidepanel on the left */}
      <AppSidebar />

      {/* right column container with header banner at top and scrollable main content area */}
      <div className="map-right-column">
        <HeaderBanner />
        <main className="map-content-area">{renderCurrentView()}</main>
      </div>

    </div>
  );
};

export default App;
