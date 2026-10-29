import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Eye } from 'lucide-react';
import { useMapStore } from '../store/useMapStore';
import { VesselInformation } from '../types/vessel';
import { filterVesselsForPersona } from '../utils/rbacHelpers';
import { exportToCsv, exportToPdf } from '../utils/exportHelpers';
import { FilterModal } from '../components/common/FilterModal';
import { ActiveFilterChips, FilterChip } from '../components/common/ActiveFilterChips';
import { CountTabs, CountTab } from '../components/common/CountTabs';
import { StatusBadge } from '../components/common/StatusBadge';
import { ListToolbar } from '../components/common/ListToolbar';
import { usePagination } from '../utils/usePagination';
import { TablePagination } from '../components/common/TablePagination';
import { formatMaritimeDate } from '../utils/formatters';
import { isComplianceDeadlineOverdue, toIsoLocalDate } from '../utils/validation';

export type InspectorTabKey = 'to-inspect' | 'overdue' | 'completed' | 'all';

type InspectorSortField = 'name' | 'imoNumber' | 'campaignTitle' | 'due' | 'status';

export const InspectorWorkspaceView: React.FC = () => {
  const { vessels, assuranceSets, activePersona, setCurrentHashView } = useMapStore();
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<InspectorTabKey>('to-inspect');
  const [sortField, setSortField] = useState<InspectorSortField>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  const handleResetFilters = () => {
    setStatusFilter('All');
    setSearchQuery('');
  };

  const activeChips = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    if (statusFilter !== 'All') {
      chips.push({
        id: 'status',
        label: 'Status',
        value: statusFilter,
        onRemove: () => setStatusFilter('All'),
      });
    }
    return chips;
  }, [statusFilter]);

  const activeFilterCount = activeChips.length;

  const assignedVessels = filterVesselsForPersona(vessels, assuranceSets, activePersona);

  const isCompleted = (v: VesselInformation) => {
    const linkedSet = assuranceSets.find((s) => s.vesselId === v.id || s.vesselName === v.name);
    return Boolean(linkedSet?.inspectionCompleted || linkedSet?.stage === 'Certified');
  };

  const isToInspect = (v: VesselInformation) => {
    const linkedSet = assuranceSets.find((s) => s.vesselId === v.id || s.vesselName === v.name);
    if (!linkedSet) return false;
    if (linkedSet.stage === 'Certified' || linkedSet.stage === 'Cancelled') return false;
    return !linkedSet.inspectionCompleted;
  };

  const isVesselOverdue = (v: VesselInformation) => {
    if (isCompleted(v)) return false;
    const linkedSet = assuranceSets.find((s) => s.vesselId === v.id || s.vesselName === v.name);
    if (!linkedSet) return false;
    if (linkedSet.stage === 'Approved' || linkedSet.stage === 'Certified' || linkedSet.stage === 'Cancelled') return false;
    if (isComplianceDeadlineOverdue(linkedSet)) return true;
    const deadline = linkedSet.revisedCompletionDate || linkedSet.complianceDeadline || linkedSet.targetDate;
    if (!deadline) return false;
    return deadline < toIsoLocalDate();
  };

  const toInspectCount = useMemo(() => assignedVessels.filter(isToInspect).length, [assignedVessels, assuranceSets]);
  const overdueCount = useMemo(() => assignedVessels.filter(isVesselOverdue).length, [assignedVessels, assuranceSets]);
  const completedCount = useMemo(() => assignedVessels.filter(isCompleted).length, [assignedVessels, assuranceSets]);
  const allCount = assignedVessels.length;

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

  const filteredAssignedVessels = assignedVessels.filter((v) => {
    if (activeTab === 'to-inspect' && !isToInspect(v)) return false;
    if (activeTab === 'overdue' && !isVesselOverdue(v)) return false;
    if (activeTab === 'completed' && !isCompleted(v)) return false;

    const linkedSet = assuranceSets.find((s) => s.vesselId === v.id || s.vesselName === v.name);
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      v.name.toLowerCase().includes(q) ||
      v.imoNumber.toLowerCase().includes(q) ||
      v.portOfRegistry.toLowerCase().includes(q) ||
      v.flagState.toLowerCase().includes(q) ||
      (linkedSet ? linkedSet.title.toLowerCase().includes(q) : false);
    const matchesStatus = statusFilter === 'All' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const sortedAssignedVessels = [...filteredAssignedVessels].sort((a, b) => {
    let valA: string = '';
    let valB: string = '';

    if (sortField === 'campaignTitle') {
      const linkedSetA = assuranceSets.find((s) => s.vesselId === a.id || s.vesselName === a.name);
      const linkedSetB = assuranceSets.find((s) => s.vesselId === b.id || s.vesselName === b.name);
      valA = linkedSetA ? linkedSetA.title : '';
      valB = linkedSetB ? linkedSetB.title : '';
    } else if (sortField === 'due') {
      const getDueDeadline = (v: VesselInformation) => {
        const linkedSet = assuranceSets.find((s) => s.vesselId === v.id || s.vesselName === v.name);
        return linkedSet?.revisedCompletionDate || linkedSet?.complianceDeadline || linkedSet?.targetDate || '';
      };
      valA = getDueDeadline(a);
      valB = getDueDeadline(b);
    } else {
      valA = (a[sortField] ?? '') as string;
      valB = (b[sortField] ?? '') as string;
    }

    if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = (valB as string).toLowerCase();
    }

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const vesselStatuses = Array.from(new Set(assignedVessels.map((v) => v.status))).sort();

  const handleExportCsv = () => {
    const exportData = sortedAssignedVessels.map((v) => {
      const linkedSet = assuranceSets.find((s) => s.vesselId === v.id || s.vesselName === v.name);
      const effectiveDeadline = linkedSet?.revisedCompletionDate || linkedSet?.complianceDeadline || linkedSet?.targetDate || '';
      return {
        ImoNumber: v.imoNumber,
        VesselName: v.name,
        AssuranceCampaign: linkedSet ? linkedSet.title : 'N/A',
        Due: effectiveDeadline,
        Status: v.status,
      };
    });
    exportToCsv('Inspections', exportData);
  };

  const handleExportPdf = () => {
    const headers = ['IMO Number', 'Vessel', 'Assurance Set', 'Due', 'Operating Status'];
    const rows = sortedAssignedVessels.map((v) => {
      const linkedSet = assuranceSets.find((s) => s.vesselId === v.id || s.vesselName === v.name);
      const effectiveDeadline = linkedSet?.revisedCompletionDate || linkedSet?.complianceDeadline || linkedSet?.targetDate || '—';
      return [
        v.imoNumber,
        v.name,
        linkedSet ? linkedSet.title : 'N/A',
        effectiveDeadline,
        v.status,
      ];
    });
    exportToPdf('Inspections', headers, rows);
  };

  const vesselsPagination = usePagination(sortedAssignedVessels, [
    activeTab,
    searchQuery,
    statusFilter,
    sortField,
    sortDirection,
  ]);

  return (
    <div className="d-flex flex-column gap-4">
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
                  onClick={() => handleSort('status')}
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                >
                  Operating Status {renderSortIndicator('status')}
                </th>
                <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vesselsPagination.pageItems.map((v: VesselInformation) => {
                const linkedSet = assuranceSets.find((s) => s.vesselId === v.id || s.vesselName === v.name);
                const effectiveDeadline = linkedSet?.revisedCompletionDate || linkedSet?.complianceDeadline || linkedSet?.targetDate;
                const overdue = isVesselOverdue(v);
                let daysLate = 0;
                if (overdue && effectiveDeadline) {
                  const deadlineMs = new Date(effectiveDeadline).getTime();
                  const nowMs = new Date(toIsoLocalDate()).getTime();
                  const diff = Math.round((nowMs - deadlineMs) / (1000 * 60 * 60 * 24));
                  daysLate = Math.max(1, diff);
                }

                return (
                  <tr
                    key={v.id}
                    onClick={() => setCurrentHashView('inspector', v.name)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="font-mono-code fw-semibold text-primary">{v.imoNumber}</td>
                    <td>
                      <span className="fw-semibold text-dark">{v.name}</span>
                    </td>
                    <td>
                      {linkedSet ? (
                        <span className="font-mono-code text-secondary small">
                          {linkedSet.id} · {linkedSet.title}
                        </span>
                      ) : (
                        <span className="text-muted small">—</span>
                      )}
                    </td>
                    <td className="font-mono-code small due-cell">
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
                    <td>
                      <StatusBadge value={v.status} />
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
                  <td colSpan={6} className="text-center text-muted py-4 fst-italic">
                    No vessels found.
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
              Operating Status
            </label>
            <select
              className="form-select form-select-sm bg-white text-dark font-sans"
              style={{ borderColor: '#E2E8F0', fontSize: '0.84rem' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses ({vesselStatuses.length})</option>
              {vesselStatuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </FilterModal>
    </div>
  );
};
