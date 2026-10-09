/* 
  file summary: header banner component matching mockup layout with breadcrumb title, scenario filter pills, and viewing as persona pills.
  responsibilities: presents top navigation header with active workspace breadcrumb, scenario toggle, and persona role selector pills.
  role in system: top layout header loaded at the root of the app shell.
*/

import React, { useMemo } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { getBackButtonInfo } from '../../utils/rbacHelpers';
import { getPersonaOptionsForOrganization } from '../../utils/demoSessionHelpers';
import { getRoleDisplayLabel } from '../../utils/userRoleHelpers';
import { NotificationPanel } from './NotificationPanel';

/**
  what: renders top header bar with breadcrumb page title, scenario toggle, and viewing as persona pills matching the mockup design.
  how: computes open page title and context breadcrumb, manages scenario toggle state, and updates active persona on pill click.
  with what file: src/components/layout/HeaderBanner.tsx loaded by App.tsx.
*/
export const HeaderBanner: React.FC = () => {
  const {
    activePersona,
    setActivePersona,
    activeDemoOrganization,
    users,
    currentHashView,
    previousHashView,
    previousEntityId,
    currentEntityId,
    setCurrentHashView,
    vessels,
    assuranceSets,
    documents,
    crew,
    equipment,
    projects,
  } = useMapStore();

  /* compute dynamic back button info based on active detail view */
  const getHeaderBackInfo = () => {
    switch (currentHashView) {
      case 'vessels':
        return getBackButtonInfo('vessels', 'Vessels', previousHashView, activePersona, previousEntityId);
      case 'equipment':
        return getBackButtonInfo('equipment', 'Equipment', previousHashView, activePersona, previousEntityId);
      case 'project':
        return getBackButtonInfo('project', 'Projects', previousHashView, activePersona, previousEntityId);
      case 'documents':
        return getBackButtonInfo('documents', 'Document Library', previousHashView, activePersona, previousEntityId);
      case 'crew':
        return getBackButtonInfo('crew', 'Crew Directory', previousHashView, activePersona, previousEntityId);
      case 'inspection':
      case 'inspector':
        return getBackButtonInfo('inspector', 'Physical Inspections', previousHashView, activePersona, previousEntityId);
      case 'capa':
      case 'capas':
        return getBackButtonInfo('capa', 'Physical Inspections', previousHashView, activePersona, previousEntityId);
      case 'approver':
        return getBackButtonInfo('approver', 'Approval Gate', previousHashView, activePersona, previousEntityId);
      case 'roles-permissions':
        return getBackButtonInfo('roles-permissions', 'Roles & Permissions', previousHashView, activePersona, previousEntityId);
      case 'marketplace':
        return getBackButtonInfo('marketplace', 'Marketplace', previousHashView, activePersona, previousEntityId);
      case 'create-assurance-set':
      case 'assurance-sets':
      default:
        return getBackButtonInfo('assurance-sets', 'Assurance Sets', previousHashView, activePersona, previousEntityId);
    }
  };

  const isDetailPage =
    Boolean(currentEntityId) ||
    currentHashView === 'create-assurance-set' ||
    (currentHashView === 'project' && currentEntityId === 'new');
  const headerBackInfo = getHeaderBackInfo();

  const rolesList = useMemo(
    () => getPersonaOptionsForOrganization(users, activeDemoOrganization),
    [users, activeDemoOrganization],
  );

  /* compute active page title and breadcrumb text based on current view */
  const getHeaderTitleDetails = (): { breadcrumb: string; title: string } => {
    switch (currentHashView) {
      case 'vessels': {
        if (currentEntityId) {
          const v = vessels.find((item) => item.id === currentEntityId);
          return {
            breadcrumb: `IMO ${v?.imoNumber || 'FLEET'} · VESSEL PROFILE`,
            title: v ? v.name : 'Vessel Detail',
          };
        }
        return { breadcrumb: 'FLEET MASTER · ASSET REGISTRY', title: 'Vessels' };
      }
      case 'equipment': {
        if (currentEntityId) {
          const eq = equipment.find((item) => item.id === currentEntityId);
          return {
            breadcrumb: `${eq?.equipmentIdentifier || 'EQUIPMENT'} · ASSET PROFILE`,
            title: eq ? eq.name : 'Equipment Detail',
          };
        }
        return { breadcrumb: 'FLEET MASTER · EQUIPMENT REGISTRY', title: 'Equipment' };
      }
      case 'project': {
        if (currentEntityId === 'new') {
          return { breadcrumb: 'CHARTER COMPOSITION · NEW PROJECT', title: 'Create Project' };
        }
        if (currentEntityId) {
          const p = projects.find((item) => item.id === currentEntityId);
          return {
            breadcrumb: `${p?.id || 'PROJECT'} · CHARTER COMPOSITION`,
            title: p ? p.name : 'Project Detail',
          };
        }
        return { breadcrumb: 'CHARTER COMPOSITION · PROJECT REGISTRY', title: 'Projects' };
      }
      case 'assurance-sets': {
        if (currentEntityId) {
          const s = assuranceSets.find((item) => item.id === currentEntityId);
          return {
            breadcrumb: `${s?.id || 'CAMPAIGN'} · ASSURANCE SET`,
            title: s ? s.title : 'Assurance Set Detail Page',
          };
        }
        return { breadcrumb: 'ASSURANCE CAMPAIGN REGISTRY · FLEET OVERVIEW', title: 'Assurance Sets' };
      }
      case 'documents': {
        if (currentEntityId) {
          const d = documents.find((item) => item.id === currentEntityId);
          return {
            breadcrumb: `CERT ${d?.certificateNo || 'VAULT'} · STATUTORY FILE`,
            title: d ? d.title : 'Document Detail',
          };
        }
        return { breadcrumb: 'STATUTORY VAULT · COMPLIANCE EVIDENCE', title: 'Document Library' };
      }
      case 'crew': {
        if (currentEntityId) {
          const c = crew ? crew.find((item) => item.id === currentEntityId) : null;
          return {
            breadcrumb: `CREW ID ${c?.id || 'DIRECTORY'} · SEAFARER PROFILE`,
            title: c ? c.fullName : 'Crew Detail',
          };
        }
        return { breadcrumb: 'SEAFARER DIRECTORY · CREW MANNING', title: 'Crew Directory' };
      }
      case 'users':
        return { breadcrumb: 'USER DIRECTORY · ACCESS GOVERNANCE', title: 'User Management' };
      case 'roles-permissions':
        return { breadcrumb: 'ACCESS CONTROL · GOVERNANCE MATRIX', title: 'Roles & Permissions' };
      case 'verifier':
        return { breadcrumb: 'SURVEYOR WORKSPACE · COMPLIANCE REVIEW', title: 'Verification Queue' };
      case 'inspection':
      case 'inspector':
        if (currentEntityId) {
          return {
            breadcrumb: 'PHYSICAL AUDIT · VISUAL SURVEY',
            title: `${decodeURIComponent(currentEntityId)} Physical Inspection`,
          };
        }
        return { breadcrumb: 'PHYSICAL AUDIT · VISUAL SURVEY', title: 'Physical Inspections' };
      case 'approver':
        return { breadcrumb: 'CHARTER AUTHORITY · READINESS SIGN-OFF', title: 'Approval Gate' };
      case 'capa':
      case 'capas':
        if (currentEntityId && currentEntityId !== 'ALL_FLEET' && currentEntityId !== 'ALL') {
          return {
            breadcrumb: 'CORRECTIVE ACTIONS · PHYSICAL AUDIT',
            title: `${decodeURIComponent(currentEntityId)} Physical Inspection CAPAs`,
          };
        }
        return { breadcrumb: 'CORRECTIVE ACTION TRACKER · FLEET OVERVIEW', title: 'CAPA Tracker' };
      case 'audit':
        return { breadcrumb: 'IMMUTABLE LOGS · CRYPTOGRAPHIC AUDIT', title: 'Audit Trail' };
      case 'create-assurance-set':
        return { breadcrumb: 'NEW ASSURANCE CAMPAIGN · INITIATION', title: 'Create Assurance Set' };
      case 'marketplace':
        return { breadcrumb: 'CHARTER & ASSET PROVISION · THIRD-PARTY MARKETPLACE', title: 'Marketplace' };
      case 'notifications':
        return { breadcrumb: 'INBOX · REQUESTS & WORKFLOW UPDATES', title: 'Notifications' };
      case 'dashboard':
      default:
        return { breadcrumb: 'MARINE ASSURANCE PLATFORM · FLEET OVERVIEW', title: 'Dashboard' };
    }
  };

  const { breadcrumb, title } = getHeaderTitleDetails();

  return (
    <header
      className="map-top-banner d-flex align-items-center justify-content-between px-4 py-3 bg-white border-bottom"
      style={{ minHeight: '64px', borderColor: 'var(--map-border-color)' }}
    >
      {/* left side: back button for any detail page or breadcrumb & page title */}
      <div>
        {isDetailPage ? (
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-2 fw-semibold"
            onClick={() => setCurrentHashView(headerBackInfo.targetView, headerBackInfo.targetEntityId)}
          >
            {headerBackInfo.label}
          </button>
        ) : (
          <>
            <div className="text-uppercase fw-medium font-mono-code mb-1" style={{ fontSize: '0.675rem', color: 'var(--map-text-muted)', letterSpacing: '0.06em' }}>
              {breadcrumb}
            </div>
            <h1 className="map-page-title mb-0" style={{ fontSize: '1.25rem', letterSpacing: '-0.01em' }}>
              {title}
            </h1>
          </>
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


