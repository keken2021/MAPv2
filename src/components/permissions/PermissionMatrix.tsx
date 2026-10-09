/*
  file summary: clean single-subject permission table (Feature | Create | Read | Update | Delete).
  responsibilities: renders categorized scopes with circular checkboxes; BRD locks disable non-applicable verbs.
  role in system: used by RolesAndPermissionsView for one selected role or one selected user.
*/

import React from 'react';
import { Check } from 'lucide-react';
import {
  CrudAction,
  CrudFlags,
  CRUD_ACTIONS,
  PermissionScopeDefinition,
} from '../../types/permissions';
import { isBrdHardDenied } from '../../utils/permissionDefaults';
import { getRoleDisplayLabel } from '../../utils/userRoleHelpers';

interface PermissionMatrixProps {
  catalog: PermissionScopeDefinition[];
  contextRole?: string;
  getFlags: (scopeKey: string) => CrudFlags;
  onToggle: (scopeKey: string, action: CrudAction, value: boolean) => void;
  isLocked?: (scopeKey: string, action: CrudAction) => boolean;
  readOnly?: boolean;
}

const ACTION_LABEL: Record<CrudAction, string> = {
  create: 'Create',
  read: 'View',
  update: 'Update',
  delete: 'Delete',
};

function lockReason(
  scopeKey: string,
  action: CrudAction,
  catalog: PermissionScopeDefinition[],
  role?: string,
): string | null {
  const def = catalog.find((s) => s.key === scopeKey);
  if (!def) return null;

  if (action === 'create' && def.lockCreate) {
    return 'Create does not apply here.';
  }
  if (action === 'read' && def.lockRead) {
    return 'View is locked here.';
  }
  if (action === 'update' && def.lockUpdate) {
    return 'Update is locked. This item is view-only.';
  }
  if (action === 'delete' && def.lockDelete) {
    return 'Delete is locked. This item cannot be removed.';
  }
  if (role && def.hardDeny?.[role]?.includes(action)) {
    return `Not allowed for ${getRoleDisplayLabel(role)}.`;
  }
  if (role && isBrdHardDenied(role, scopeKey, action)) {
    return `Not allowed for ${getRoleDisplayLabel(role)}.`;
  }
  return null;
}

/**
  what: renders a readable Feature × Create/View/Update/Delete table for one role or user.
*/
export const PermissionMatrix: React.FC<PermissionMatrixProps> = ({
  catalog,
  contextRole,
  getFlags,
  onToggle,
  isLocked,
  readOnly = false,
}) => {
  const categories = Array.from(new Set(catalog.map((s) => s.category)));

  return (
    <div className="map-perm-flat-wrap">
      <table className="map-perm-flat-table">
        <thead>
          <tr>
            <th scope="col" className="map-perm-flat-obj">
              Permission
            </th>
            {CRUD_ACTIONS.map((action) => (
              <th key={action} scope="col" className="map-perm-flat-action">
                {ACTION_LABEL[action]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => {
            const scopes = catalog.filter((s) => s.category === category);
            return (
              <React.Fragment key={category}>
                <tr className="map-perm-flat-category">
                  <td colSpan={5}>{category}</td>
                </tr>
                {scopes.map((scope) => {
                  const flags = getFlags(scope.key);
                  return (
                    <tr key={scope.key} className="map-perm-flat-row">
                      <td className="map-perm-flat-obj">
                        <div className="map-perm-flat-label">{scope.label}</div>
                        <div className="map-perm-flat-desc">{scope.description}</div>
                      </td>
                      {CRUD_ACTIONS.map((action) => {
                        const locked = isLocked?.(scope.key, action) ?? false;
                        const reason = locked
                          ? lockReason(scope.key, action, catalog, contextRole)
                          : null;
                        const title =
                          reason ?? `${scope.label}: ${ACTION_LABEL[action]}`;

                        return (
                          <td key={action} className="map-perm-flat-action">
                            <button
                              type="button"
                              className={[
                                'map-perm-circle',
                                flags[action] ? 'is-checked' : '',
                                locked ? 'is-locked' : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                              disabled={readOnly || locked}
                              title={title}
                              aria-label={`${scope.label} ${ACTION_LABEL[action]}${locked ? ' (locked)' : ''}`}
                              aria-pressed={flags[action]}
                              onClick={() => {
                                if (readOnly || locked) return;
                                onToggle(scope.key, action, !flags[action]);
                              }}
                            >
                              {flags[action] && (
                                <Check className="w-3 h-3 text-white" strokeWidth={3} aria-hidden="true" />
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
