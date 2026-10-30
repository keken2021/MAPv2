import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Eye } from 'lucide-react';
import { useMapStore } from '../store/useMapStore';
import { VesselInformation } from '../types/vessel';
import { filterVesselsForPersona, getAssuranceSetRoleActions, isAdminReadOnlyWorkView, isAssuranceSetAssignedToPersona } from '../utils/rbacHelpers';
import { getDemoSessionContext, getSessionUserForPersona } from '../utils/userRoleHelpers';
import { exportToCsv, exportToPdf } from '../utils/exportHelpers';
import { FilterModal } from '../components/common/FilterModal';
import { ActiveFilterChips, FilterChip } from '../components/common/ActiveFilterChips';
import { CountTabs, CountTab } from '../components/common/CountTabs';
import { ListToolbar } from '../components/common/ListToolbar';
import { usePagination } from '../utils/usePagination';
import { TablePagination } from '../components/common/TablePagination';
import { formatMaritimeDate } from '../utils/formatters';
import { isComplianceDeadlineOverdue, toIsoLocalDate } from '../utils/validation';
import { AssuranceSet } from '../types/assurance';
import { inspectionProgressForSet } from '../store/inspectionMockData';
import { EmptyState } from '../components/common/EmptyState';

type InspectionRow = {
  set: AssuranceSet;
  vessel: VesselInformation;
};

export type InspectorTabKey = 'to-inspect' | 'overdue' | 'completed' | 'all';

type InspectorSortField = 'name' | 'imoNumber' | 'campaignTitle' | 'due' | 'location' | 'checklist';

