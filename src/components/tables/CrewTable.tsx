/* 
  file summary: master crew directory table component matching exact assurance sets table format, header controls layout, and interactive column sorting.
  responsibilities: presents crew ids, full names, ranks, current vessel assignments, stcw compliance badges, multi-column sorting by header clicks, export controls, and registration triggers.
  role in system: main data table component for CrewView.tsx.
*/

import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Eye, FilePlus } from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import { CrewMember } from '../../types/crew';
import { FilterModal } from '../common/FilterModal';
import { CountTabs } from '../common/CountTabs';
import { ListToolbar } from '../common/ListToolbar';
import { StatusBadge } from '../common/StatusBadge';
import { ActiveFilterChips, FilterChip } from '../common/ActiveFilterChips';
import { formatMaritimeDate, getStatusDisplayLabel } from '../../utils/formatters';
import { exportToCsv, exportToPdf } from '../../utils/exportHelpers';
import { canPerform } from '../../utils/permissionHelpers';
import { usePagination } from '../../utils/usePagination';
import { TablePagination } from '../common/TablePagination';
import { maskRestrictedValue } from '../../utils/restrictedData';

type CrewSortField =
  | 'id'
  | 'fullName'
  | 'currentVesselName'
  | 'nationality'
  | 'complianceStatus'
  | 'lastAuditedDate';

interface CrewTableProps {
  onSelectCrew: (crew: CrewMember) => void;
  onRegisterCrew?: () => void;
  onAddDocumentCrew?: (crew: CrewMember) => void;
}

