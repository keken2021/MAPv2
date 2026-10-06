/* 
  file summary: modal dialog component for provisioning internal organization users and inviting third-party external stakeholders.
  responsibilities: captures user name, email, persona role, organization affiliation, and scope, with input validation and audit logging.
  role in system: launched by UserManagementView.tsx when administrator clicks add user button.
*/

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import { UserType, UserProfile } from '../../types/user';
import { RoleName } from '../../types/permissions';
import { UserRoleChecklist } from '../common/UserRoleChecklist';
import { buildRolesFromForm } from '../../utils/userRoleHelpers';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
  what: renders modal for adding organization members or third-party users.
  how: validates user input, checks duplicate email address, adds user profile to zustand store, and logs audit event.
  with what file: src/components/drawers/AddUserModal.tsx loaded by UserManagementView.tsx.
*/
export const AddUserModal: React.FC<AddUserModalProps> = ({ isOpen, onClose }) => {
  const { users, addUser, activePersona } = useMapStore();
  const isCAdmin = activePersona === 'C Admin';
  const defaultOrgName = isCAdmin ? 'Northwind Marine Pty Ltd' : 'Northwind Marine Pty Ltd';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [userType, setUserType] = useState<UserType>('Third-Party');
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [operationalRoles, setOperationalRoles] = useState<RoleName[]>(['Verifier']);
  const [organization, setOrganization] = useState('');
  const [departmentOrScope, setDepartmentOrScope] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  if (!isOpen) return null;

  const isOrgMember = userType === 'Organization';

  const handleUserTypeChange = (nextType: UserType) => {
    setUserType(nextType);
    if (nextType === 'Organization') {
      setOrganization(defaultOrgName);
    } else {
      setOrganization('');
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setHasAttemptedSubmit(true);

    const resolvedOrg = isOrgMember ? defaultOrgName : organization.trim();

    if (!name.trim() || !email.trim() || !resolvedOrg) {
      setErrorMessage('Name, Email, and Organization are required.');
      return;
    }

    /* sanitize roles: never provision a second C Admin; C Admin creator also cannot assign Submitter */
    const effectivePlatformAdmin = isCAdmin ? false : isPlatformAdmin;
    const effectiveOperationalRoles = operationalRoles.filter((r) => {
      if (r === 'C Admin') return false;
      if (isCAdmin && r === 'Submitter') return false;
      return true;
    });

    const roles = buildRolesFromForm(effectivePlatformAdmin, effectiveOperationalRoles);
    if (roles.length === 0) {
      setErrorMessage('Select at least one platform or operational role for this user.');
      return;
    }

    /* check duplicate email validation */
    const existingUser = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (existingUser) {
      setErrorMessage(`A user with email address "${email.trim()}" already exists in the system.`);
      return;
    }

    const newUser: UserProfile = {
      id: `MAP-USR-2026-USER-${String(Math.floor(100 + Math.random() * 90000)).padStart(5, '0')}`,
      name: name.trim(),
      email: email.trim(),
      roles,
      userType,
      organization: resolvedOrg,
      departmentOrScope:
        departmentOrScope.trim() ||
        (userType === 'Organization'
          ? isCAdmin
            ? 'Client Operations'
            : 'Internal Operations'
          : 'External Stakeholder Scope'),
      status: userType === 'Third-Party' ? 'Pending Invitation' : 'Active',
      lastActive: userType === 'Third-Party' ? 'Invitation Sent' : 'Just Now',
      createdBy: activePersona,
      invitedBy: userType === 'Third-Party' ? activePersona : undefined,
    };

    addUser(newUser);

    /* reset form state */
    setName('');
    setEmail('');
    setUserType('Third-Party');
    setIsPlatformAdmin(false);
    setOperationalRoles(['Verifier']);
    setOrganization('');
    setDepartmentOrScope('');
    setErrorMessage('');
    onClose();
  };

  return (
    <div className="map-modal-backdrop d-flex align-items-center justify-content-center p-3">
      <div className="card map-card-custom shadow-lg" style={{ width: '100%', maxWidth: '580px', zIndex: 1100 }}>
        {/* Modal Header */}
        <div className="card-header d-flex align-items-center justify-content-between p-3 border-bottom">
          <div className="fw-bold text-dark fs-6">
            Provision New User / Third-Party Stakeholder
          </div>
          <button
            type="button"
            className="btn btn-sm btn-icon border-0 bg-transparent text-secondary p-1"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit}>
          <div className="card-body p-4 d-flex flex-column gap-3">
            {errorMessage && (
              <div className="alert alert-danger py-2 small mb-0">
                {errorMessage}
              </div>
            )}

            {/* User Type Selection */}
            <div>
              <label className="form-label small fw-semibold text-secondary mb-1">User Classification / Type <span className="text-danger">*</span></label>
              <div className="d-flex gap-3">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="userType"
                    id="userTypeOrg"
                    checked={userType === 'Organization'}
                    onChange={() => handleUserTypeChange('Organization')}
                  />
                  <label className="form-check-input-label small text-dark fw-semibold cursor-pointer" htmlFor="userTypeOrg">
                    Organization Member 
                  </label>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="userType"
                    id="userTypeThird"
                    checked={userType === 'Third-Party'}
                    onChange={() => handleUserTypeChange('Third-Party')}
                  />
                  <label className="form-check-input-label small text-dark fw-semibold cursor-pointer" htmlFor="userTypeThird">
                    Third-Party Stakeholder
                  </label>
                </div>
              </div>
            </div>

            {/* Full Name & Email */}
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="user-name">Full Name <span className="text-danger">*</span></label>
                <input
                  id="user-name"
                  type="text"
                  className={`form-control form-control-sm bg-white text-dark border-secondary ${hasAttemptedSubmit && !name.trim() ? 'is-invalid' : ''}`}
                  placeholder="e.g. Captain H. Vance"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="user-email">Email Address <span className="text-danger">*</span></label>
                <input
                  id="user-email"
                  type="email"
                  className={`form-control form-control-sm bg-white text-dark border-secondary ${hasAttemptedSubmit && (!email.trim() || !!users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())) ? 'is-invalid' : ''}`}
                  placeholder="name@organization.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Role Entitlements & Organization Name */}
            <div className="row g-3">
              <div className="col-12">
                <UserRoleChecklist
                  isPlatformAdmin={isCAdmin ? false : isPlatformAdmin}
                  operationalRoles={operationalRoles}
                  onPlatformAdminChange={setIsPlatformAdmin}
                  onOperationalRolesChange={setOperationalRoles}
                  hidePlatformAdmin={isCAdmin}
                  hideCAdminRole
                  hideSubmitterRole={isCAdmin}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="user-org">
                  Organization Name <span className="text-danger">*</span>
                </label>
                <input
                  id="user-org"
                  type="text"
                  className={`form-control form-control-sm text-dark border-secondary ${
                    isOrgMember ? 'bg-light text-secondary' : 'bg-white'
                  } ${hasAttemptedSubmit && !isOrgMember && !organization.trim() ? 'is-invalid' : ''}`}
                  placeholder={isOrgMember ? defaultOrgName : 'e.g. DNV / Bureau Veritas'}
                  value={isOrgMember ? defaultOrgName : organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  disabled={isOrgMember}
                  required
                />
                
              </div>
            </div>

            {/* Department / Scope of Responsibility */}
            <div>
              <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="user-scope">Department / Operational Scope</label>
              <input
                id="user-scope"
                type="text"
                className="form-control form-control-sm bg-white text-dark border-secondary"
                placeholder="e.g. Vetting Compliance & Statutory Verification"
                value={departmentOrScope}
                onChange={(e) => setDepartmentOrScope(e.target.value)}
              />
            </div>
          </div>

          {/* Modal Footer Controls */}
          <div className="card-footer d-flex align-items-center justify-content-end gap-2 p-3 border-top bg-light">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-sm btn-primary"
            >
              {userType === 'Third-Party' ? 'Send Invitation & Add User' : 'Provision User Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