export const InspectorWorkspaceView: React.FC = () => {
  const { vessels, assuranceSets, activePersona, setCurrentHashView, users, activeDemoOrganization, activeSessionUserId } = useMapStore();
  const sessionUser = useMemo(
    () =>
      getSessionUserForPersona(
        activePersona,
        users,
        getDemoSessionContext({ activeDemoOrganization, activeSessionUserId }),
      ),
    [activePersona, users, activeDemoOrganization, activeSessionUserId],
  );
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<InspectorTabKey>('to-inspect');
  const [sortField, setSortField] = useState<InspectorSortField>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('All');

  const handleResetFilters = () => {
    setLocationFilter('All');
    setSearchQuery('');
  };

  const activeChips = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    if (locationFilter !== 'All') {
      chips.push({
        id: 'location',
        label: 'Location',
        value: locationFilter,
        onRemove: () => setLocationFilter('All'),
      });
    }
    return chips;
  }, [locationFilter]);

  const activeFilterCount = activeChips.length;

  const inspectionRows = useMemo<InspectionRow[]>(() => {
    const vesselForSet = (set: AssuranceSet): VesselInformation => {
      const found = vessels.find((vessel) => vessel.id === set.vesselId || vessel.name === set.vesselName);
      if (found) return found;
      return {
        id: set.vesselId || set.id,
        name: set.vesselName || '—',
        imoNumber: set.imoNumber || '—',
        status: '—',
        portOfRegistry: '',
        flagState: '',
      } as unknown as VesselInformation;
    };

    if (isAdminReadOnlyWorkView('inspector', activePersona)) {
      return assuranceSets
        .filter(
          (set) =>
            Boolean(set.mandatoryInspectionRequired && set.assignedInspector) &&
            isAssuranceSetAssignedToPersona(set, activePersona, activeDemoOrganization) &&
            !getAssuranceSetRoleActions(set, activePersona, activeDemoOrganization, sessionUser).canInspect,
        )
        .map((set) => ({ set, vessel: vesselForSet(set) }));
    }

    if (activePersona !== 'Inspector' || !sessionUser?.name) {
      return filterVesselsForPersona(vessels, assuranceSets, activePersona).map((vessel) => ({
        vessel,
        set: assuranceSets.find((set) => set.vesselId === vessel.id || set.vesselName === vessel.name) as AssuranceSet,
      })).filter((row) => row.set);
    }

    const name = sessionUser.name.trim().toLowerCase();
    return assuranceSets
      .filter(
        (set) =>
          isAssuranceSetAssignedToPersona(set, activePersona, activeDemoOrganization, sessionUser) &&
          Boolean(set.assignedInspector?.toLowerCase().includes(name)),
      )
      .map((set) => ({ set, vessel: vesselForSet(set) }));
  }, [vessels, assuranceSets, activePersona, activeDemoOrganization, sessionUser]);

  const isCompleted = (row: InspectionRow) =>
    Boolean(row.set.inspectionCompleted || row.set.stage === 'Certified');

  const isToInspect = (row: InspectionRow) => {
    if (row.set.stage === 'Certified' || row.set.stage === 'Cancelled') return false;
    return !row.set.inspectionCompleted;
  };

  const isVesselOverdue = (row: InspectionRow) => {
    if (isCompleted(row)) return false;
    if (row.set.stage === 'Approved' || row.set.stage === 'Certified' || row.set.stage === 'Cancelled') return false;
    if (isComplianceDeadlineOverdue(row.set)) return true;
    const deadline = row.set.revisedCompletionDate || row.set.complianceDeadline || row.set.targetDate;
    if (!deadline) return false;
    return deadline < toIsoLocalDate();
  };

  const toInspectCount = useMemo(() => inspectionRows.filter(isToInspect).length, [inspectionRows]);
  const overdueCount = useMemo(() => inspectionRows.filter(isVesselOverdue).length, [inspectionRows]);
  const completedCount = useMemo(() => inspectionRows.filter(isCompleted).length, [inspectionRows]);
  const allCount = inspectionRows.length;

  const tabs: CountTab[] = useMemo(
    () => [
      { key: 'to-inspect', label: 'To Inspect', count: toInspectCount },
      { key: 'overdue', label: 'Overdue', count: overdueCount, tone: 'warn' },
      { key: 'completed', label: 'Completed', count: completedCount },
      { key: 'all', label: 'All', count: allCount },
    ],
    [toInspectCount, overdueCount, completedCount, allCount],
  );

  const handleSort = (field: InspectorSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIndicator = (field: InspectorSortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={14} className="text-muted ms-1 opacity-50 inline-block align-middle" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp size={14} className="text-primary ms-1 inline-block align-middle" />
    ) : (
      <ArrowDown size={14} className="text-primary ms-1 inline-block align-middle" />
    );
  };

  const filteredAssignedVessels = inspectionRows.filter((row) => {
    if (activeTab === 'to-inspect' && !isToInspect(row)) return false;
    if (activeTab === 'overdue' && !isVesselOverdue(row)) return false;
    if (activeTab === 'completed' && !isCompleted(row)) return false;

    const v = row.vessel;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      v.name.toLowerCase().includes(q) ||
      v.imoNumber.toLowerCase().includes(q) ||
      (v.portOfRegistry || '').toLowerCase().includes(q) ||
      (v.flagState || '').toLowerCase().includes(q) ||
      row.set.title.toLowerCase().includes(q) ||
      (inspectionProgressForSet(row.set.id)?.location || '').toLowerCase().includes(q);
    const location = inspectionProgressForSet(row.set.id)?.location || '';
    const matchesLocation = locationFilter === 'All' || location === locationFilter;
    return matchesSearch && matchesLocation;
  });

  const sortedAssignedVessels = [...filteredAssignedVessels].sort((a, b) => {
    let valA: string = '';
    let valB: string = '';

    if (sortField === 'campaignTitle') {
      valA = a.set.title;
      valB = b.set.title;
    } else if (sortField === 'due') {
      const dueOf = (row: InspectionRow) =>
        row.set.revisedCompletionDate || row.set.complianceDeadline || row.set.targetDate || '';
      valA = dueOf(a);
      valB = dueOf(b);
    } else if (sortField === 'location') {
      valA = inspectionProgressForSet(a.set.id)?.location || '';
      valB = inspectionProgressForSet(b.set.id)?.location || '';
    } else if (sortField === 'checklist') {
      valA = String(inspectionProgressForSet(a.set.id)?.checklistCompleted ?? -1);
      valB = String(inspectionProgressForSet(b.set.id)?.checklistCompleted ?? -1);
    } else {
      valA = (a.vessel[sortField] ?? '') as string;
      valB = (b.vessel[sortField] ?? '') as string;
    }

    if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = (valB as string).toLowerCase();
    }

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const locations = Array.from(
    new Set(inspectionRows.map((row) => inspectionProgressForSet(row.set.id)?.location).filter(Boolean) as string[]),
  ).sort();

  const handleExportCsv = () => {
    const exportData = sortedAssignedVessels.map((row) => {
      const effectiveDeadline = row.set.revisedCompletionDate || row.set.complianceDeadline || row.set.targetDate || '';
      return {
        ImoNumber: row.vessel.imoNumber,
        VesselName: row.vessel.name,
        AssuranceCampaign: row.set.title,
        Due: effectiveDeadline,
        Location: inspectionProgressForSet(row.set.id)?.location || '',
        Checklist: (() => {
          const progress = inspectionProgressForSet(row.set.id);
          return progress ? `${progress.checklistCompleted} / ${progress.checklistTotal}` : '';
        })(),
      };
    });
    exportToCsv('Inspections', exportData);
  };

  const handleExportPdf = () => {
    const headers = ['IMO Number', 'Vessel', 'Assurance Set', 'Due', 'Location', 'Checklist'];
    const rows = sortedAssignedVessels.map((row) => {
      const effectiveDeadline = row.set.revisedCompletionDate || row.set.complianceDeadline || row.set.targetDate || '—';
      const progress = inspectionProgressForSet(row.set.id);
      return [
        row.vessel.imoNumber,
        row.vessel.name,
        row.set.title,
        effectiveDeadline,
        progress?.location || '—',
        progress ? `${progress.checklistCompleted} / ${progress.checklistTotal}` : '—',
      ];
    });
    exportToPdf('Inspections', headers, rows);
  };

  const vesselsPagination = usePagination(sortedAssignedVessels, [
    activeTab,
    searchQuery,
    locationFilter,
    sortField,
    sortDirection,
  ]);

  const adminReadOnly = isAdminReadOnlyWorkView('inspector', activePersona);

  return (
    <div className="d-flex flex-column gap-4">
      {adminReadOnly && (
        <div className="alert alert-info py-2 mb-0 small">
          Read-only view of your organization's inspection work
        </div>
      )}
      <div className="card map-card-custom">
        <div className="p-3 border-bottom">
          <CountTabs
            tabs={tabs}
            active={activeTab}
            onChange={(key) => setActiveTab(key as InspectorTabKey)}
            aria-label="Inspector queue tabs"
          />
        </div>

        <ListToolbar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search vessels..."
          onFilterClick={() => setIsFilterModalOpen(true)}
          activeFilterCount={activeFilterCount}
          onExportCsv={handleExportCsv}
          onExportPdf={handleExportPdf}
        />

        {activeChips.length > 0 && (
          <div className="px-3 py-2 bg-white border-bottom">
            <ActiveFilterChips chips={activeChips} onClearAll={handleResetFilters} />
          </div>
        )}

        <div className="table-responsive">
          <table className="table map-table-custom align-middle mb-0">
            <thead>
              <tr>
                <th
                  onClick={() => handleSort('imoNumber')}
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                >
                  IMO Number {renderSortIndicator('imoNumber')}
                </th>
                <th
                  onClick={() => handleSort('name')}
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                >
                  Vessel {renderSortIndicator('name')}
                </th>
                <th
                  onClick={() => handleSort('campaignTitle')}
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                >
                  Assurance Set {renderSortIndicator('campaignTitle')}
                </th>
                <th
                  onClick={() => handleSort('due')}
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                >
                  Due {renderSortIndicator('due')}
                </th>
                <th
                  onClick={() => handleSort('location')}
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                >
                  Location {renderSortIndicator('location')}
                </th>
                <th
                  onClick={() => handleSort('checklist')}
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                >
                  Checklist {renderSortIndicator('checklist')}
                </th>
                <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vesselsPagination.pageItems.map((row) => {
                const v = row.vessel;
                const linkedSet = row.set;
                const effectiveDeadline = linkedSet.revisedCompletionDate || linkedSet.complianceDeadline || linkedSet.targetDate;
                const overdue = isVesselOverdue(row);
                let daysLate = 0;
                if (overdue && effectiveDeadline) {
                  const deadlineMs = new Date(effectiveDeadline).getTime();
                  const nowMs = new Date(toIsoLocalDate()).getTime();
                  const diff = Math.round((nowMs - deadlineMs) / (1000 * 60 * 60 * 24));
                  daysLate = Math.max(1, diff);
                }

                return (
                  <tr
                    key={linkedSet.id}
                    onClick={() => setCurrentHashView('inspector', v.name)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="font-mono-code fw-semibold text-primary">{v.imoNumber}</td>
                    <td>
                      <span className="fw-semibold text-dark">{v.name}</span>
                    </td>
                    <td>
                      {linkedSet ? (
                        <span className="text-secondary small">
                          <span className="font-mono-code">{linkedSet.id}</span>
                          {` · ${linkedSet.title}`}
                        </span>
                      ) : (
                        <span className="text-muted small">—</span>
                      )}
                    </td>
                    <td className="small due-cell">
                      {overdue ? (
                        <span className="text-danger fw-semibold">
                          {daysLate} {daysLate === 1 ? 'day' : 'days'} late
                        </span>
                      ) : effectiveDeadline ? (
                        <span className="text-secondary">
                          {formatMaritimeDate(effectiveDeadline)}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>{inspectionProgressForSet(linkedSet.id)?.location || '—'}</td>
                    <td>
                      {(() => {
                        const progress = inspectionProgressForSet(linkedSet.id);
                        return progress ? `${progress.checklistCompleted} / ${progress.checklistTotal}` : '—';
                      })()}
                    </td>
                    <td className="text-end" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                        style={{ width: '32px', height: '32px' }}
                        onClick={() => setCurrentHashView('inspector', v.name)}
                        title="View"
                        aria-label="View"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {sortedAssignedVessels.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-0">
                    <EmptyState title="No inspections" description="No vessels match this queue." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePagination {...vesselsPagination.controls} />
      </div>

      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onReset={handleResetFilters}
        title="Filters"
        activeCount={activeFilterCount}
      >
        <div className="d-flex flex-column gap-3">
          <div>
            <label className="form-label text-secondary fw-semibold small mb-1" style={{ fontSize: '0.8rem' }}>
              Location
            </label>
            <select
              className="form-select form-select-sm bg-white text-dark font-sans"
              style={{ borderColor: '#E2E8F0', fontSize: '0.84rem' }}
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            >
              <option value="All">All locations ({locations.length})</option>
              {locations.map((place) => (
                <option key={place} value={place}>
                  {place}
                </option>
              ))}
            </select>
          </div>
        </div>
      </FilterModal>
    </div>
  );
};
