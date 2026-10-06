/* 
  file summary: edit user modal dialog component for updating user profile attributes and rbac role assignments.
  responsibilities: captures updated user name, email, persona role, organization affiliation, scope, and status with validation.
  role in system: launched by UserTable.tsx when administrator clicks the edit action button for a user row.
*/

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import { RoleName } from '../../types/permissions';
import { UserType, UserProfile } from '../../types/user';
import { UserRoleChecklist } from '../common/UserRoleChecklist';
import { buildRolesFromForm, splitRolesForForm } from '../../utils/userRoleHelpers';

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
}

/**
  what: renders modal for editing an existing organization member or third-party user profile.
  how: pre-populates form state with target user data, validates inputs, checks email uniqueness, and dispatches updateUser to zustand store.
  with what file: src/components/drawers/EditUserModal.tsx loaded by UserTable.tsx.
*/
export const EditUserModal: React.FC<EditUserModalProps> = ({ isOpen, onClose, user }) => {
  const { users, updateUser, activePersona } = useMapStore();
  const isCAdmin = activePersona === 'C Admin';
  const defaultOrgName = isCAdmin ? 'Southern Basin Energy' : 'Northwind Marine Pty Ltd';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [userType, setUserType] = useState<UserType>('Organization');
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [operationalRoles, setOperationalRoles] = useState<RoleName[]>(['Submitter']);
  const [organization, setOrganization] = useState('');
  const [departmentOrScope, setDepartmentOrScope] = useState('');
  const [status, setStatus] = useState<UserProfile['status']>('Active');
  const [errorMessage, setErrorMessage] = useState('');
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  /* autofill animation state for pre-filled user fields */
  const [isJustLoaded, setIsJustLoaded] = useState(false);

  useEffect(() => {
    if (user && isOpen) {
      setName(user.name);
      setEmail(user.email);
      setUserType(user.userType);
      const { isPlatformAdmin: admin, operationalRoles: ops } = splitRolesForForm(user.roles);
      setIsPlatformAdmin(isCAdmin ? false : admin);
      /* C Admin is not assignable via checklist (one per org); keep other operational roles only */
      setOperationalRoles(
        ops.filter((r) => {
          if (r === 'C Admin') return false;
          if (isCAdmin && r === 'Submitter') return false;
          return true;
        }),
      );
      setOrganization(
        user.userType === 'Organization' ? user.organization || defaultOrgName : user.organization,
      );
      setDepartmentOrScope(user.departmentOrScope);
      setStatus(user.status);
      setErrorMessage('');
      setHasAttemptedSubmit(false);
      setIsJustLoaded(true);
      const timer = setTimeout(() => setIsJustLoaded(false), 750);
      return () => clearTimeout(timer);
    }
  }, [user, isOpen, isCAdmin, defaultOrgName]);

  if (!isOpen || !user) return null;

  const isOrgMember = userType === 'Organization';

  const handleUserTypeChange = (nextType: UserType) => {
    setUserType(nextType);
    if (nextType === 'Organization') {
      setOrganization(defaultOrgName);
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

    /* sanitize roles for c admin to guarantee no platform admin or submitter role leakage */
    const effectivePlatformAdmin = isCAdmin ? false : isPlatformAdmin;
    const effectiveOperationalRoles = operationalRoles.filter((r) => {
      if (r === 'C Admin') return false;
      if (isCAdmin && r === 'Submitter') return false;
      return true;
    });

    const roles = isCAdmin && user.roles.includes('C Admin')
      ? ['C Admin']
      : buildRolesFromForm(effectivePlatformAdmin, effectiveOperationalRoles);
    if (roles.length === 0) {
      setErrorMessage('Select at least one platform or operational role for this user.');
      return;
    }

    /* check duplicate email validation excluding current user being edited */
    const existingUser = users.find(
      (u) => u.id !== user.id && u.email.toLowerCase() === email.trim().toLowerCase()
    );
    if (existingUser) {
      setErrorMessage(`A user with email address "${email.trim()}" already exists in the system.`);
      return;
    }

    const updatedUser: UserProfile = {
      ...user,
      name: name.trim(),
      email: email.trim(),
      roles,
      userType,
      organization: resolvedOrg,
      departmentOrScope: departmentOrScope.trim() || (userType === 'Organization' ? 'Internal Operations' : 'External Stakeholder Scope'),
      status,
    };

    updateUser(updatedUser);
    onClose();
  };

  return (
    <div className="map-modal-backdrop d-flex align-items-center justify-content-center p-3">
      <div className="card map-card-custom shadow-lg" style={{ width: '100%', maxWidth: '580px', zIndex: 1100 }}>
        {/* Modal Header */}
        <div className="card-header d-flex align-items-center justify-content-between p-3 border-bottom">
          <div className="fw-bold text-dark fs-6">
            Edit User Profile ({user.id})
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
                    name="editUserType"
                    id="editUserTypeOrg"
                    checked={userType === 'Organization'}
                    onChange={() => handleUserTypeChange('Organization')}
                  />
                  <label className="form-check-input-label small text-dark fw-semibold cursor-pointer" htmlFor="editUserTypeOrg">
                    Organization Member ({defaultOrgName})
                  </label>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="editUserType"
                    id="editUserTypeThird"
                    checked={userType === 'Third-Party'}
                    onChange={() => handleUserTypeChange('Third-Party')}
                  />
                  <label className="form-check-input-label small text-dark fw-semibold cursor-pointer" htmlFor="editUserTypeThird">
                    Third-Party Stakeholder
                  </label>
                </div>
              </div>
            </div>

            {/* Full Name & Email */}
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="edit-user-name">Full Name <span className="text-danger">*</span></label>
                <input
                  id="edit-user-name"
                  type="text"
                  className={`form-control form-control-sm bg-white text-dark border-secondary${isJustLoaded ? ' map-autofill-animate' : ''} ${hasAttemptedSubmit && !name.trim() ? 'is-invalid' : ''}`}
                  placeholder="e.g. Captain H. Vance"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="edit-user-email">Email Address <span className="text-danger">*</span></label>
                <input
                  id="edit-user-email"
                  type="email"
                  className={`form-control form-control-sm bg-white text-dark border-secondary${isJustLoaded ? ' map-autofill-animate' : ''} ${hasAttemptedSubmit && !email.trim() ? 'is-invalid' : ''}`}
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
                <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="edit-user-org">Organization Name <span className="text-danger">*</span></label>
                <input
                  id="edit-user-org"
                  type="text"
                  className={`form-control form-control-sm text-dark border-secondary${isJustLoaded ? ' map-autofill-animate' : ''} ${isOrgMember ? 'bg-light text-secondary' : 'bg-white'
                    } ${hasAttemptedSubmit && !isOrgMember && !organization.trim() ? 'is-invalid' : ''}`}
                  placeholder={isOrgMember ? defaultOrgName : 'e.g. DNV / Bureau Veritas'}
                  value={isOrgMember ? defaultOrgName : organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  disabled={isOrgMember}
                  required
                />

              </div>
            </div>

            {/* Scope & Status */}
            <div className="row g-3">
              <div className="col-md-7">
                <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="edit-user-scope">Department / Operational Scope</label>
                <input
                  id="edit-user-scope"
                  type="text"
                  className={`form-control form-control-sm bg-white text-dark border-secondary${isJustLoaded ? ' map-autofill-animate' : ''}`}
                  placeholder="e.g. Vetting Compliance & Statutory Verification"
                  value={departmentOrScope}
                  onChange={(e) => setDepartmentOrScope(e.target.value)}
                />
              </div>

              <div className="col-md-5">
                <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="edit-user-status">Account Status <span className="text-danger">*</span></label>
                <select
                  id="edit-user-status"
                  className={`form-select form-select-sm bg-white text-dark border-secondary${isJustLoaded ? ' map-autofill-animate' : ''}`}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as UserProfile['status'])}
                >
                  <option value="Active">Active</option>
                  <option value="Pending Invitation">Pending Invitation</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
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
              Save User Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
