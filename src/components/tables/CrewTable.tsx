/* 
  file summary: master crew directory table component matching exact assurance sets table format, header controls layout, and interactive column sorting.
  responsibilities: presents crew ids, full names, ranks, current vessel assignments, stcw compliance badges, multi-column sorting by header clicks, export controls, registration triggers, and individuals/groups toggle.
  role in system: main data table component for CrewView.tsx.
*/

import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Eye, FilePlus } from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import { CrewMember, CrewGroup } from '../../types/crew';
import { FilterModal } from '../common/FilterModal';
import { CountTabs } from '../common/CountTabs';
import { ListToolbar } from '../common/ListToolbar';
import { StatusBadge } from '../common/StatusBadge';
import { EmptyState } from '../common/EmptyState';
import { ActiveFilterChips, FilterChip } from '../common/ActiveFilterChips';
import { getStatusDisplayLabel } from '../../utils/formatters';
import { exportToCsv, exportToPdf } from '../../utils/exportHelpers';
import { canPerform } from '../../utils/permissionHelpers';
import { usePagination } from '../../utils/usePagination';
import { useDeferredFilters } from '../../utils/useDeferredFilters';
import { TablePagination } from '../common/TablePagination';
import { maskRestrictedValue } from '../../utils/restrictedData';

type CrewSortField =
  | 'id'
  | 'fullName'
  | 'currentVesselName'
  | 'nationality'
  | 'complianceStatus'
  | 'lastAuditedDate';

type GroupSortField =
  | 'id'
  | 'name'
  | 'specialization'
  | 'memberCount';

export interface CrewTableProps {
  onSelectCrew: (crew: CrewMember) => void;
  onSelectGroup?: (group: CrewGroup) => void;
  onRegisterCrew?: () => void;
  onAddDocumentCrew?: (crew: CrewMember) => void;
  initialMode?: 'individuals' | 'groups';
  /** When set, lists only crew linked to this vessel (current or historical assignment). */
  vesselId?: string;
  /** Extra actions next to Add Crew (e.g. Assign on vessel detail). */
  primaryActions?: React.ReactNode;
}

