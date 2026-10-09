/*
  file summary: Roles & Permissions settings with draft/save, custom roles, and custom scopes.
  responsibilities: editable Create/Read/Update/Delete matrix per role or user with explicit Save.
  role in system: routed at #/roles-permissions from AppSidebar.
*/

import React, { useEffect, useMemo, useState } from 'react';
import { useMapStore } from '../store/useMapStore';
import { PermissionMatrix } from '../components/permissions/PermissionMatrix';
import {
  ALL_ROLE_PERSONAS,
  CrudAction,
  RolePermissionMatrix,
  UserPermissionOverrides,
  emptyCrud,
} from '../types/permissions';
import {
  countEnabledRights,
  getScopeDefinition,
  isBrdHardDenied,
  PERMISSION_SCOPE_CATALOG,
} from '../utils/permissionDefaults';
import {
  applyPermissionGuards,
  getEffectiveUserScopeFlags,
  getRoleScopeFlags,
} from '../utils/permissionHelpers';
import { formatUserRoles, getRoleDisplayLabel } from '../utils/userRoleHelpers';
import { filterUsersForPersona } from '../utils/rbacHelpers';
import { UserProfile } from '../types/user';

type SettingsTab = 'role-defaults' | 'user-permissions';

function cloneMatrix(matrix: RolePermissionMatrix): RolePermissionMatrix {
  return JSON.parse(JSON.stringify(matrix)) as RolePermissionMatrix;
}

function cloneOverrides(overrides: UserPermissionOverrides): UserPermissionOverrides {
  return JSON.parse(JSON.stringify(overrides)) as UserPermissionOverrides;
}

