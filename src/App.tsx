/* 
  file summary: root application shell component managing hash routing, top header banner, sidebar navigation, and main view router.
  responsibilities: synchronizes browser window hash location with zustand state and renders active view component with global audit drawer.
  role in system: primary application shell mounted by main.tsx.
*/

import React, { Suspense, useEffect } from 'react';
import { useMapStore } from './store/useMapStore';
import { HeaderBanner } from './components/layout/HeaderBanner';
import { AppSidebar } from './components/layout/AppSidebar';
import { AuditTrailDrawer } from './components/drawers/AuditTrailDrawer';
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
import { CrewView } from './views/CrewView';
import { CrewDetailView } from './views/CrewDetailView';
import { CapaManagementView } from './views/CapaManagementView';
import { ApproverDashboardView } from './views/ApproverDashboardView';
import { ProjectView } from './views/ProjectView';
import { ProjectDetailView } from './views/ProjectDetailView';
import { CreateProjectView } from './views/CreateProjectView';
import { MarketplaceView } from './views/MarketplaceView';
import './App.css';

import { isViewAccessibleToPersona } from './utils/rbacHelpers';
import { canOpenAssuranceRequestWizard } from './utils/notificationHelpers';
import { getSessionUserForPersona } from './utils/userRoleHelpers';
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
    rolePermissionDefaults,
    userPermissionOverrides,
    users,
    customScopes,
    notifications,
    pendingAssuranceRequestNotificationId,
    setPendingAssuranceRequestNotificationId,
  } = useMapStore();

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
        const parts = hash.split('/');
        setCurrentHashView(parts[0], parts[1] ? decodeURIComponent(parts[1]) : undefined);
      } else {
        setCurrentHashView('dashboard');
      }
    };

    parseHash();

    const handleHashChange = () => parseHash();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isAuthenticated, setCurrentHashView]);

  /* enforce RBAC route restriction across all active user personas */
  useEffect(() => {
    if (!isAuthenticated) return;

    const matchingUser =
      users.find((u) => u.roles.includes(activePersona)) ?? null;

    /* roles-permissions is persona-gated (Administrator settings); skip matrix revoke on blank role_rights */
    const allowedByRole =
      currentHashView === 'roles-permissions'
        ? isViewAccessibleToPersona(currentHashView, currentEntityId, activePersona)
        : isViewAccessibleToPersona(
          currentHashView,
          currentEntityId,
          activePersona,
          ENABLE_ROLES_AND_PERMISSIONS ? rolePermissionDefaults : undefined,
          ENABLE_ROLES_AND_PERMISSIONS ? userPermissionOverrides : undefined,
          matchingUser,
        );

    /* the user an assurance set request is assigned to may open the wizard for that request only */
    const allowedByRequest =
      currentHashView === 'create-assurance-set' &&
      canOpenAssuranceRequestWizard(
        notifications.find((n) => n.id === pendingAssuranceRequestNotificationId),
        getSessionUserForPersona(activePersona, users),
      );

    const allowed = allowedByRole || allowedByRequest;

    if (!allowed) {
      setCurrentHashView('dashboard');
    }
  }, [
    activePersona,
    currentHashView,
    currentEntityId,
    isAuthenticated,
    setCurrentHashView,
    rolePermissionDefaults,
    userPermissionOverrides,
    users,
    customScopes,
    notifications,
    pendingAssuranceRequestNotificationId,
  ]);

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
    switch (currentHashView) {
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

      {/* global Audit Trail offcanvas drawer */}
      <AuditTrailDrawer />
    </div>
  );
};

export default App;
