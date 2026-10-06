/* 
  file summary: master crew directory table component matching exact assurance sets table format, header controls layout, and interactive column sorting.
  responsibilities: presents crew ids, full names, ranks, current vessel assignments, stcw compliance badges, multi-column sorting by header clicks, export controls, and registration triggers.
  role in system: main data table component for CrewView.tsx.
*/

import React, { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import { CrewMember, CrewComplianceStatus } from '../../types/crew';
import { formatMaritimeDate } from '../../utils/formatters';
import { exportToCsv, exportToPdf } from '../../utils/exportHelpers';
import { canPerform } from '../../utils/permissionHelpers';

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
    users,
    activePersona,
    rolePermissionDefaults,
    userPermissionOverrides,
    customScopes,
  } = useMapStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [rankFilter, setRankFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
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

    return matchesSearch && matchesRank && matchesStatus;
  });

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
        {/* Left Side: Search Box & Filter Dropdowns */}
        <div className="d-flex flex-wrap align-items-center gap-2">
          <input
            type="text"
            className="form-control form-control-sm bg-white text-dark border-secondary"
            placeholder="Search Crew ID, Name, Rank, Vessel..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '270px' }}
          />

          <select
            className="form-select form-select-sm bg-white text-dark border-secondary"
            value={rankFilter}
            onChange={(e) => setRankFilter(e.target.value)}
            style={{ width: '160px' }}
          >
            <option value="ALL">All Ranks / Officers</option>
            <option value="Master">Master / Captain</option>
            <option value="Chief Officer">Chief Officer</option>
            <option value="Engineer">Engine Officers</option>
            <option value="Bosun">Ratings & Deck Crew</option>
          </select>

          <select
            className="form-select form-select-sm bg-white text-dark border-secondary"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '160px' }}
          >
            <option value="ALL">All STCW Statuses</option>
            <option value="Fully Compliant">Fully Compliant</option>
            <option value="Expiring < 60 Days">Expiring &lt; 60 Days</option>
            <option value="Document Deficient">Document Deficient</option>
          </select>
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

      {/* Master Crew Data Table matching Assurance Sets table grid format */}
      <div className="table-responsive">
        <table className="table map-table-custom align-middle mb-0">
          <thead>
            <tr>
              <th onClick={() => handleSort('id')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                Crew ID {renderSortIndicator('id')}
              </th>
              <th onClick={() => handleSort('fullName')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                Full Name &amp; Rank {renderSortIndicator('fullName')}
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
              <th onClick={() => handleSort('lastAuditedDate')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                Last Audited {renderSortIndicator('lastAuditedDate')}
              </th>
              <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedCrew.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-4 text-muted">
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
                  <td className="font-mono-code fw-bold text-primary">{c.id}</td>
                  <td>
                    <div className="fw-semibold text-dark">{c.fullName}</div>
                    <div className="small text-secondary">{c.rank}</div>
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
                  <td className="font-mono-code small text-secondary">
                    {formatMaritimeDate(c.lastAuditedDate)}
                  </td>
                  <td className="text-end">
                    <div className="d-flex align-items-center justify-content-end gap-2">
                      {canManageCrew && onAddDocumentCrew && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-success"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddDocumentCrew(c);
                          }}
                          title="Upload Layer 1 or Layer 2 STCW Document"
                        >
                          Add Document
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCrew(c);
                        }}
                      >
                        View Details
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

