/* 
  file summary: header banner component matching mockup layout with page title or back button, scenario filter pills, and viewing as persona pills.
  responsibilities: presents top navigation header with the page title on lists and a back button to the parent list or referring entity on detail pages, plus the persona role selector pills.
  role in system: top layout header loaded at the root of the app shell.
*/

import React, { useMemo } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { getPersonaOptionsForOrganization } from '../../utils/demoSessionHelpers';
import { getRoleDisplayLabel } from '../../utils/userRoleHelpers';
import { HeaderBackButton, useHeaderBackNavigation } from '../../utils/headerNavigation';
import { NotificationPanel } from './NotificationPanel';

/**
  what: renders top header bar with the page title on lists, a back button to the parent list or referring entity on detail pages, and viewing as persona pills.
  how: computes the open page title, delegates back navigation to useHeaderBackNavigation/HeaderBackButton, and updates the active persona on pill click.
  with what file: src/components/layout/HeaderBanner.tsx loaded by App.tsx.
*/
export const HeaderBanner: React.FC = () => {
  const {
    activePersona,
    setActivePersona,
    activeDemoOrganization,
    users,
    currentHashView,
    currentEntityId,
    vessels,
    assuranceSets,
    documents,
    crew,
    equipment,
    projects,
  } = useMapStore();

  const { isDetailPage } = useHeaderBackNavigation();

  const rolesList = useMemo(
    () => getPersonaOptionsForOrganization(users, activeDemoOrganization),
    [users, activeDemoOrganization],
  );

  /* compute active page title based on current view */
  const getHeaderTitleDetails = (): { breadcrumb: string; title: string } => {
    switch (currentHashView) {
      case 'vessels': {
        if (currentEntityId) {
          const v = vessels.find((item) => item.id === currentEntityId);
          return {
            breadcrumb: v?.imoNumber ? `IMO ${v.imoNumber}` : 'VESSELS',
            title: v ? v.name : 'Vessel Detail',
          };
        }
        return { breadcrumb: 'VESSELS', title: 'Vessels' };
      }
      case 'equipment': {
        if (currentEntityId) {
          const eq = equipment.find((item) => item.id === currentEntityId);
          return {
            breadcrumb: eq?.equipmentIdentifier || 'EQUIPMENT',
            title: eq ? eq.name : 'Equipment Detail',
          };
        }
        return { breadcrumb: 'EQUIPMENT', title: 'Equipment' };
      }
      case 'project': {
        if (currentEntityId === 'new') {
          return { breadcrumb: 'CREATE PROJECT', title: 'Create Project' };
        }
        if (currentEntityId) {
          const p = projects.find((item) => item.id === currentEntityId);
          return {
            breadcrumb: p?.id || 'PROJECT',
            title: p ? p.name : 'Project Detail',
          };
        }
        return { breadcrumb: 'PROJECTS', title: 'Projects' };
      }
      case 'assurance-sets': {
        if (currentEntityId) {
          const s = assuranceSets.find((item) => item.id === currentEntityId);
          return {
            breadcrumb: s?.id ? `${s.id} · ASSURANCE SET` : 'ASSURANCE SET',
            title: s ? s.title : 'Assurance Set Detail',
          };
        }
        return { breadcrumb: 'ASSURANCE SETS', title: 'Assurance Sets' };
      }
      case 'documents': {
        if (currentEntityId) {
          const d = documents.find((item) => item.id === currentEntityId);
          return {
            breadcrumb: d?.certificateNo ? `CERT ${d.certificateNo}` : 'DOCUMENT',
            title: d ? d.title : 'Document Detail',
          };
        }
        return { breadcrumb: 'DOCUMENTS', title: 'Document Library' };
      }
      case 'crew': {
        if (currentEntityId) {
          const c = crew ? crew.find((item) => item.id === currentEntityId) : null;
          return {
            breadcrumb: c?.id ? `${c.id} · CREW` : 'CREW',
            title: c ? c.fullName : 'Crew Detail',
          };
        }
        return { breadcrumb: 'CREW', title: 'Crew Directory' };
      }
      case 'users':
        return { breadcrumb: 'USERS', title: 'User Management' };
      case 'roles-permissions':
        return { breadcrumb: 'ROLES & PERMISSIONS', title: 'Roles & Permissions' };
      case 'verifier':
        return { breadcrumb: 'VERIFICATION QUEUE', title: 'Verification Queue' };
      case 'inspection':
      case 'inspector':
        if (currentEntityId) {
          return {
            breadcrumb: 'INSPECTIONS',
            title: `${decodeURIComponent(currentEntityId)} Inspection`,
          };
        }
        return { breadcrumb: 'INSPECTIONS', title: 'Inspections' };
      case 'approver':
        return { breadcrumb: 'APPROVALS', title: 'Approvals' };
      case 'capa':
      case 'capas':
        if (currentEntityId && currentEntityId !== 'ALL_FLEET' && currentEntityId !== 'ALL') {
          return {
            breadcrumb: 'CAPA',
            title: `${decodeURIComponent(currentEntityId)} CAPAs`,
          };
        }
        return { breadcrumb: 'CAPA', title: 'CAPA' };
      case 'audit':
        return { breadcrumb: 'AUDIT TRAIL', title: 'Audit Trail' };
      case 'create-assurance-set':
        return { breadcrumb: 'CREATE ASSURANCE SET', title: 'Create Assurance Set' };
      case 'marketplace':
        return { breadcrumb: 'MARKETPLACE', title: 'Marketplace' };
      case 'notifications':
        return { breadcrumb: 'NOTIFICATIONS', title: 'Notifications' };
      case 'objects':
        return { breadcrumb: 'ALL OBJECTS', title: 'All Objects' };
      case 'dashboard':
      default:
        return { breadcrumb: 'DASHBOARD', title: 'Dashboard' };
    }
  };

  const { title } = getHeaderTitleDetails();

  return (
    <header
      className="map-top-banner d-flex align-items-center justify-content-between px-4 py-3 bg-white border-bottom"
      style={{ minHeight: '64px', borderColor: 'var(--map-border-color)' }}
    >
      {/* left side: back to the parent list or referring entity on a detail page, or the page title on a list */}
      <div className="min-w-0">
        {isDetailPage ? (
          <HeaderBackButton />
        ) : (
          <h1 className="map-page-title mb-0" style={{ fontSize: '1.25rem', letterSpacing: '-0.01em' }}>
            {title}
          </h1>
        )}
      </div>

      {/* right side: notifications + viewing as persona pills */}
      <div className="d-flex align-items-center gap-4">
        <NotificationPanel />
        {/* viewing as persona selector pills */}
        <div className="d-flex align-items-center gap-2">
          <span className="text-uppercase fw-bold me-1" style={{ fontSize: '0.625rem', color: 'var(--map-text-muted)', letterSpacing: '0.08em' }}>
            VIEWING AS
          </span>
          <div className="d-flex align-items-center gap-1">
            {rolesList.map((r) => {
              const isActive = activePersona === r.role;
              return (
                <button
                  key={r.role}
                  type="button"
                  className={`btn btn-xs rounded-pill px-3 py-1 ${isActive
                    ? 'bg-primary text-white fw-semibold shadow-sm'
                    : 'text-secondary bg-transparent border-0'
                    }`}
                  style={{ fontSize: '0.75rem', transition: 'all 0.15s ease-in-out' }}
                  onClick={() => setActivePersona(r.role)}
                >
                  {getRoleDisplayLabel(r.role)}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
};
