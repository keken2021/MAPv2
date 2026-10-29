/* 
  file summary: master user directory table component matching exact assurance sets table format and header controls layout.
  responsibilities: presents names, emails, role badges, organization scopes, classification badges, export controls, and user addition triggers.
  role in system: main data table component for UserManagementView.tsx.
*/

import React, { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Pencil, UserX, UserCheck } from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import { UserProfile, UserRolePersona } from '../../types/user';
import { FilterModal } from '../common/FilterModal';
import { CountTabs } from '../common/CountTabs';
import { ListToolbar } from '../common/ListToolbar';
import { StatusBadge } from '../common/StatusBadge';
import { ActiveFilterChips, FilterChip } from '../common/ActiveFilterChips';
import { exportToCsv, exportToPdf } from '../../utils/exportHelpers';
import { EditUserModal } from '../modals/EditUserModal';
import { canPerform } from '../../utils/permissionHelpers';

import { filterUsersForPersona } from '../../utils/rbacHelpers';
import { formatUserRoles, getRoleDisplayLabel, userHasRole } from '../../utils/userRoleHelpers';
import { usePagination } from '../../utils/usePagination';
import { TablePagination } from '../common/TablePagination';

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
}

/**
  what: renders master user directory table matching assurance sets table layout with column sorting.
  how: filters users array by search query, persona isolation rules, role category tabs, and classification, with column sorting and export to CSV/PDF.
  with what file: src/components/tables/UserTable.tsx loaded by UserManagementView.tsx.
*/
export const UserTable: React.FC<UserTableProps> = ({ onAddUser }) => {
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

    return matchesSearch && matchesRole && matchesType && matchesStatus;
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

  const usersPagination = usePagination(sortedUsers, [searchTerm, roleFilter, typeFilter, statusFilter, sortField, sortDirection]);

  const userTabs = [
    { key: 'ALL', label: 'All', count: visibleUsers.length },
    {
      key: 'Organization',
      label: 'Organization',
      count: visibleUsers.filter((user) => user.userType === 'Organization').length,
    },
    {
      key: 'Third-Party',
      label: 'Third-Party',
      count: visibleUsers.filter((user) => user.userType === 'Third-Party').length,
    },
  ];
  const activeUserTab = userTabs.some((tab) => tab.key === typeFilter) ? typeFilter : '';

  return (
    <div className="card map-card-custom">
      <div className="p-3 border-bottom">
        <CountTabs
          tabs={userTabs}
          active={activeUserTab}
          onChange={setTypeFilter}
          aria-label="User tabs"
        />
      </div>
      <ListToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search users..."
        onFilterClick={() => setIsFilterModalOpen(true)}
        activeFilterCount={activeFilterCount}
        onExportCsv={handleExportCsv}
        onExportPdf={handleExportPdf}
        primaryAction={
          canCreateUser && onAddUser ? (
            <button type="button" className="btn btn-sm btn-primary" onClick={onAddUser}>
              Add User
            </button>
          ) : undefined
        }
      />

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
              usersPagination.pageItems.map((u) => (
                <tr key={u.id}>
                  <td className="font-mono-code fw-semibold text-primary text-nowrap">{u.id}</td>
                  <td className="text-nowrap">
                    <span className="fw-semibold text-dark">{u.name}</span>
                    <span className="small font-mono-code text-muted ms-2">{u.email}</span>
                  </td>
                  <td className="small text-nowrap">
                    {formatUserRoles(u.roles)}
                    {u.userType ? ` · ${u.userType}` : ''}
                  </td>
                  <td className="text-nowrap">
                    <span className="fw-semibold text-dark">{u.organization}</span>
                    {u.departmentOrScope ? <span className="text-muted"> · {u.departmentOrScope}</span> : null}
                  </td>
                  <td>
                    <StatusBadge value={u.status} />
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
      <TablePagination {...usersPagination.controls} />

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