/**
  what: renders master crew directory table matching assurance sets table layout with column sorting and individuals/groups toggle.
  how: filters crew or crew groups by search query, filters, and displays with shared controls for sorting, filtering, and pagination (ADR 0005).
  with what file: src/components/tables/CrewTable.tsx loaded by CrewView.tsx.
*/
export const CrewTable: React.FC<CrewTableProps> = ({
  onSelectCrew,
  onSelectGroup,
  onRegisterCrew,
  onAddDocumentCrew,
  initialMode = 'individuals',
  vesselId,
  primaryActions,
}) => {
  const {
    crew,
    crewGroups,
    vessels,
    users,
    activePersona,
    rolePermissionDefaults,
    userPermissionOverrides,
    customScopes,
  } = useMapStore();

  const [directoryMode, setDirectoryMode] = useState<'individuals' | 'groups'>(
    vesselId ? 'individuals' : initialMode,
  );
  const scopedToVessel = Boolean(vesselId);
  const [searchTerm, setSearchTerm] = useState('');
  const [rankFilter, setRankFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [vesselFilter, setVesselFilter] = useState<string>('ALL');
  const [groupSpecializationFilter, setGroupSpecializationFilter] = useState<string>('ALL');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [sortField, setSortField] = useState<CrewSortField>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [groupSortField, setGroupSortField] = useState<GroupSortField>('id');
  const [groupSortDirection, setGroupSortDirection] = useState<'asc' | 'desc'>('asc');

  const filterState = useDeferredFilters({
    isOpen: isFilterModalOpen,
    applied: {
      rank: rankFilter,
      status: statusFilter,
      vessel: vesselFilter,
      groupSpecialization: groupSpecializationFilter,
    },
    defaults: {
      rank: 'ALL',
      status: 'ALL',
      vessel: 'ALL',
      groupSpecialization: 'ALL',
    },
    onCommit: (next) => {
      if (directoryMode === 'individuals') {
        setRankFilter(next.rank);
        setStatusFilter(next.status);
        setVesselFilter(next.vessel);
      } else {
        setGroupSpecializationFilter(next.groupSpecialization);
      }
    },
  });

  const draftActiveFilterCount =
    directoryMode === 'individuals'
      ? (filterState.draft.rank !== 'ALL' ? 1 : 0) +
        (filterState.draft.status !== 'ALL' ? 1 : 0) +
        (!scopedToVessel && filterState.draft.vessel !== 'ALL' ? 1 : 0)
      : filterState.draft.groupSpecialization !== 'ALL'
        ? 1
        : 0;

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

  const handleModeChange = (mode: 'individuals' | 'groups') => {
    setDirectoryMode(mode);
    setSearchTerm('');
    if (mode === 'individuals') {
      setRankFilter('ALL');
      setStatusFilter('ALL');
      setVesselFilter('ALL');
    } else {
      setGroupSpecializationFilter('ALL');
    }
  };

  const vesselScopedCrew = useMemo(() => {
    if (!vesselId) return crew;
    return crew.filter(
      (c) =>
        c.currentVesselId === vesselId ||
        (c.assignments || []).some((a) => a.vesselId === vesselId),
    );
  }, [crew, vesselId]);

  /* --- INDIVIDUALS FILTERING & SORTING --- */
  const filteredCrew = vesselScopedCrew.filter((c) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      c.id.toLowerCase().includes(term) ||
      c.fullName.toLowerCase().includes(term) ||
      c.rank.toLowerCase().includes(term) ||
      c.seamansBookNo.toLowerCase().includes(term) ||
      (c.currentVesselName && c.currentVesselName.toLowerCase().includes(term));

    const matchesRank = rankFilter === 'ALL' || c.rank.toLowerCase().includes(rankFilter.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || c.complianceStatus === statusFilter;
    const matchesVessel = scopedToVessel
      ? true
      : vesselFilter === 'ALL' ||
        (vesselFilter === 'UNASSIGNED' ? !c.currentVesselId : c.currentVesselId === vesselFilter || c.currentVesselName === vesselFilter);

    return matchesSearch && matchesRank && matchesStatus && matchesVessel;
  });

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

  /* --- GROUPS FILTERING & SORTING --- */
  const specializations = useMemo(() => {
    return Array.from(new Set(crewGroups.map((g) => g.specialization))).sort();
  }, [crewGroups]);

  const groupTabs = useMemo(() => {
    return [
      { key: 'ALL', label: 'All', count: crewGroups.length },
      ...specializations.map((spec) => ({
        key: spec,
        label: spec,
        count: crewGroups.filter((g) => g.specialization === spec).length,
      })),
    ];
  }, [crewGroups, specializations]);

  const activeGroupTab = groupTabs.some((tab) => tab.key === groupSpecializationFilter)
    ? groupSpecializationFilter
    : 'ALL';

  const filteredGroups = useMemo(() => {
    return crewGroups.filter((g) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        g.id.toLowerCase().includes(term) ||
        g.name.toLowerCase().includes(term) ||
        g.specialization.toLowerCase().includes(term) ||
        (g.description && g.description.toLowerCase().includes(term));

      const matchesSpec =
        groupSpecializationFilter === 'ALL' ||
        g.specialization === groupSpecializationFilter;

      return matchesSearch && matchesSpec;
    });
  }, [crewGroups, searchTerm, groupSpecializationFilter]);

  const sortedGroups = useMemo(() => {
    return [...filteredGroups].sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';

      if (groupSortField === 'memberCount') {
        valA = a.memberIds.length;
        valB = b.memberIds.length;
      } else {
        valA = a[groupSortField] ?? '';
        valB = b[groupSortField] ?? '';
      }

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB as string).toLowerCase();
      }

      if (valA < valB) return groupSortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return groupSortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredGroups, groupSortField, groupSortDirection]);

  const handleGroupSort = (field: GroupSortField) => {
    if (groupSortField === field) {
      setGroupSortDirection(groupSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setGroupSortField(field);
      setGroupSortDirection('asc');
    }
  };

  const renderGroupSortIndicator = (field: GroupSortField) => {
    if (groupSortField !== field) {
      return <ArrowUpDown size={14} className="text-muted ms-1 opacity-50 inline-block align-middle" />;
    }
    return groupSortDirection === 'asc' ? (
      <ArrowUp size={14} className="text-primary ms-1 inline-block align-middle" />
    ) : (
      <ArrowDown size={14} className="text-primary ms-1 inline-block align-middle" />
    );
  };

  /* --- ACTIVE FILTER COUNTS & CHIPS --- */
  const activeFilterCount =
    directoryMode === 'individuals'
      ? (rankFilter !== 'ALL' ? 1 : 0) +
        (statusFilter !== 'ALL' ? 1 : 0) +
        (vesselFilter !== 'ALL' ? 1 : 0)
      : groupSpecializationFilter !== 'ALL'
        ? 1
        : 0;

  const activeChips: FilterChip[] =
    directoryMode === 'individuals'
      ? [
          ...(rankFilter !== 'ALL' ? [{ id: 'rank', label: 'Rank', value: rankFilter, onRemove: () => setRankFilter('ALL') }] : []),
          ...(statusFilter !== 'ALL' ? [{ id: 'status', label: 'Compliance', value: getStatusDisplayLabel(statusFilter), onRemove: () => setStatusFilter('ALL') }] : []),
          ...(vesselFilter !== 'ALL' ? [{ id: 'vessel', label: 'Vessel', value: vesselFilter === 'UNASSIGNED' ? 'Unassigned' : vesselFilter, onRemove: () => setVesselFilter('ALL') }] : []),
        ]
      : [
          ...(groupSpecializationFilter !== 'ALL' ? [{ id: 'specialization', label: 'Specialization', value: groupSpecializationFilter, onRemove: () => setGroupSpecializationFilter('ALL') }] : []),
        ];

  const handleResetFilters = () => {
    if (directoryMode === 'individuals') {
      setRankFilter('ALL');
      setStatusFilter('ALL');
      setVesselFilter('ALL');
    } else {
      setGroupSpecializationFilter('ALL');
    }
  };

  /* --- EXPORTS --- */
  const handleExportCsv = () => {
    const exportData = sortedCrew.map((c) => ({
      CrewID: c.id,
      FullName: c.fullName,
      Rank: c.rank,
      CurrentVessel: c.currentVesselName || 'Unassigned / Ashore',
      Nationality: c.nationality,
      SeamansBookNo: c.seamansBookNo,
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

  const handleExportGroupsCsv = () => {
    const exportData = sortedGroups.map((g) => ({
      GroupID: g.id,
      Name: g.name,
      Specialization: g.specialization,
      MemberCount: g.memberIds.length,
      Organization: g.organization || '',
    }));
    exportToCsv('Master_Crew_Groups', exportData);
  };

  const handleExportGroupsPdf = () => {
    const headers = ['Group ID', 'Name', 'Specialization', 'Members'];
    const rows = sortedGroups.map((g) => [
      g.id,
      g.name,
      g.specialization,
      `${g.memberIds.length} members`,
    ]);
    exportToPdf('Crew Groups Directory', headers, rows);
  };

  /* --- PAGINATION (ADR 0005) --- */
  const crewPagination = usePagination(sortedCrew, [
    directoryMode,
    searchTerm,
    rankFilter,
    statusFilter,
    vesselFilter,
    sortField,
    sortDirection,
  ]);

  const groupPagination = usePagination(sortedGroups, [
    directoryMode,
    searchTerm,
    groupSpecializationFilter,
    groupSortField,
    groupSortDirection,
  ]);

  const crewTabs = [
    { key: 'ALL', label: 'All', count: vesselScopedCrew.length },
    {
      key: 'Fully Compliant',
      label: 'Compliant',
      count: vesselScopedCrew.filter((member) => member.complianceStatus === 'Fully Compliant').length,
    },
    {
      key: 'Expiring < 60 Days',
      label: 'Expiring Soon',
      count: vesselScopedCrew.filter((member) => member.complianceStatus === 'Expiring < 60 Days').length,
      tone: 'warn' as const,
    },
    {
      key: 'Document Deficient',
      label: 'Non-Compliant',
      count: vesselScopedCrew.filter((member) => member.complianceStatus === 'Document Deficient').length,
    },
  ];
  const activeCrewTab = crewTabs.some((tab) => tab.key === statusFilter) ? statusFilter : '';

  return (
    <div className="card map-card-custom" data-testid={scopedToVessel ? 'vessel-scoped-crew-table' : 'crew-directory-table'}>
      <div className="p-3 border-bottom d-flex align-items-center justify-content-between flex-wrap gap-3">
        {/* Individuals / Groups Toggle */}
        {!scopedToVessel && (
          <div className="btn-group" role="group" aria-label="Crew view mode">
            <button
              type="button"
              className={`btn btn-sm ${directoryMode === 'individuals' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => handleModeChange('individuals')}
              aria-pressed={directoryMode === 'individuals'}
            >
              Individuals
            </button>
            <button
              type="button"
              className={`btn btn-sm ${directoryMode === 'groups' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => handleModeChange('groups')}
              aria-pressed={directoryMode === 'groups'}
            >
              Groups
            </button>
          </div>
     )}

        {/* CountTabs for Active Mode */}
        {directoryMode === 'individuals' ? (
          <CountTabs
            tabs={crewTabs}
            active={activeCrewTab}
            onChange={setStatusFilter}
            aria-label="Crew tabs"
          />
        ) : (
          <CountTabs
            tabs={groupTabs}
            active={activeGroupTab}
            onChange={setGroupSpecializationFilter}
            aria-label="Crew group tabs"
          />
        )}
      </div>

      {/* Shared ListToolbar (ADR 0005) */}
      <ListToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={directoryMode === 'individuals' ? 'Search crew...' : 'Search groups...'}
        onFilterClick={() => setIsFilterModalOpen(true)}
        activeFilterCount={activeFilterCount}
        onExportCsv={directoryMode === 'individuals' ? handleExportCsv : handleExportGroupsCsv}
        onExportPdf={directoryMode === 'individuals' ? handleExportPdf : handleExportGroupsPdf}
        primaryAction={
          directoryMode === 'individuals' ? (
            <div className="d-flex align-items-center gap-2">
              {primaryActions}
              {canRegisterCrew && onRegisterCrew && (
                <button type="button" className="btn btn-sm btn-primary" onClick={onRegisterCrew}>
                  Add Crew
                </button>
              )}
            </div>
          ) : undefined
        }
      />

      {activeChips.length > 0 && (
        <div className="px-3 py-2 bg-light border-bottom">
          <ActiveFilterChips chips={activeChips} onClearAll={handleResetFilters} />
        </div>
      )}

      {/* Mode-specific Table View */}
      {directoryMode === 'individuals' ? (
        <div className="table-responsive">
          <table className="table map-table-custom align-middle mb-0" data-testid="crew-individuals-table">
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
                  <td colSpan={6} className="p-0">
                    <EmptyState title="No crew found" />
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
      ) : (
        <div className="table-responsive">
          <table className="table map-table-custom align-middle mb-0" data-testid="crew-groups-table">
            <thead>
              <tr>
                <th onClick={() => handleGroupSort('id')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  Group ID {renderGroupSortIndicator('id')}
                </th>
                <th onClick={() => handleGroupSort('name')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  Name {renderGroupSortIndicator('name')}
                </th>
                <th onClick={() => handleGroupSort('specialization')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  Specialization {renderGroupSortIndicator('specialization')}
                </th>
                <th onClick={() => handleGroupSort('memberCount')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  Member Count {renderGroupSortIndicator('memberCount')}
                </th>
                <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedGroups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-0">
                    <EmptyState title="No crew groups found" />
                  </td>
                </tr>
              ) : (
                groupPagination.pageItems.map((group) => (
                  <tr
                    key={group.id}
                    onClick={() => onSelectGroup?.(group)}
                    style={{ cursor: onSelectGroup ? 'pointer' : 'default' }}
                  >
                    <td className="font-mono-code fw-semibold text-primary">{group.id}</td>
                    <td className="fw-semibold text-dark text-nowrap">{group.name}</td>
                    <td className="text-nowrap">{group.specialization}</td>
                    <td className="text-nowrap">
                      <span className="badge bg-light text-dark border">
                        {group.memberIds.length} {group.memberIds.length === 1 ? 'member' : 'members'}
                      </span>
                    </td>
                    <td className="text-end">
                      <div className="d-flex align-items-center justify-content-end gap-1.5">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                          style={{ width: '32px', height: '32px' }}
                          title={`View ${group.name}`}
                          aria-label={`View ${group.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectGroup?.(group);
                          }}
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
      )}

      {/* Shared Table Pagination (ADR 0005) */}
      <TablePagination {...(directoryMode === 'individuals' ? crewPagination.controls : groupPagination.controls)} />

      {/* Universal Filter Modal */}
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onReset={filterState.resetDraft}
        onApply={filterState.applyDraft}
        title={directoryMode === 'individuals' ? 'Filters' : 'Filter Groups'}
        activeCount={draftActiveFilterCount}
      >
        <div className="card p-3 bg-white border rounded">
          {directoryMode === 'individuals' ? (
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label small fw-semibold text-secondary mb-1">Rank</label>
                <select
                  className="form-select form-select-sm bg-white text-dark border-secondary"
                  value={filterState.draft.rank}
                  onChange={(e) => filterState.setField('rank', e.target.value)}
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
                  value={filterState.draft.status}
                  onChange={(e) => filterState.setField('status', e.target.value)}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Fully Compliant">Compliant</option>
                  <option value="Expiring < 60 Days">Expiring Soon</option>
                  <option value="Document Deficient">Non-Compliant</option>
                </select>
              </div>

              {!scopedToVessel && (
                <div className="col-12">
                  <label className="form-label small fw-semibold text-secondary mb-1">Vessel</label>
                  <select
                    className="form-select form-select-sm bg-white text-dark border-secondary"
                    value={filterState.draft.vessel}
                    onChange={(e) => filterState.setField('vessel', e.target.value)}
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
              )}
            </div>
          ) : (
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label small fw-semibold text-secondary mb-1">Specialization</label>
                <select
                  className="form-select form-select-sm bg-white text-dark border-secondary"
                  value={filterState.draft.groupSpecialization}
                  onChange={(e) => filterState.setField('groupSpecialization', e.target.value)}
                >
                  <option value="ALL">All Specializations</option>
                  {specializations.map((spec) => (
                    <option key={spec} value={spec}>
                      {spec}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </FilterModal>
    </div>
  );
};
