/* 
  file summary: master crew directory table component matching exact assurance sets table format, header controls layout, and interactive column sorting.
  responsibilities: presents crew ids, full names, ranks, current vessel assignments, stcw compliance badges, multi-column sorting by header clicks, export controls, and registration triggers.
  role in system: main data table component for CrewView.tsx.
*/

import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Eye, FilePlus } from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import { CrewMember, CrewComplianceStatus } from '../../types/crew';
import { FilterModal } from '../common/FilterModal';
import { FilterButton } from '../common/FilterButton';
import { ActiveFilterChips, FilterChip } from '../common/ActiveFilterChips';
import { formatMaritimeDate } from '../../utils/formatters';
import { exportToCsv, exportToPdf } from '../../utils/exportHelpers';
import { canPerform } from '../../utils/permissionHelpers';
import { getCrewStockPhoto } from '../../utils/vesselImageHelpers';

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
  const [isExportOpen, setIsExportOpen] = useState(false);

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
    ...(statusFilter !== 'ALL' ? [{ id: 'status', label: 'Status', value: statusFilter, onRemove: () => setStatusFilter('ALL') }] : []),
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

  const getComplianceBadgeClass = (status: CrewComplianceStatus) => {
    switch (status) {
      case 'Fully Compliant': return 'bg-success text-white';
      case 'Expiring < 60 Days': return 'bg-warning text-dark';
      case 'Document Deficient': return 'bg-danger text-white';
      default: return 'bg-light text-dark border';
    }
  };

  const handleExportCsv = () => {
    const exportData = sortedCrew.map((c) => ({
      CrewID: c.id,
      FullName: c.fullName,
      Rank: c.rank,
      CurrentVessel: c.currentVesselName || 'Unassigned / Ashore',
      Nationality: c.nationality,
      SeamansBookNo: c.seamansBookNo,
      PassportNo: c.passportNo,
      ComplianceStatus: c.complianceStatus,
      ComplianceScore: `${c.overallComplianceScore}%`,
      LastAuditedDate: c.lastAuditedDate,
    }));
    exportToCsv('Master_Crew_Directory', exportData);
    setIsExportOpen(false);
  };

  const handleExportPdf = () => {
    const headers = ['Crew ID', 'Full Name & Rank', 'Current Vessel', 'Seaman Book', 'Status', 'Score'];
    const rows = sortedCrew.map((c) => [
      c.id,
      `${c.fullName}\n(${c.rank})`,
      c.currentVesselName || 'Unassigned',
      `${c.nationality}\n${c.seamansBookNo}`,
      c.complianceStatus,
      `${c.overallComplianceScore}%`,
    ]);
    exportToPdf('Master Crew Directory STCW Report', headers, rows);
    setIsExportOpen(false);
  };

  return (
    <div className="card map-card-custom">
      {/* Table Header Controls Row: Grouped Search/Filters Left, Grouped Export/Register Right */}
      <div className="card-header d-flex flex-wrap align-items-center justify-between gap-3 p-3">
        {/* Left Side: Search Box & Filter Button */}
        <div className="d-flex flex-wrap align-items-center gap-2">
          <input
            type="text"
            className="form-control form-control-sm bg-white text-dark border-secondary"
            placeholder="Search Crew ID, Name, Rank, Vessel..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '270px' }}
          />

          <FilterButton
            onClick={() => setIsFilterModalOpen(true)}
            activeCount={activeFilterCount}
          />
        </div>

        {/* Opposite (Right) Side: Export & Register Buttons on corner right of the row */}
        <div className="d-flex align-items-center gap-2 ms-auto">
          {/* Export Dropdown */}
          <div className="dropdown position-relative">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary text-dark dropdown-toggle"
              onClick={() => setIsExportOpen(!isExportOpen)}
            >
              Export Data
            </button>
            {isExportOpen && (
              <ul className="dropdown-menu dropdown-menu-light show position-absolute end-0 mt-1 shadow border" style={{ zIndex: 1050 }}>
                <li>
                  <button type="button" className="dropdown-item small" onClick={handleExportCsv}>
                    Export as CSV (.csv)
                  </button>
                </li>
                <li>
                  <button type="button" className="dropdown-item small" onClick={handleExportPdf}>
                    Export as PDF (.pdf)
                  </button>
                </li>
              </ul>
            )}
          </div>

          {/* register crew member action button - hidden for submitter persona */}
          {canRegisterCrew && onRegisterCrew && (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={onRegisterCrew}
            >
              Register Crew Member
            </button>
          )}
        </div>
      </div>

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
                Seafarer Profile {renderSortIndicator('fullName')}
              </th>
              <th onClick={() => handleSort('currentVesselName')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                Current Vessel Assignment {renderSortIndicator('currentVesselName')}
              </th>
              <th onClick={() => handleSort('nationality')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                Nationality &amp; Seaman Book {renderSortIndicator('nationality')}
              </th>
              <th onClick={() => handleSort('complianceStatus')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                STCW Compliance Status {renderSortIndicator('complianceStatus')}
              </th>
              <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedCrew.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-4 text-muted">
                  No registered crew members match your search or filter criteria.
                </td>
              </tr>
            ) : (
              sortedCrew.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => onSelectCrew(c)}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="font-mono-code fw-semibold text-primary">{c.id}</td>
                  <td>
                    <div className="d-flex align-items-center gap-2.5">
                      <div
                        className="rounded-2 overflow-hidden border border-secondary-subtle flex-shrink-0 bg-dark"
                        style={{ width: '38px', height: '38px', aspectRatio: '1 / 1' }}
                      >
                        <img
                          src={getCrewStockPhoto(c.id, c.fullName, c.rank, c.imageUrl)}
                          alt={c.fullName}
                          className="w-100 h-100 object-fit-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80';
                          }}
                        />
                      </div>
                      <div>
                        <div className="fw-semibold text-dark">{c.fullName}</div>
                        <div className="small text-secondary">{c.rank}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {c.currentVesselName ? (
                      <div className="fw-semibold text-primary">{c.currentVesselName}</div>
                    ) : (
                      <span className="badge bg-light text-dark border">Ashore / Unassigned</span>
                    )}
                  </td>
                  <td>
                    <div>{c.nationality}</div>
                    <div className="small font-mono-code text-muted">{c.seamansBookNo}</div>
                  </td>
                  <td>
                    <span className={`badge ${getComplianceBadgeClass(c.complianceStatus)}`}>
                      {c.complianceStatus}
                    </span>
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
                          title="Upload STCW Document"
                          aria-label="Upload STCW Document"
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
                        title="View Crew Details"
                        aria-label="View Crew Details"
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

      {/* Crew Filter Modal */}
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onReset={handleResetFilters}
        title="Crew Directory Filters"
        subtitle="Filter crew seafarers by rank position, STCW compliance status, and vessel assignment"
        activeCount={activeFilterCount}
      >
        <div className="card p-3 bg-white border rounded">
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label small fw-semibold text-secondary mb-1">Rank / Position</label>
              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={rankFilter}
                onChange={(e) => setRankFilter(e.target.value)}
              >
                <option value="ALL">All Ranks / Officers</option>
                <option value="Master">Master / Captain</option>
                <option value="Chief Officer">Chief Officer</option>
                <option value="Engineer">Engine Officers</option>
                <option value="Bosun">Ratings & Deck Crew</option>
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-semibold text-secondary mb-1">STCW Compliance Status</label>
              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All STCW Statuses</option>
                <option value="Fully Compliant">Fully Compliant</option>
                <option value="Expiring < 60 Days">Expiring &lt; 60 Days</option>
                <option value="Document Deficient">Document Deficient</option>
              </select>
            </div>

            <div className="col-12">
              <label className="form-label small fw-semibold text-secondary mb-1">Assigned Vessel</label>
              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={vesselFilter}
                onChange={(e) => setVesselFilter(e.target.value)}
              >
                <option value="ALL">All Vessels</option>
                <option value="UNASSIGNED">Unassigned / Ashore</option>
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

