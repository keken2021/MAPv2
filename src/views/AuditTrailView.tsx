/* 
  file summary: Audit Trail page view displaying searchable regulatory event logs in minimalist light theme.
  responsibilities: presents chronological audit history with user roles, field deltas, event statistics, and search filters with high contrast text.
  role in system: primary audit workspace accessible via sidebar (/audit).
*/

import React, { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useMapStore } from '../store/useMapStore';
import { formatMaritimeDate } from '../utils/formatters';
import { filterAuditTrailForPersona } from '../utils/rbacHelpers';
import { getRoleDisplayLabel } from '../utils/userRoleHelpers';
import { exportToCsv, exportToPdf } from '../utils/exportHelpers';
import { FilterModal } from '../components/common/FilterModal';
import { FilterButton } from '../components/common/FilterButton';
import { ActiveFilterChips, FilterChip } from '../components/common/ActiveFilterChips';

/**
  what: renders the full-page Audit Trail view in clean light theme with data export capabilities.
  how: fetches auditEvents array from zustand store, filters items based on persona RBAC rules and search query, and provides export to CSV/PDF.
  with what file: src/views/AuditTrailView.tsx loaded by App.tsx router.
*/
export const AuditTrailView: React.FC = () => {
  const { auditEvents, activePersona, assuranceSets, vessels } = useMapStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

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

  const visibleEvents = filterAuditTrailForPersona(auditEvents, activePersona, assuranceSets, vessels);

  const filteredEvents = visibleEvents.filter((ev) => {
    const matchesSearch =
      ev.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.targetAsset.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.userRole.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ev.justificationNotes && ev.justificationNotes.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesRole = roleFilter === 'ALL' || ev.userRole === roleFilter;
    return matchesSearch && matchesRole;
  });

  const sortedEvents = [...filteredEvents].sort((a, b) => {
    let comp = 0;
    if (sortField === 'timestampUtc') comp = new Date(a.timestampUtc).getTime() - new Date(b.timestampUtc).getTime();
    else if (sortField === 'action') comp = a.action.localeCompare(b.action);
    else if (sortField === 'targetAsset') comp = a.targetAsset.localeCompare(b.targetAsset);
    else if (sortField === 'userRole') comp = `${a.userRole} ${a.organization}`.localeCompare(`${b.userRole} ${b.organization}`);
    else if (sortField === 'fieldDelta') comp = (a.fieldDelta ? a.fieldDelta.fieldName : '').localeCompare(b.fieldDelta ? b.fieldDelta.fieldName : '');
    else if (sortField === 'justificationNotes') comp = (a.justificationNotes || '').localeCompare(b.justificationNotes || '');
    return sortDirection === 'asc' ? comp : -comp;
  });

  const handleExportCsv = () => {
    const exportData = sortedEvents.map((ev) => ({
      TimestampUtc: ev.timestampUtc,
      Action: ev.action,
      TargetAsset: ev.targetAsset,
      UserRole: ev.userRole,
      Organization: ev.organization,
      Notes: ev.justificationNotes || '',
    }));
    exportToCsv('System_Audit_Trail', exportData);
    setIsExportOpen(false);
  };

  const handleExportPdf = () => {
    const headers = ['Timestamp (UTC)', 'Action', 'Asset', 'Role', 'Notes'];
    const rows = sortedEvents.map((ev) => [
      ev.timestampUtc,
      ev.action,
      ev.targetAsset,
      `${getRoleDisplayLabel(ev.userRole)} (${ev.organization})`,
      ev.justificationNotes || '-',
    ]);
    exportToPdf('Audit Trail', headers, rows);
    setIsExportOpen(false);
  };

  const activeFilterCount = (roleFilter !== 'ALL' ? 1 : 0);

  const activeChips: FilterChip[] = [
    ...(roleFilter !== 'ALL' ? [{ id: 'role', label: 'Role', value: getRoleDisplayLabel(roleFilter), onRemove: () => setRoleFilter('ALL') }] : []),
  ];

  const handleResetFilters = () => {
    setRoleFilter('ALL');
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Main Audit Card */}
      <div className="card map-card-custom">
        {/* Controls Row */}
        <div className="card-header d-flex flex-wrap align-items-center justify-between gap-3 p-3">
          <div className="d-flex flex-wrap align-items-center gap-2">
            <input
              type="text"
              className="form-control form-control-sm bg-white text-dark border-secondary"
              placeholder="Search audit trail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '320px' }}
            />
            <FilterButton
              onClick={() => setIsFilterModalOpen(true)}
              activeCount={activeFilterCount}
            />
          </div>

          <div className="d-flex align-items-center gap-3 ms-auto">
            <div className="text-secondary small">
              Showing <strong className="text-dark">{filteredEvents.length}</strong> of {visibleEvents.length} logs
            </div>
            <div className="dropdown position-relative">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary text-dark dropdown-toggle"
                onClick={() => setIsExportOpen(!isExportOpen)}
              >
                Export
              </button>
              {isExportOpen && (
                <ul className="dropdown-menu dropdown-menu-light show position-absolute end-0 mt-1 shadow border">
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
          </div>
        </div>

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
                  Asset {renderSortIndicator('targetAsset')}
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
              {sortedEvents.map((ev) => (
                <tr key={ev.id}>
                  <td className="font-mono-code small text-nowrap">{formatMaritimeDate(ev.timestampUtc)}</td>
                  <td>
                    <span className="fw-semibold text-primary">{ev.action}</span>
                  </td>
                  <td>
                    <strong className="text-slate-900">{ev.targetAsset}</strong>
                  </td>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <span className="badge bg-info text-dark font-mono-code" style={{ fontSize: '0.75rem' }}>
                        {getRoleDisplayLabel(ev.userRole)}
                      </span>
                      <span className="text-secondary small">{ev.organization}</span>
                    </div>
                  </td>
                  <td>
                    {ev.fieldDelta ? (
                      <div className="p-2 bg-light rounded font-mono-code small border border-secondary" style={{ fontSize: '0.75rem' }}>
                        <div className="fw-bold text-dark">Field: {ev.fieldDelta.fieldName}</div>
                        <div className="text-danger">Old: {ev.fieldDelta.oldValue}</div>
                        <div className="text-success">New: {ev.fieldDelta.newValue}</div>
                      </div>
                    ) : (
                      <span className="text-muted small">No change</span>
                    )}
                  </td>
                  <td className="small text-secondary fst-italic">
                    {ev.justificationNotes ? `"${ev.justificationNotes}"` : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
          </div>
        </div>
      </FilterModal>
    </div>
  );
};
