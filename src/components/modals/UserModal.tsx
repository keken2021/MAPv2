import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import { UserType, UserProfile } from '../../types/user';
import { RoleName } from '../../types/permissions';
import { UserRoleChecklist } from '../common/UserRoleChecklist';
import { buildRolesFromForm, findOtherSingleRoleHolder, splitRolesForForm } from '../../utils/userRoleHelpers';
import { checkEmailForMembership, personIdFor } from '../../utils/membershipHelpers';
import { ExistingPersonMembershipNotice } from './ExistingPersonMembershipNotice';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'add' | 'edit';
  user?: UserProfile | null;
}

export const UserModal: React.FC<UserModalProps> = ({ isOpen, onClose, mode, user }) => {
  const { users, addUser, updateUser, activePersona } = useMapStore();
  const isCAdmin = activePersona === 'C Admin';
  const isAdd = mode === 'add';
  const defaultOrgName = !isAdd && isCAdmin ? 'Southern Basin Energy' : 'Northwind Marine Pty Ltd';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [userType, setUserType] = useState<UserType>('Third-Party');
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [operationalRoles, setOperationalRoles] = useState<RoleName[]>(isAdd ? ['Verifier'] : ['Submitter']);
  const [organization, setOrganization] = useState('');
  const [departmentOrScope, setDepartmentOrScope] = useState('');
  const [status, setStatus] = useState<UserProfile['status']>('Active');
  const [errorMessage, setErrorMessage] = useState('');
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [isJustLoaded, setIsJustLoaded] = useState(false);
  /* a person from another organization with this email, waiting for the Administrator to confirm the new membership */
  const [pendingPerson, setPendingPerson] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!isAdd && user && isOpen) {
      setName(user.name);
      setEmail(user.email);
      setUserType(user.userType);
      const { isPlatformAdmin: admin, operationalRoles: ops } = splitRolesForForm(user.roles);
      setIsPlatformAdmin(isCAdmin ? false : admin);
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
  }, [user, isOpen, isAdd, isCAdmin, defaultOrgName]);

  if (!isOpen || (!isAdd && !user)) return null;

  const isOrgMember = userType === 'Organization';

  const handleUserTypeChange = (nextType: UserType) => {
    setUserType(nextType);
    if (nextType === 'Organization') {
      setOrganization(defaultOrgName);
    } else if (isAdd) {
      setOrganization('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit();
  };

  /* linkTo: the existing person the Administrator confirmed to add as a member of this organization */
  const submit = (linkTo?: UserProfile) => {
    setErrorMessage('');
    setHasAttemptedSubmit(true);

    const resolvedOrg = isOrgMember ? defaultOrgName : organization.trim();

    if (!name.trim() || !email.trim() || !resolvedOrg) {
      setErrorMessage('Name, Email, and Organization are required.');
      return;
    }

    const effectivePlatformAdmin = isCAdmin ? false : isPlatformAdmin;
    const effectiveOperationalRoles = operationalRoles.filter((r) => {
      if (r === 'C Admin') return false;
      if (isCAdmin && r === 'Submitter') return false;
      return true;
    });

    const roles = !isAdd && user && isCAdmin && user.roles.includes('C Admin')
      ? ['C Admin']
      : buildRolesFromForm(effectivePlatformAdmin, effectiveOperationalRoles);
    if (roles.length === 0) {
      setErrorMessage('Select at least one platform or operational role for this user.');
      return;
    }

    const emailCheck = checkEmailForMembership(users, email, resolvedOrg, isAdd ? null : user);
    if (emailCheck.kind === 'same-organization' || (emailCheck.kind === 'other-organization' && !isAdd)) {
      setErrorMessage(`A user with email address "${email.trim()}" already exists in the system.`);
      return;
    }
    if (emailCheck.kind === 'other-organization' && linkTo?.id !== emailCheck.person.id) {
      setPendingPerson(emailCheck.person);
      return;
    }
    const linkedPersonId = linkTo ? personIdFor(linkTo) : undefined;
    if (linkTo && !linkTo.personId) updateUser({ ...linkTo, personId: linkedPersonId });

    const targetStatus: UserProfile['status'] = isAdd
      ? (userType === 'Third-Party' ? 'Pending Invitation' : 'Active')
      : status;

    if (targetStatus === 'Active') {
      for (const singleRole of ['Administrator', 'C Admin'] as const) {
        if (roles.includes(singleRole)) {
          const otherHolder = findOtherSingleRoleHolder(
            users,
            resolvedOrg,
            singleRole,
            isAdd ? undefined : user?.id,
          );
          if (otherHolder) {
            const article = singleRole === 'Administrator' ? 'an' : 'a';
            setErrorMessage(
              `${resolvedOrg} already has ${article} ${singleRole}: ${otherHolder.name}. Choose another role.`,
            );
            return;
          }
        }
      }
    }

    if (isAdd) {
      const newUser: UserProfile = {
        id: `MAP-USR-2026-USER-${String(Math.floor(100 + Math.random() * 90000)).padStart(5, '0')}`,
        personId: linkedPersonId,
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
      setName('');
      setEmail('');
      setUserType('Third-Party');
      setIsPlatformAdmin(false);
      setOperationalRoles(['Verifier']);
      setOrganization('');
      setDepartmentOrScope('');
      setErrorMessage('');
      setPendingPerson(null);
    } else if (user) {
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
    }

    onClose();
  };

  const radioName = isAdd ? 'userType' : 'editUserType';
  const idPrefix = isAdd ? 'user' : 'edit-user';

  return (
    <div className="map-modal-backdrop d-flex align-items-center justify-content-center p-3">
      <div className="card map-card-custom shadow-lg" style={{ width: '100%', maxWidth: '580px', zIndex: 1100 }}>
        <div className="card-header d-flex align-items-center justify-content-between p-3 border-bottom">
          <div className="fw-bold text-dark fs-6">
            {isAdd ? 'Add User' : `Edit User (${user!.id})`}
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

        <form onSubmit={handleSubmit}>
          <div className="card-body p-4 d-flex flex-column gap-3">
            {errorMessage && (
              <div className="alert alert-danger py-2 small mb-0">
                {errorMessage}
              </div>
            )}
            {pendingPerson && (
              <ExistingPersonMembershipNotice
                person={pendingPerson}
                organization={isOrgMember ? defaultOrgName : organization.trim()}
                onConfirm={() => submit(pendingPerson)}
              />
            )}

            <div>
              <label className="form-label small fw-semibold text-secondary mb-1">User Type <span className="text-danger">*</span></label>
              <div className="d-flex gap-3">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name={radioName}
                    id={`${idPrefix}TypeOrg`}
                    checked={userType === 'Organization'}
                    onChange={() => handleUserTypeChange('Organization')}
                  />
                  <label className="form-check-input-label small text-dark fw-semibold cursor-pointer" htmlFor={`${idPrefix}TypeOrg`}>
                    {isAdd ? 'Organization Member' : `Organization Member (${defaultOrgName})`}
                  </label>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name={radioName}
                    id={`${idPrefix}TypeThird`}
                    checked={userType === 'Third-Party'}
                    onChange={() => handleUserTypeChange('Third-Party')}
                  />
                  <label className="form-check-input-label small text-dark fw-semibold cursor-pointer" htmlFor={`${idPrefix}TypeThird`}>
                    Third-Party
                  </label>
                </div>
              </div>
            </div>

            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label small fw-semibold text-secondary mb-1" htmlFor={`${idPrefix}-name`}>Full Name <span className="text-danger">*</span></label>
                <input
                  id={`${idPrefix}-name`}
                  type="text"
                  className={`form-control form-control-sm bg-white text-dark border-secondary${!isAdd && isJustLoaded ? ' map-autofill-animate' : ''} ${hasAttemptedSubmit && !name.trim() ? 'is-invalid' : ''}`}
                  placeholder="e.g. Captain H. Vance"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label small fw-semibold text-secondary mb-1" htmlFor={`${idPrefix}-email`}>Email <span className="text-danger">*</span></label>
                <input
                  id={`${idPrefix}-email`}
                  type="email"
                  className={`form-control form-control-sm bg-white text-dark border-secondary${!isAdd && isJustLoaded ? ' map-autofill-animate' : ''} ${hasAttemptedSubmit && !email.trim() ? 'is-invalid' : ''}`}
                  placeholder="name@organization.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setPendingPerson(null); }}
                  required
                />
              </div>
            </div>

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
                <label className="form-label small fw-semibold text-secondary mb-1" htmlFor={`${idPrefix}-org`}>
                  Organization <span className="text-danger">*</span>
                </label>
                <input
                  id={`${idPrefix}-org`}
                  type="text"
                  className={`form-control form-control-sm text-dark border-secondary${!isAdd && isJustLoaded ? ' map-autofill-animate' : ''} ${isOrgMember ? 'bg-light text-secondary' : 'bg-white'} ${hasAttemptedSubmit && !isOrgMember && !organization.trim() ? 'is-invalid' : ''}`}
                  placeholder={isOrgMember ? defaultOrgName : 'e.g. DNV / Bureau Veritas'}
                  value={isOrgMember ? defaultOrgName : organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  disabled={isOrgMember}
                  required
                />
              </div>
            </div>

            {!isAdd ? (
              <div className="row g-3">
                <div className="col-md-7">
                  <label className="form-label small fw-semibold text-secondary mb-1" htmlFor={`${idPrefix}-scope`}>Department</label>
                  <input
                    id={`${idPrefix}-scope`}
                    type="text"
                    className={`form-control form-control-sm bg-white text-dark border-secondary${isJustLoaded ? ' map-autofill-animate' : ''}`}
                    placeholder="e.g. Marine Compliance"
                    value={departmentOrScope}
                    onChange={(e) => setDepartmentOrScope(e.target.value)}
                  />
                </div>

                <div className="col-md-5">
                  <label className="form-label small fw-semibold text-secondary mb-1" htmlFor={`${idPrefix}-status`}>Status <span className="text-danger">*</span></label>
                  <select
                    id={`${idPrefix}-status`}
                    className={`form-select form-select-sm bg-white text-dark border-secondary${isJustLoaded ? ' map-autofill-animate' : ''}`}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as UserProfile['status'])}
                  >
                    <option value="Active">Active</option>
                    <option value="Pending Invitation">Pending</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
            ) : (
              <div>
                <label className="form-label small fw-semibold text-secondary mb-1" htmlFor={`${idPrefix}-scope`}>Department</label>
                <input
                  id={`${idPrefix}-scope`}
                  type="text"
                  className="form-control form-control-sm bg-white text-dark border-secondary"
                  placeholder="e.g. Marine Compliance"
                  value={departmentOrScope}
                  onChange={(e) => setDepartmentOrScope(e.target.value)}
                />
              </div>
            )}
          </div>

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
              {isAdd
                ? userType === 'Third-Party'
                  ? 'Send Invitation & Add User'
                  : 'Provision User Profile'
                : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
