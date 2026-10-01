/* 
  file summary: user management view component supporting role category tabs, user persona isolation, and add user trigger.
  responsibilities: presents role category tabs (inspectors, verifiers, admins), user isolation statistics, and add user trigger.
  role in system: main view for user governance navigation (/users).
*/

import React, { useState } from 'react';
import { useMapStore } from '../store/useMapStore';
import { UserTable } from '../components/tables/UserTable';
import { AddUserModal } from '../components/drawers/AddUserModal';
import { filterUsersForPersona } from '../utils/rbacHelpers';
import { userHasRole } from '../utils/userRoleHelpers';

/**
  what: renders user management view for organization and third-party users in light theme.
  how: filters users by persona, provides role category tabs, displays UserTable, and launches AddUserModal.
  with what file: src/views/UserManagementView.tsx loaded by App.tsx router.
*/
export const UserManagementView: React.FC = () => {
  const { users, activePersona } = useMapStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeRoleTab, setActiveRoleTab] = useState<'ALL' | 'Inspector' | 'Verifier' | 'AdminApprover'>('ALL');

  const visibleUsers = filterUsersForPersona(users, activePersona);

  const orgUsersCount = visibleUsers.filter((u) => u.userType === 'Organization').length;
  const thirdPartyUsersCount = visibleUsers.filter((u) => u.userType === 'Third-Party').length;
  const inspectorsCount = visibleUsers.filter((u) => userHasRole(u, 'Inspector')).length;
  const verifiersCount = visibleUsers.filter((u) => userHasRole(u, 'Verifier')).length;

  const isCAdmin = activePersona === 'C Admin';

  return (
    <div className="d-flex flex-column gap-4">

      {/* Top Summary KPI Metric Cards */}
      <div className="row g-3">
        <div className="col-md-3">
          <div className="card map-kpi-card shadow-2xs">
            <div className="map-kpi-label">
              Visible Personnel
            </div>
            <div className="map-kpi-value text-primary mt-1">{visibleUsers.length}</div>
            <div className="map-kpi-subtitle mt-1">Authorized Organization & Auditor Accounts</div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card map-kpi-card shadow-2xs">
            <div className="map-kpi-label">
              Organization Members
            </div>
            <div className="map-kpi-value text-primary mt-1">{orgUsersCount}</div>
            <div className="map-kpi-subtitle mt-1">Internal Team Accounts</div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card map-kpi-card shadow-2xs">
            <div className="map-kpi-label">
              Inspectors & Verifiers
            </div>
            <div className="map-kpi-value text-primary mt-1">{inspectorsCount + verifiersCount}</div>
            <div className="map-kpi-subtitle mt-1">Assigned Auditors & Compliance Verification</div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card map-kpi-card shadow-2xs">
            <div className="map-kpi-label">
              Third-Party Stakeholders
            </div>
            <div className="map-kpi-value text-warning mt-1">{thirdPartyUsersCount}</div>
            <div className="map-kpi-subtitle mt-1">External Audit & Survey Entities</div>
          </div>
        </div>
      </div>

      {/* Master User Directory Table matching Assurance Sets table grid format */}
      <UserTable
        roleCategoryTab={activeRoleTab}
        onAddUser={() => setIsModalOpen(true)}
      />

      {/* Add / Invite User Modal */}
      <AddUserModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};