/**
  what: Roles & Permissions settings with Save bar, Add Role, and searchable user picker.
*/
export const RolesAndPermissionsView: React.FC = () => {
  const {
    activePersona,
    users,
    rolePermissionDefaults,
    userPermissionOverrides,
    customRoles,
    customScopes,
    commitRolePermissionDefaults,
    commitUserPermissionOverrides,
    resetRolePermissionsToBrd,
    clearUserPermissionOverrides,
    addCustomRole,
  } = useMapStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>('role-defaults');
  const [selectedRole, setSelectedRole] = useState<string>('Administrator');
  const visibleUsers = filterUsersForPersona(users, activePersona);
  const [selectedUserId, setSelectedUserId] = useState<string>(
    () => visibleUsers[0]?.id ?? '',
  );
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userPickerOpen, setUserPickerOpen] = useState(false);

  const [draftRoleMatrix, setDraftRoleMatrix] = useState<RolePermissionMatrix>(() =>
    cloneMatrix(rolePermissionDefaults),
  );
  const [draftUserOverrides, setDraftUserOverrides] = useState<UserPermissionOverrides>(() =>
    cloneOverrides(userPermissionOverrides),
  );
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [showAddRole, setShowAddRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const selectedUser = useMemo(
    () => visibleUsers.find((u) => u.id === selectedUserId) ?? visibleUsers[0],
    [visibleUsers, selectedUserId],
  );

  const filteredUsers = useMemo(() => {
    const q = userSearchQuery.trim().toLowerCase();
    if (!q) return visibleUsers;
    return visibleUsers.filter((u) => {
      const haystack = [
        u.name,
        u.email,
        u.organization,
        u.departmentOrScope,
        formatUserRoles(u.roles),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [visibleUsers, userSearchQuery]);

  const canEdit = activePersona === 'Administrator';
  const allRoles = useMemo(
    () => [...ALL_ROLE_PERSONAS, ...customRoles],
    [customRoles],
  );
  const catalog = useMemo(
    () => [...PERMISSION_SCOPE_CATALOG, ...customScopes],
    [customScopes],
  );

  useEffect(() => {
    setDraftRoleMatrix(cloneMatrix(rolePermissionDefaults));
  }, [rolePermissionDefaults]);

  useEffect(() => {
    setDraftUserOverrides(cloneOverrides(userPermissionOverrides));
  }, [userPermissionOverrides]);

  useEffect(() => {
    if (!allRoles.includes(selectedRole)) {
      setSelectedRole(allRoles[0] ?? 'Administrator');
    }
  }, [allRoles, selectedRole]);

  const roleDirty =
    JSON.stringify(draftRoleMatrix) !== JSON.stringify(rolePermissionDefaults);
  const userDirty =
    JSON.stringify(draftUserOverrides) !== JSON.stringify(userPermissionOverrides);
  const isDirty = activeTab === 'role-defaults' ? roleDirty : userDirty;

  const roleRightCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const role of allRoles) {
      counts[role] = countEnabledRights(draftRoleMatrix[role] || {});
    }
    return counts;
  }, [allRoles, draftRoleMatrix]);

  const isActionLocked = (scopeKey: string, action: CrudAction, role?: string): boolean => {
    const def = getScopeDefinition(scopeKey, customScopes);
    if (!def) return false;
    if (action === 'create' && def.lockCreate) return true;
    if (action === 'read' && def.lockRead) return true;
    if (action === 'update' && def.lockUpdate) return true;
    if (action === 'delete' && def.lockDelete) return true;
    if (role && def.hardDeny?.[role]?.includes(action)) return true;
    if (role && isBrdHardDenied(role, scopeKey, action)) return true;
    return false;
  };

  const toggleRoleDraft = (scopeKey: string, action: CrudAction, value: boolean) => {
    setDraftRoleMatrix((prev) => {
      const current = prev[selectedRole]?.[scopeKey] ?? emptyCrud();
      const guarded = applyPermissionGuards(
        scopeKey,
        selectedRole,
        { ...current, [action]: value },
        customScopes,
      );
      return {
        ...prev,
        [selectedRole]: {
          ...(prev[selectedRole] || {}),
          [scopeKey]: guarded,
        },
      };
    });
    setSaveMessage(null);
  };

  const toggleUserDraft = (scopeKey: string, action: CrudAction, value: boolean) => {
    if (!selectedUser) return;
    setDraftUserOverrides((prev) => {
      const userOverrides = { ...(prev[selectedUser.id] || {}) };
      const scopePatch = { ...(userOverrides[scopeKey] || {}), [action]: value };
      userOverrides[scopeKey] = scopePatch;
      return { ...prev, [selectedUser.id]: userOverrides };
    });
    setSaveMessage(null);
  };

  const handleSave = () => {
    if (!canEdit) return;
    if (activeTab === 'role-defaults') {
      commitRolePermissionDefaults(cloneMatrix(draftRoleMatrix));
      setSaveMessage('Role defaults saved. Users inherit these rights unless they have overrides.');
    } else {
      commitUserPermissionOverrides(cloneOverrides(draftUserOverrides));
      setSaveMessage(
        'User overrides saved. That user keeps role defaults plus these personal grants/denies.',
      );
    }
  };

  const handleDiscard = () => {
    if (activeTab === 'role-defaults') {
      setDraftRoleMatrix(cloneMatrix(rolePermissionDefaults));
    } else {
      setDraftUserOverrides(cloneOverrides(userPermissionOverrides));
    }
    setSaveMessage('Draft changes discarded.');
  };

  const handleAddRole = () => {
    setFormError(null);
    const result = addCustomRole(newRoleName);
    if (!result.success) {
      setFormError(result.message || 'Could not create role.');
      return;
    }
    setSelectedRole(newRoleName.trim());
    setNewRoleName('');
    setShowAddRole(false);
    setSaveMessage(`Role "${newRoleName.trim()}" created. Set Create/Read/Update/Delete, then Save.`);
  };

  const selectUser = (user: UserProfile) => {
    setSelectedUserId(user.id);
    setUserSearchQuery('');
    setUserPickerOpen(false);
  };

  return (
    <div className="d-flex flex-column gap-4 pb-5">
      {!canEdit && (
        <div className="alert alert-info py-2 small mb-0">
          Read-only. Only the Service Provider role can save changes.
        </div>
      )}
      {saveMessage && (
        <div className="alert alert-success py-2 small mb-0">{saveMessage}</div>
      )}

      {/* Top Header Bar: Tabs on the left, Action buttons on the right */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
        <div className="nav nav-pills bg-light p-1 rounded-3 border">
          <button
            type="button"
            className={`nav-link btn-sm font-mono-code px-3 py-1.5 ${
              activeTab === 'role-defaults'
                ? 'active bg-primary text-white fw-semibold'
                : 'text-secondary'
            }`}
            style={{ fontSize: '0.8rem' }}
            onClick={() => setActiveTab('role-defaults')}
          >
            Role Defaults ({allRoles.length})
            {roleDirty && <span className="badge text-bg-warning ms-2">Unsaved</span>}
          </button>
          <button
            type="button"
            className={`nav-link btn-sm font-mono-code px-3 py-1.5 ${
              activeTab === 'user-permissions'
                ? 'active bg-primary text-white fw-semibold'
                : 'text-secondary'
            }`}
            style={{ fontSize: '0.8rem' }}
            onClick={() => setActiveTab('user-permissions')}
          >
            User Permissions ({visibleUsers.length})
            {userDirty && <span className="badge text-bg-warning ms-2">Unsaved</span>}
          </button>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2">
          {canEdit && (
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={() => {
                setFormError(null);
                setShowAddRole(true);
              }}
            >
              New Role
            </button>
          )}
          {canEdit && activeTab === 'role-defaults' && (
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => {
                if (
                  window.confirm(
                    'Reset all roles to their defaults? Custom roles, scopes, categories, and user overrides will be removed.',
                  )
                ) {
                  resetRolePermissionsToBrd();
                  setSaveMessage('Reset to defaults.');
                }
              }}
            >
              Reset to Default
            </button>
          )}
        </div>
      </div>

      {activeTab === 'role-defaults' && (
        <div className="d-flex flex-column gap-3">
          <div className="map-perm-role-picker justify-content-center" role="tablist" aria-label="Select role">
            {allRoles.map((role) => (
              <button
                key={role}
                type="button"
                role="tab"
                aria-selected={selectedRole === role}
                className={`map-perm-role-chip ${selectedRole === role ? 'is-active' : ''}`}
                onClick={() => setSelectedRole(role)}
              >
                <span className="map-perm-role-chip-name">{getRoleDisplayLabel(role)}</span>
                <span className="map-perm-role-chip-count">
                  {roleRightCounts[role] ?? 0} rights
                  {!ALL_ROLE_PERSONAS.includes(role as (typeof ALL_ROLE_PERSONAS)[number]) &&
                    ''}
                </span>
              </button>
            ))}
          </div>


          <PermissionMatrix
            catalog={catalog}
            contextRole={selectedRole}
            readOnly={!canEdit}
            getFlags={(scopeKey) =>
              getRoleScopeFlags(draftRoleMatrix, selectedRole, scopeKey, customScopes)
            }
            isLocked={(scopeKey, action) => isActionLocked(scopeKey, action, selectedRole)}
            onToggle={toggleRoleDraft}
          />
        </div>
      )}

      {activeTab === 'user-permissions' && (
        <div className="d-flex flex-column gap-3">
          <div className="card map-card-custom map-user-picker-card p-3 bg-white">
            <div className="row g-3 align-items-end">
              <div className="col-md-7">
                <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="perm-user-search">
                  User
                </label>
                <div className="map-user-search-wrap position-relative">
                  <input
                    id="perm-user-search"
                    type="search"
                    className="form-control"
                    placeholder="Search users..."
                    value={
                      userPickerOpen || userSearchQuery
                        ? userSearchQuery
                        : selectedUser
                          ? `${selectedUser.name} · ${formatUserRoles(selectedUser.roles)}`
                          : ''
                    }
                    onChange={(e) => {
                      setUserSearchQuery(e.target.value);
                      setUserPickerOpen(true);
                    }}
                    onFocus={() => {
                      setUserPickerOpen(true);
                      setUserSearchQuery('');
                    }}
                    onBlur={() => {
                      window.setTimeout(() => setUserPickerOpen(false), 150);
                    }}
                    autoComplete="off"
                  />
                  {userPickerOpen && (
                    <div className="map-user-search-dropdown" role="listbox">
                      {filteredUsers.length === 0 ? (
                        <div className="map-user-search-empty text-secondary small px-3 py-2">
                          No users match “{userSearchQuery}”
                        </div>
                      ) : (
                        filteredUsers.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            role="option"
                            className={`map-user-search-option ${u.id === selectedUser?.id ? 'is-active' : ''}`}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectUser(u)}
                          >
                            <span className="fw-semibold text-dark d-block">{u.name}</span>
                            <span className="small text-secondary">
                              {u.email} · {formatUserRoles(u.roles)} · {u.organization}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <div className="form-text">
                  {visibleUsers.length} user{visibleUsers.length === 1 ? '' : 's'} available
                  {userSearchQuery.trim() ? ` · showing ${filteredUsers.length}` : ''}
                </div>
              </div>
              <div className="col-md-5">
                {selectedUser && (
                  <div className="d-flex flex-wrap align-items-center gap-2 justify-content-md-end">
                    <span className="small text-secondary">
                      Roles:{' '}
                      <strong className="text-dark">{formatUserRoles(selectedUser.roles)}</strong>
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        disabled={!userPermissionOverrides[selectedUser.id] && !draftUserOverrides[selectedUser.id]}
                        onClick={() => {
                          clearUserPermissionOverrides(selectedUser.id);
                          setDraftUserOverrides((prev) => {
                            const next = { ...prev };
                            delete next[selectedUser.id];
                            return next;
                          });
                          setSaveMessage(`${selectedUser.name} reset to role defaults.`);
                        }}
                      >
                        Reset to Role Defaults
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="form-text mt-2">
              Rights for this user only, on top of their role defaults.
              Save to apply. Reset to Role Defaults clears them.
            </div>
          </div>

          {selectedUser ? (
            <PermissionMatrix
              catalog={catalog}
              contextRole={selectedUser.roles[0]}
              readOnly={!canEdit}
              getFlags={(scopeKey) =>
                getEffectiveUserScopeFlags(
                  draftRoleMatrix,
                  draftUserOverrides,
                  selectedUser,
                  scopeKey,
                  customScopes,
                )
              }
              isLocked={(scopeKey, action) => {
                const scopeLocked = isActionLocked(scopeKey, action);
                if (scopeLocked) return true;
                if (!selectedUser.roles.length) return true;
                return selectedUser.roles.every((role) =>
                  isActionLocked(scopeKey, action, role),
                );
              }}
              onToggle={toggleUserDraft}
            />
          ) : (
            <div className="alert alert-secondary mb-0">No users hold this role.</div>
          )}
        </div>
      )}

      {canEdit && (
        <div className={`map-perm-save-bar ${isDirty ? 'is-dirty' : ''}`}>
          <div className="small">
            {isDirty ? (
              <span className="text-warning-emphasis fw-semibold">You have unsaved changes</span>
            ) : (
              <span className="text-secondary">All changes saved</span>
            )}
          </div>
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              disabled={!isDirty}
              onClick={handleDiscard}
            >
              Discard
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!isDirty}
              onClick={handleSave}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {showAddRole && (
        <div className="modal d-block" style={{ background: 'rgba(15,23,42,0.45)' }} role="dialog">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Create Role</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setShowAddRole(false)} />
              </div>
              <div className="modal-body">
                <label className="form-label" htmlFor="new-role-name">
                  Role Name
                </label>
                <input
                  id="new-role-name"
                  className="form-control"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="e.g. Fleet Coordinator"
                />
                <div className="form-text">
                  Assign the role to users in User
                  Management after you save rights.
                </div>
                {formError && <div className="text-danger small mt-2">{formError}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setShowAddRole(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={handleAddRole}>
                  Create Role
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