/**
  what: renders master crew directory table matching assurance sets table layout with column sorting.
  how: filters crew array by search query, rank position, and STCW compliance status badge, then sorts by sortField.
  with what file: src/components/tables/CrewTable.tsx loaded by CrewView.tsx.
*/
export const CrewTable: React.FC<CrewTableProps> = ({
  onSelectCrew,
  onRegisterCrew,
  onAddDocumentCrew,
}) => {
  const {
    crew,
    vessels,
    users,
    activePersona,
    rolePermissionDefaults,
    userPermissionOverrides,
    customScopes,
  } = useMapStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [rankFilter, setRankFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [vesselFilter, setVesselFilter] = useState<string>('ALL');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [sortField, setSortField] = useState<CrewSortField>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const matchingUser = users.find((u) => u.roles.includes(activePersona)) ?? null;
  const canRegisterCrew =
    activePersona === 'Administrator' ||
    activePersona === 'Submitter' ||
    canPerform(
      rolePermissionDefaults,
      userPermissionOverrides,
      matchingUser,
      activePersona,
      'crew',
      'create',
      customScopes,
    );
  const canManageCrew =
    activePersona === 'Administrator' ||
    activePersona === 'Submitter' ||
    canPerform(
      rolePermissionDefaults,
      userPermissionOverrides,
      matchingUser,
      activePersona,
      'crew',
      'update',
      customScopes,
    );

  const filteredCrew = crew.filter((c) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      c.id.toLowerCase().includes(term) ||
      c.fullName.toLowerCase().includes(term) ||
      c.rank.toLowerCase().includes(term) ||
      c.seamansBookNo.toLowerCase().includes(term) ||
      (c.currentVesselName && c.currentVesselName.toLowerCase().includes(term));

    const matchesRank = rankFilter === 'ALL' || c.rank.toLowerCase().includes(rankFilter.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || c.complianceStatus === statusFilter;
    const matchesVessel =
      vesselFilter === 'ALL' ||
      (vesselFilter === 'UNASSIGNED' ? !c.currentVesselId : c.currentVesselId === vesselFilter || c.currentVesselName === vesselFilter);

    return matchesSearch && matchesRank && matchesStatus && matchesVessel;
  });

  const activeFilterCount =
    (rankFilter !== 'ALL' ? 1 : 0) +
    (statusFilter !== 'ALL' ? 1 : 0) +
    (vesselFilter !== 'ALL' ? 1 : 0);

  const activeChips: FilterChip[] = [
    ...(rankFilter !== 'ALL' ? [{ id: 'rank', label: 'Rank', value: rankFilter, onRemove: () => setRankFilter('ALL') }] : []),
    ...(statusFilter !== 'ALL' ? [{ id: 'status', label: 'Compliance', value: getStatusDisplayLabel(statusFilter), onRemove: () => setStatusFilter('ALL') }] : []),
    ...(vesselFilter !== 'ALL' ? [{ id: 'vessel', label: 'Vessel', value: vesselFilter === 'UNASSIGNED' ? 'Unassigned' : vesselFilter, onRemove: () => setVesselFilter('ALL') }] : []),
  ];

  const handleResetFilters = () => {
    setRankFilter('ALL');
    setStatusFilter('ALL');
    setVesselFilter('ALL');
  };

  const handleSort = (field: CrewSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIndicator = (field: CrewSortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={14} className="text-muted ms-1 opacity-50 inline-block align-middle" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp size={14} className="text-primary ms-1 inline-block align-middle" />
    ) : (
      <ArrowDown size={14} className="text-primary ms-1 inline-block align-middle" />
    );
  };

  const sortedCrew = [...filteredCrew].sort((a, b) => {
    let valA: any = '';
    let valB: any = '';

    if (sortField === 'lastAuditedDate') {
      valA = new Date(a.lastAuditedDate).getTime() || 0;
      valB = new Date(b.lastAuditedDate).getTime() || 0;
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
    const exportData = sortedCrew.map((c) => ({
      CrewID: c.id,
      FullName: c.fullName,
      Rank: c.rank,
      CurrentVessel: c.currentVesselName || 'Unassigned / Ashore',
      Nationality: c.nationality,
      SeamansBookNo: c.seamansBookNo,
      /* restricted identity data leaves the platform masked (gap review G12) */
      PassportNo: maskRestrictedValue(c.passportNo),
      Compliance: getStatusDisplayLabel(c.complianceStatus),
      ComplianceScore: `${c.overallComplianceScore}%`,
      LastAuditedDate: c.lastAuditedDate,
    }));
    exportToCsv('Master_Crew_Directory', exportData);
  };

  const handleExportPdf = () => {
    const headers = ['Crew ID', 'Name', 'Vessel', 'Seaman Book', 'Compliance', 'Readiness'];
    const rows = sortedCrew.map((c) => [
      c.id,
      `${c.fullName}\n(${c.rank})`,
      c.currentVesselName || 'Unassigned',
      `${c.nationality}\n${c.seamansBookNo}`,
      getStatusDisplayLabel(c.complianceStatus),
      `${c.overallComplianceScore}%`,
    ]);
    exportToPdf('Crew Directory', headers, rows);
  };

  const crewPagination = usePagination(sortedCrew, [searchTerm, rankFilter, statusFilter, vesselFilter, sortField, sortDirection]);

  const crewTabs = [
    { key: 'ALL', label: 'All', count: crew.length },
    {
      key: 'Fully Compliant',
      label: 'Compliant',
      count: crew.filter((member) => member.complianceStatus === 'Fully Compliant').length,
    },
    {
      key: 'Expiring < 60 Days',
      label: 'Expiring Soon',
      count: crew.filter((member) => member.complianceStatus === 'Expiring < 60 Days').length,
      tone: 'warn' as const,
    },
    {
      key: 'Document Deficient',
      label: 'Non-Compliant',
      count: crew.filter((member) => member.complianceStatus === 'Document Deficient').length,
    },
  ];
  const activeCrewTab = crewTabs.some((tab) => tab.key === statusFilter) ? statusFilter : '';

  return (
    <div className="card map-card-custom">
      <div className="p-3 border-bottom">
        <CountTabs
          tabs={crewTabs}
          active={activeCrewTab}
          onChange={setStatusFilter}
          aria-label="Crew tabs"
        />
      </div>
      <ListToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search crew..."
        onFilterClick={() => setIsFilterModalOpen(true)}
        activeFilterCount={activeFilterCount}
        onExportCsv={handleExportCsv}
        onExportPdf={handleExportPdf}
        primaryAction={
          canRegisterCrew && onRegisterCrew ? (
            <button type="button" className="btn btn-sm btn-primary" onClick={onRegisterCrew}>
              Add Crew
            </button>
          ) : undefined
        }
      />

      {activeChips.length > 0 && (
        <div className="px-3 py-2 bg-light border-bottom">
          <ActiveFilterChips chips={activeChips} onClearAll={handleResetFilters} />
        </div>
      )}

      {/* Master Crew Data Table matching Assurance Sets table grid format */}
      <div className="table-responsive">
        <table className="table map-table-custom align-middle mb-0">
          <thead>
            <tr>
              <th onClick={() => handleSort('id')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                Crew ID {renderSortIndicator('id')}
              </th>
              <th onClick={() => handleSort('fullName')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                Name {renderSortIndicator('fullName')}
              </th>
              <th onClick={() => handleSort('currentVesselName')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                Vessel {renderSortIndicator('currentVesselName')}
              </th>
              <th onClick={() => handleSort('nationality')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                Nationality {renderSortIndicator('nationality')}
              </th>
              <th onClick={() => handleSort('complianceStatus')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                Compliance {renderSortIndicator('complianceStatus')}
              </th>
              <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedCrew.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-4 text-muted">
                  No crew found.
                </td>
              </tr>
            ) : (
              crewPagination.pageItems.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => onSelectCrew(c)}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="font-mono-code fw-semibold text-primary">{c.id}</td>
                  <td className="fw-semibold text-dark text-nowrap">{c.fullName}</td>
                  <td className="text-nowrap">{c.currentVesselName || 'Unassigned'}</td>
                  <td className="text-nowrap">
                    {c.nationality}
                    <span className="font-mono-code text-secondary ms-2">{c.seamansBookNo}</span>
                  </td>
                  <td>
                    <StatusBadge value={c.complianceStatus} />
                  </td>
                  <td className="text-end">
                    <div className="d-flex align-items-center justify-content-end gap-1.5">
                      {canManageCrew && onAddDocumentCrew && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-success d-inline-flex align-items-center justify-content-center p-0"
                          style={{ width: '32px', height: '32px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddDocumentCrew(c);
                          }}
                          title="Upload document"
                          aria-label="Upload document"
                        >
                          <FilePlus size={16} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                        style={{ width: '32px', height: '32px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCrew(c);
                        }}
                        title="View"
                        aria-label="View"
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <TablePagination {...crewPagination.controls} />

      {/* Crew Filter Modal */}
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
              <label className="form-label small fw-semibold text-secondary mb-1">Rank</label>
              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={rankFilter}
                onChange={(e) => setRankFilter(e.target.value)}
              >
                <option value="ALL">All Ranks</option>
                <option value="Master">Master</option>
                <option value="Chief Officer">Chief Officer</option>
                <option value="Engineer">Engine Officers</option>
                <option value="Bosun">Deck Crew</option>
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-semibold text-secondary mb-1">Compliance</label>
              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="Fully Compliant">Compliant</option>
                <option value="Expiring < 60 Days">Expiring Soon</option>
                <option value="Document Deficient">Non-Compliant</option>
              </select>
            </div>

            <div className="col-12">
              <label className="form-label small fw-semibold text-secondary mb-1">Vessel</label>
              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={vesselFilter}
                onChange={(e) => setVesselFilter(e.target.value)}
              >
                <option value="ALL">All Vessels</option>
                <option value="UNASSIGNED">Unassigned</option>
                {vessels.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.flagState})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </FilterModal>
    </div>
  );
};

