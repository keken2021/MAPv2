/* 
  file summary: Audit Trail page view displaying searchable regulatory event logs in minimalist light theme.
  responsibilities: presents chronological audit history with user roles, field deltas, event statistics, and search filters with high contrast text.
  role in system: primary audit workspace accessible via sidebar (/audit).
*/

import React, { useMemo, useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useMapStore } from '../store/useMapStore';
import { formatMaritimeDate } from '../utils/formatters';
import { auditEventMatchesSearch, formatAuditTarget } from '../types/audit';
import { filterAuditTrailForPersona } from '../utils/rbacHelpers';
import {
  getDemoSessionContext,
  getRoleDisplayLabel,
  getSessionUserForPersona,
  pickSessionUserForOrgPersona,
} from '../utils/userRoleHelpers';
import { exportToCsv, exportToPdf } from '../utils/exportHelpers';
import { FilterModal } from '../components/common/FilterModal';
import { ListToolbar } from '../components/common/ListToolbar';
import { ActiveFilterChips, FilterChip } from '../components/common/ActiveFilterChips';
import { usePagination } from '../utils/usePagination';
import { TablePagination } from '../components/common/TablePagination';

/**
  what: renders the full-page Audit Trail view in clean light theme with data export capabilities.
  how: fetches auditEvents array from zustand store, filters items based on persona RBAC rules and search query, and provides export to CSV/PDF.
  with what file: src/views/AuditTrailView.tsx loaded by App.tsx router.
*/
export const AuditTrailView: React.FC = () => {
  const {
    auditEvents,
    activePersona,
    activeDemoOrganization,
    activeSessionUserId,
    users,
    assuranceSets,
    vessels,
    logExport,
  } = useMapStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [targetKindFilter, setTargetKindFilter] = useState<'ALL' | 'set' | 'task' | 'date'>('ALL');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  const sessionUser = useMemo(
    () =>
      getSessionUserForPersona(
        activePersona,
        users,
        getDemoSessionContext({ activeDemoOrganization, activeSessionUserId }),
      ) ?? pickSessionUserForOrgPersona(users, activeDemoOrganization, activePersona),
    [activePersona, users, activeDemoOrganization, activeSessionUserId],
  );

  const currentUserId = sessionUser?.id || activeSessionUserId;

  type AuditSortField = 'timestampUtc' | 'action' | 'targetAsset' | 'userRole' | 'fieldDelta' | 'justificationNotes';
  const [sortField, setSortField] = useState<AuditSortField>('timestampUtc');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const renderSortIndicator = (field: AuditSortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={14} className="text-muted ms-1 opacity-50 inline-block align-middle" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp size={14} className="text-primary ms-1 inline-block align-middle" />
    ) : (
      <ArrowDown size={14} className="text-primary ms-1 inline-block align-middle" />
    );
  };

  const handleSort = (field: AuditSortField) => {
    if (sortField === field) {
      setSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const visibleEvents = filterAuditTrailForPersona(
    auditEvents,
    activePersona,
    assuranceSets,
    vessels,
    currentUserId,
  );

  const filteredEvents = visibleEvents.filter((ev) => {
    const matchesSearch = auditEventMatchesSearch(ev, searchTerm);
    const matchesRole = roleFilter === 'ALL' || ev.userRole === roleFilter;
    const matchesTarget = targetKindFilter === 'ALL' || ev.target.kind === targetKindFilter;
    return matchesSearch && matchesRole && matchesTarget;
  });

  const sortedEvents = [...filteredEvents].sort((a, b) => {
    let comp = 0;
    if (sortField === 'timestampUtc') comp = new Date(a.timestampUtc).getTime() - new Date(b.timestampUtc).getTime();
    else if (sortField === 'action') comp = a.action.localeCompare(b.action);
    else if (sortField === 'targetAsset') comp = formatAuditTarget(a.target).localeCompare(formatAuditTarget(b.target));
    else if (sortField === 'userRole') comp = `${a.userRole} ${a.organization}`.localeCompare(`${b.userRole} ${b.organization}`);
    else if (sortField === 'fieldDelta') comp = (a.fieldDelta ? a.fieldDelta.fieldName : '').localeCompare(b.fieldDelta ? b.fieldDelta.fieldName : '');
    else if (sortField === 'justificationNotes') comp = (a.justificationNotes || '').localeCompare(b.justificationNotes || '');
    return sortDirection === 'asc' ? comp : -comp;
  });

  const exportSetId = (() => {
    const ids = new Set(
      sortedEvents
        .map((ev) => ev.target.setId)
        .filter((id) => id !== 'unscoped' && id !== 'multiple'),
    );
    return ids.size === 1 ? [...ids][0] : undefined;
  })();

  const handleExportCsv = () => {
    const exportData = sortedEvents.map((ev) => ({
      TimestampUtc: ev.timestampUtc,
      Action: ev.action,
      Target: formatAuditTarget(ev.target),
      TargetAsset: ev.targetAsset,
      UserRole: ev.userRole,
      Organization: ev.organization,
      Notes: ev.justificationNotes || '',
    }));
    exportToCsv('System_Audit_Trail', exportData);
    logExport({
      screen: 'Audit trail',
      format: 'CSV',
      setId: exportSetId,
      detail: `${sortedEvents.length} events`,
    });
  };

  const handleExportPdf = () => {
    const headers = ['Timestamp (UTC)', 'Action', 'Target', 'Role', 'Notes'];
    const rows = sortedEvents.map((ev) => [
      ev.timestampUtc,
      ev.action,
      formatAuditTarget(ev.target),
      `${getRoleDisplayLabel(ev.userRole)} (${ev.organization})`,
      ev.justificationNotes || '-',
    ]);
    exportToPdf('Audit Trail', headers, rows);
    logExport({
      screen: 'Audit trail',
      format: 'PDF',
      setId: exportSetId,
      detail: `${sortedEvents.length} events`,
    });
  };

  const activeFilterCount = (roleFilter !== 'ALL' ? 1 : 0) + (targetKindFilter !== 'ALL' ? 1 : 0);

  const activeChips: FilterChip[] = [
    ...(roleFilter !== 'ALL' ? [{ id: 'role', label: 'Role', value: getRoleDisplayLabel(roleFilter), onRemove: () => setRoleFilter('ALL') }] : []),
    ...(targetKindFilter !== 'ALL' ? [{ id: 'target', label: 'Target', value: targetKindFilter, onRemove: () => setTargetKindFilter('ALL') }] : []),
  ];

  const handleResetFilters = () => {
    setRoleFilter('ALL');
    setTargetKindFilter('ALL');
  };

  const eventsPagination = usePagination(sortedEvents, [searchTerm, roleFilter, targetKindFilter, sortField, sortDirection]);

  return (
    <div className="d-flex flex-column gap-4">
      {/* Main Audit Card */}
      <div className="card map-card-custom">
        <ListToolbar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search audit trail..."
          onFilterClick={() => setIsFilterModalOpen(true)}
          activeFilterCount={activeFilterCount}
          onExportCsv={handleExportCsv}
          onExportPdf={handleExportPdf}
        />

        {activeChips.length > 0 && (
          <div className="px-3 py-2 bg-light border-bottom">
            <ActiveFilterChips chips={activeChips} onClearAll={handleResetFilters} />
          </div>
        )}

        {/* Audit Log Table */}
        <div className="table-responsive">
          <table className="table map-table-custom align-middle mb-0">
            <thead>
              <tr>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handleSort('timestampUtc')}
                >
                  Timestamp (UTC) {renderSortIndicator('timestampUtc')}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handleSort('action')}
                >
                  Action {renderSortIndicator('action')}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handleSort('targetAsset')}
                >
                  Target {renderSortIndicator('targetAsset')}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handleSort('userRole')}
                >
                  Role {renderSortIndicator('userRole')}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handleSort('fieldDelta')}
                >
                  Change {renderSortIndicator('fieldDelta')}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handleSort('justificationNotes')}
                >
                  Notes {renderSortIndicator('justificationNotes')}
                </th>
              </tr>
            </thead>
            <tbody>
              {eventsPagination.pageItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-secondary small">
                    No audit entries found.
                  </td>
                </tr>
              ) : (
                eventsPagination.pageItems.map((ev) => (
                  <tr key={ev.id}>
                    <td className="font-mono-code small text-nowrap">{formatMaritimeDate(ev.timestampUtc)}</td>
                    <td className="fw-semibold text-primary text-nowrap">{ev.action}</td>
                    <td className="text-dark text-nowrap">{formatAuditTarget(ev.target)}</td>
                    <td className="small text-dark text-nowrap">
                      {getRoleDisplayLabel(ev.userRole)}
                      <span className="text-secondary"> · {ev.organization}</span>
                    </td>
                    <td className="small text-dark text-nowrap">
                      {ev.fieldDelta
                        ? `${ev.fieldDelta.fieldName}: ${ev.fieldDelta.oldValue} → ${ev.fieldDelta.newValue}`
                        : 'No change'}
                    </td>
                    <td className="small text-secondary text-nowrap">
                      {ev.justificationNotes?.trim() ? ev.justificationNotes : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePagination {...eventsPagination.controls} />
      </div>

      {/* Audit Trail Filter Modal */}
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onReset={handleResetFilters}
        title="Filters"
        activeCount={activeFilterCount}
      >
        <div className="card p-3 bg-white border rounded">
          <div className="row g-3">
            <div className="col-12">
              <label className="form-label small fw-semibold text-secondary mb-1">Role</label>
              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="ALL">All Roles</option>
                <option value="Administrator">{getRoleDisplayLabel('Administrator')}</option>
                <option value="C Admin">{getRoleDisplayLabel('C Admin')}</option>
                <option value="Submitter">Submitter</option>
                <option value="Verifier">Verifier</option>
                <option value="Inspector">Inspector</option>
                <option value="Approver">Approver</option>
              </select>
            </div>
            <div className="col-12">
              <label className="form-label small fw-semibold text-secondary mb-1">Target</label>
              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={targetKindFilter}
                onChange={(e) => setTargetKindFilter(e.target.value as 'ALL' | 'set' | 'task' | 'date')}
              >
                <option value="ALL">All targets</option>
                <option value="set">Set</option>
                <option value="task">Task</option>
                <option value="date">Date</option>
              </select>
            </div>
          </div>
        </div>
      </FilterModal>
    </div>
  );
};
