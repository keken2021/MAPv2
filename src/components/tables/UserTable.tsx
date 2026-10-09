/* 
  file summary: master user directory table component matching exact assurance sets table format and header controls layout.
  responsibilities: presents names, emails, role badges, organization scopes, classification badges, export controls, and user addition triggers.
  role in system: main data table component for UserManagementView.tsx.
*/

import React, { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Pencil, UserX, UserCheck } from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import { UserProfile, UserRolePersona } from '../../types/user';
import { RoleName } from '../../types/permissions';
import { FilterModal } from '../common/FilterModal';
import { FilterButton } from '../common/FilterButton';
import { ActiveFilterChips, FilterChip } from '../common/ActiveFilterChips';
import { exportToCsv, exportToPdf } from '../../utils/exportHelpers';
import { EditUserModal } from '../drawers/EditUserModal';
import { canPerform } from '../../utils/permissionHelpers';

import { filterUsersForPersona } from '../../utils/rbacHelpers';
import { formatUserRoles, getRoleDisplayLabel, userHasRole, userMatchesAnyRole } from '../../utils/userRoleHelpers';

type UserSortField =
  | 'id'
  | 'name'
  | 'roles'
  | 'userType'
  | 'organization'
  | 'status'
  | 'lastActive';

interface UserTableProps {
  onAddUser?: () => void;
  roleCategoryTab?: 'ALL' | 'Inspector' | 'Verifier' | 'AdminApprover';
}

