/* 
  file summary: reusable operational role checklist for user provisioning and edit forms.
  responsibilities: renders platform admin toggle, BRD + custom operational role checkboxes, and SoD warnings.
  role in system: used by AddUserModal and EditUserModal.
*/

import React from 'react';
import { RoleName } from '../../types/permissions';
import {
  getOperationalRoleOptions,
  getSegregationWarnings,
} from '../../utils/userRoleHelpers';
import { useMapStore } from '../../store/useMapStore';

interface UserRoleChecklistProps {
  isPlatformAdmin: boolean;
  operationalRoles: RoleName[];
  onPlatformAdminChange: (checked: boolean) => void;
  onOperationalRolesChange: (roles: RoleName[]) => void;
  hidePlatformAdmin?: boolean;
  hideCAdminRole?: boolean;
  hideSubmitterRole?: boolean;
  excludedRoles?: RoleName[];
}

/**
  what: renders platform admin + operational role checkboxes including Roles & Permissions custom roles.
  how: checks active persona and visibility props, filtering out platform access control, c admin role, and submitter role for client administrators.
  with what file: src/components/common/UserRoleChecklist.tsx loaded by AddUserModal.tsx and EditUserModal.tsx.
*/
export const UserRoleChecklist: React.FC<UserRoleChecklistProps> = ({
  isPlatformAdmin,
  operationalRoles,
  onPlatformAdminChange,
  onOperationalRolesChange,
  hidePlatformAdmin,
  hideCAdminRole,
  hideSubmitterRole,
  excludedRoles = [],
}) => {
  const { customRoles, activePersona } = useMapStore();
  const isCAdminPersona = activePersona === 'C Admin';

  const shouldHidePlatformAdmin = hidePlatformAdmin ?? isCAdminPersona;
  const shouldHideCAdminRole = hideCAdminRole ?? isCAdminPersona;
  const shouldHideSubmitterRole = hideSubmitterRole ?? isCAdminPersona;

  const effectiveExcludedRoles: RoleName[] = [
    ...excludedRoles,
    ...(shouldHideCAdminRole ? (['C Admin'] as RoleName[]) : []),
    ...(shouldHideSubmitterRole ? (['Submitter'] as RoleName[]) : []),
  ];

  const roleOptions = getOperationalRoleOptions(customRoles, effectiveExcludedRoles);

  const toggleOperationalRole = (role: RoleName) => {
    if (operationalRoles.includes(role)) {
      onOperationalRolesChange(operationalRoles.filter((r) => r !== role));
      return;
    }
    onOperationalRolesChange([...operationalRoles, role]);
  };

  const previewRoles: RoleName[] = [
    ...(isPlatformAdmin && !shouldHidePlatformAdmin ? (['Administrator'] as RoleName[]) : []),
    ...operationalRoles,
  ];
  const sodWarnings = getSegregationWarnings(previewRoles);

  return (
    <div className="d-flex flex-column gap-3">
      {!shouldHidePlatformAdmin && (
        <div>
          <label className="form-label small fw-semibold text-secondary mb-2">
            Platform Access
          </label>
          <div className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              id="role-platform-admin"
              checked={isPlatformAdmin}
              onChange={(e) => onPlatformAdminChange(e.target.checked)}
            />
            <label className="form-check-label small text-dark fw-semibold" htmlFor="role-platform-admin">
              Full Access
            </label>
          </div>
        </div>
      )}

      <div>
        <label className="form-label small fw-semibold text-secondary mb-2">
          Roles
        </label>
        <div className="row g-2">
          {roleOptions.map(({ role, label, isCustom }) => (
            <div key={role} className="col-md-6">
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id={`role-${String(role).replace(/\s+/g, '-').toLowerCase()}`}
                  checked={operationalRoles.includes(role)}
                  onChange={() => toggleOperationalRole(role)}
                />
                <label
                  className="form-check-label small text-dark"
                  htmlFor={`role-${String(role).replace(/\s+/g, '-').toLowerCase()}`}
                >
                  {label}
                  {/* {isCustom && (
                    <span className="badge text-bg-light border ms-1 fw-normal">Custom</span>
                  )} */}
                </label>
              </div>
            </div>
          ))}
        </div>
        {customRoles.length === 0 ? (
          <div className="form-text">
            A user can hold more than one role where segregation of duties allows.
            Add more roles in <strong>Roles &amp; Permissions</strong>.
          </div>
        ) : (
          ""
        )}
      </div>

      {sodWarnings.length > 0 && (
        <div className="alert alert-warning py-2 small mb-0">
          <div className="fw-semibold mb-1">Segregation of Duties</div>
          <ul className="mb-0 ps-3">
            {sodWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