/**
  what: renders master user directory table matching assurance sets table layout with column sorting.
  how: filters users array by search query, persona isolation rules, role category tabs, and classification, with column sorting and export to CSV/PDF.
  with what file: src/components/tables/UserTable.tsx loaded by UserManagementView.tsx.
*/
export const UserTable: React.FC<UserTableProps> = ({ onAddUser, roleCategoryTab = 'ALL' }) => {
  const {
    users,
    updateUserStatus,
    activePersona,
    customRoles,
    rolePermissionDefaults,
    userPermissionOverrides,
    customScopes,
  } = useMapStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [sortField, setSortField] = useState<UserSortField>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  const matchingUser = users.find((u) => u.roles.includes(activePersona)) ?? null;
  const canCreateUser =
    activePersona === 'Administrator' ||
    activePersona === 'C Admin' ||
    canPerform(
      rolePermissionDefaults,
      userPermissionOverrides,
      matchingUser,
      activePersona,
      'users',
      'create',
      customScopes,
    );
  const canUpdateUser =
    activePersona === 'Administrator' ||
    activePersona === 'C Admin' ||
    canPerform(
      rolePermissionDefaults,
      userPermissionOverrides,
      matchingUser,
      activePersona,
      'users',
      'update',
      customScopes,
    );

  const visibleUsers = filterUsersForPersona(users, activePersona);

  const filteredUsers = visibleUsers.filter((u) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      u.name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.organization.toLowerCase().includes(term) ||
      u.departmentOrScope.toLowerCase().includes(term);

    const matchesRole = roleFilter === 'ALL' || userHasRole(u, roleFilter);
    const matchesType = typeFilter === 'ALL' || u.userType === typeFilter;
    const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;

    let matchesRoleTab = true;
    if (roleCategoryTab === 'Inspector') {
      matchesRoleTab = userHasRole(u, 'Inspector');
    } else if (roleCategoryTab === 'Verifier') {
      matchesRoleTab = userHasRole(u, 'Verifier');
    } else if (roleCategoryTab === 'AdminApprover') {
      matchesRoleTab = userMatchesAnyRole(u, ['C Admin', 'Administrator', 'Approver']);
    }

    return matchesSearch && matchesRole && matchesType && matchesStatus && matchesRoleTab;
  });

  const handleSort = (field: UserSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIndicator = (field: UserSortField) => {
    if (sortField !== field) return <ArrowUpDown size={13} className="text-muted ms-1 opacity-50 d-inline-block" />;
    return sortDirection === 'asc' ? <ArrowUp size={13} className="text-primary ms-1 d-inline-block" /> : <ArrowDown size={13} className="text-primary ms-1 d-inline-block" />;
  };

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    let valA: any = '';
    let valB: any = '';

    if (sortField === 'roles') {
      valA = formatUserRoles(a.roles);
      valB = formatUserRoles(b.roles);
    } else {
      valA = a[sortField] ?? '';
      valB = b[sortField] ?? '';
    }

    if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = (valB as string).toLowerCase();
    }

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const getRoleBadgeClass = (role: RoleName) => {
    switch (role) {
      case 'Administrator': return 'bg-dark text-white';
      case 'C Admin': return 'bg-info text-dark';
      case 'Submitter': return 'bg-primary text-white';
      case 'Verifier': return 'bg-warning text-dark';
      case 'Inspector': return 'bg-secondary text-white';
      case 'Approver': return 'bg-success text-white';
      default: return 'bg-light text-dark border';
    }
  };

  const getStatusBadgeClass = (status: UserProfile['status']) => {
    switch (status) {
      case 'Active': return 'bg-success text-white';
      case 'Pending Invitation': return 'bg-warning text-dark';
      case 'Inactive': return 'bg-secondary text-white';
      default: return 'bg-light text-dark border';
    }
  };

  const handleExportCsv = () => {
    const exportData = sortedUsers.map((u) => ({
      Name: u.name,
      Email: u.email,
      Role: u.roles.map(getRoleDisplayLabel).join(', '),
      UserType: u.userType,
      Organization: u.organization,
      Scope: u.departmentOrScope,
      Status: u.status,
      LastActive: u.lastActive,
    }));
    exportToCsv('Master_User_Directory', exportData);
    setIsExportOpen(false);
  };

  const handleExportPdf = () => {
    const headers = ['Name', 'Role', 'User Type', 'Organization', 'Status'];
    const rows = sortedUsers.map((u) => [
      `${u.name}\n(${u.email})`,
      formatUserRoles(u.roles),
      u.userType,
      `${u.organization}\n${u.departmentOrScope}`,
      u.status,
    ]);
    exportToPdf('Master User Directory Log', headers, rows);
    setIsExportOpen(false);
  };

  const activeFilterCount =
    (roleFilter !== 'ALL' ? 1 : 0) +
    (typeFilter !== 'ALL' ? 1 : 0) +
    (statusFilter !== 'ALL' ? 1 : 0);

  const activeChips: FilterChip[] = [
    ...(roleFilter !== 'ALL' ? [{ id: 'role', label: 'Role', value: getRoleDisplayLabel(roleFilter), onRemove: () => setRoleFilter('ALL') }] : []),
    ...(typeFilter !== 'ALL' ? [{ id: 'type', label: 'User Type', value: typeFilter, onRemove: () => setTypeFilter('ALL') }] : []),
    ...(statusFilter !== 'ALL' ? [{ id: 'status', label: 'Status', value: statusFilter, onRemove: () => setStatusFilter('ALL') }] : []),
  ];

  const handleResetFilters = () => {
    setRoleFilter('ALL');
    setTypeFilter('ALL');
    setStatusFilter('ALL');
  };

  return (
    <div className="card map-card-custom">
      {/* Table Header Controls Row: Grouped Search/Filters Left, Grouped Export/Add User Right */}
      <div className="card-header d-flex flex-wrap align-items-center justify-between gap-3 p-3">
        {/* Left Side: Search Box & Filter Button */}
        <div className="d-flex flex-wrap align-items-center gap-2">
          <input
            type="text"
            className="form-control form-control-sm bg-white text-dark border-secondary"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '260px' }}
          />

          <FilterButton
            onClick={() => setIsFilterModalOpen(true)}
            activeCount={activeFilterCount}
          />
        </div>

        {/* Opposite (Right) Side: Export & Add User Buttons on corner right of the row */}
        <div className="d-flex align-items-center gap-2 ms-auto">
          {/* Export Dropdown */}
          <div className="dropdown position-relative">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary text-dark dropdown-toggle"
              onClick={() => setIsExportOpen(!isExportOpen)}
            >
              Export
            </button>
            {isExportOpen && (
              <ul className="dropdown-menu dropdown-menu-light show position-absolute end-0 mt-1 shadow border" style={{ zIndex: 1050 }}>
                <li>
                  <button type="button" className="dropdown-item small" onClick={handleExportCsv}>
                    CSV
                  </button>
                </li>
                <li>
                  <button type="button" className="dropdown-item small" onClick={handleExportPdf}>
                    PDF
                  </button>
                </li>
              </ul>
            )}
          </div>

          {/* Add User Action Button */}
          {canCreateUser && onAddUser && (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={onAddUser}
            >
              Add User
            </button>
          )}
        </div>
      </div>

      {activeChips.length > 0 && (
        <div className="px-3 py-2 bg-light border-bottom">
          <ActiveFilterChips chips={activeChips} onClearAll={handleResetFilters} />
        </div>
      )}

      {/* User Data Table matching Assurance Sets table grid format */}
      <div className="table-responsive">
        <table className="table map-table-custom align-middle mb-0">
          <thead>
            <tr>
              <th onClick={() => handleSort('id')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                User ID {renderSortIndicator('id')}
              </th>
              <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                Name {renderSortIndicator('name')}
              </th>
              <th onClick={() => handleSort('roles')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                Role {renderSortIndicator('roles')}
              </th>
              <th onClick={() => handleSort('organization')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                Organization {renderSortIndicator('organization')}
              </th>
              <th onClick={() => handleSort('status')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                Status {renderSortIndicator('status')}
              </th>
              <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-4 text-muted">
                  No users found.
                </td>
              </tr>
            ) : (
              sortedUsers.map((u) => (
                <tr key={u.id}>
                  <td className="font-mono-code fw-semibold text-primary">{u.id}</td>
                  <td>
                    <div className="fw-semibold text-dark">{u.name}</div>
                    <div className="small font-mono-code text-muted">{u.email}</div>
                  </td>
                  <td>
                    <div className="d-flex flex-wrap align-items-center gap-1">
                      {u.roles.map((role) => (
                        <span key={role} className={`badge ${getRoleBadgeClass(role)}`}>
                          {getRoleDisplayLabel(role)}
                        </span>
                      ))}
                      <span className={`badge ${u.userType === 'Organization' ? 'bg-light text-secondary border' : 'bg-info-subtle text-info-emphasis border border-info-subtle'}`} style={{ fontSize: '0.7rem' }}>
                        {u.userType}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="fw-semibold text-dark">{u.organization}</div>
                    <div className="small text-muted">{u.departmentOrScope}</div>
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadgeClass(u.status)}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="text-end">
                    {canUpdateUser && (
                      <div className="d-flex align-items-center justify-content-end gap-1.5">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                          style={{ width: '32px', height: '32px' }}
                          onClick={() => setEditingUser(u)}
                          title="Edit"
                          aria-label="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        {u.status === 'Active' ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center p-0"
                            style={{ width: '32px', height: '32px' }}
                            onClick={() => updateUserStatus(u.id, 'Inactive')}
                            title="Deactivate"
                            aria-label="Deactivate"
                          >
                            <UserX size={16} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success d-inline-flex align-items-center justify-content-center p-0"
                            style={{ width: '32px', height: '32px' }}
                            onClick={() => updateUserStatus(u.id, 'Active')}
                            title="Activate"
                            aria-label="Activate"
                          >
                            <UserCheck size={16} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* User Directory Filter Modal */}
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onReset={handleResetFilters}
        title="Filters"
        activeCount={activeFilterCount}
      >
        <div className="card p-3 bg-white border rounded">
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label small fw-semibold text-secondary mb-1">Role</label>
              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="ALL">All Roles</option>
                {activePersona !== 'C Admin' && <option value="Administrator">{getRoleDisplayLabel('Administrator')}</option>}
                <option value="Submitter">Submitter</option>
                <option value="Verifier">Verifier</option>
                <option value="Inspector">Inspector</option>
                <option value="Approver">Approver</option>
                <option value="C Admin">{getRoleDisplayLabel('C Admin')}</option>
                {customRoles.map((role) => (
                  <option key={role} value={role}>
                    {getRoleDisplayLabel(role)}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-semibold text-secondary mb-1">User Type</label>
              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="ALL">All Types</option>
                <option value="Organization">Organization</option>
                <option value="Third-Party">Third-Party</option>
              </select>
            </div>

            <div className="col-12">
              <label className="form-label small fw-semibold text-secondary mb-1">Status</label>
              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Pending Invitation">Pending</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>
      </FilterModal>

      {/* Edit User Modal */}
      <EditUserModal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        user={editingUser}
      />
    </div>
  );
};
