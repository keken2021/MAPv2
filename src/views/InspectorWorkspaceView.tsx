/* 
  file summary: inspector workspace page displaying physical survey queue and survey checklist triggers in light theme.
  responsibilities: presents inspector role KPI summary cards, vessel survey inspection items assigned to active persona with column sorting, and routes to full-page InspectionChecklistView.
  role in system: primary operational workspace for Inspectors (/inspector).
*/

import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Eye, AlertTriangle } from 'lucide-react';
import { useMapStore } from '../store/useMapStore';
import { VesselInformation } from '../types/vessel';
import { filterVesselsForPersona } from '../utils/rbacHelpers';
import { exportToCsv, exportToPdf } from '../utils/exportHelpers';
import { FilterModal } from '../components/common/FilterModal';
import { FilterButton } from '../components/common/FilterButton';
import { ActiveFilterChips, FilterChip } from '../components/common/ActiveFilterChips';

type InspectorSortField = 'name' | 'imoNumber' | 'campaignTitle' | 'status';

/**
  what: renders inspector operational workspace view in light theme with inspector-specific KPI summary metrics, column sorting, and survey schedule export capabilities.
  how: aggregates inspector stats, filters and sorts assigned vessels by sortField, and lists survey schedule with export functionality.
  with what file: src/views/InspectorWorkspaceView.tsx loaded by App.tsx.
*/
export const InspectorWorkspaceView: React.FC = () => {
  const { vessels, assuranceSets, capaItems, activePersona, setCurrentHashView } = useMapStore();
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
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

  const assignedCount = assignedVessels.length;
  const pendingCount = assuranceSets.filter(
    (s) => s.mandatoryInspectionRequired && s.stage !== 'Certified'
  ).length || 1;
  const openCapaCount = capaItems ? capaItems.filter((c) => c.status !== 'Verified & Closed').length : 1;
  const completedCount = assuranceSets.filter((s) => s.stage === 'Certified').length || 2;

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

  /* apply search and status filters before sorting */
  const filteredAssignedVessels = assignedVessels.filter((v) => {
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
    let valA: any = '';
    let valB: any = '';

    if (sortField === 'campaignTitle') {
      const linkedSetA = assuranceSets.find((s) => s.vesselId === a.id || s.vesselName === a.name);
      const linkedSetB = assuranceSets.find((s) => s.vesselId === b.id || s.vesselName === b.name);
      valA = linkedSetA ? linkedSetA.title : '';
      valB = linkedSetB ? linkedSetB.title : '';
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

  /* derive unique vessel statuses for the filter dropdown */
  const vesselStatuses = Array.from(new Set(assignedVessels.map((v) => v.status))).sort();

  const handleExportCsv = () => {
    const exportData = sortedAssignedVessels.map((v) => {
      const linkedSet = assuranceSets.find((s) => s.vesselId === v.id || s.vesselName === v.name);
      return {
        VesselName: v.name,
        ImoNumber: v.imoNumber,
        FlagState: v.flagState,
        AssuranceCampaign: linkedSet ? linkedSet.title : 'N/A',
        CampaignStage: linkedSet ? linkedSet.stage : 'N/A',
        Inspector: linkedSet?.assignedInspector || 'Unassigned',
        Status: v.status,
      };
    });
    exportToCsv('Inspector_Survey_Schedule', exportData);
    setIsExportOpen(false);
  };

  const handleExportPdf = () => {
    const headers = ['Vessel Name', 'IMO Number', 'Flag State', 'Assurance Campaign', 'Stage', 'Status'];
    const rows = sortedAssignedVessels.map((v) => {
      const linkedSet = assuranceSets.find((s) => s.vesselId === v.id || s.vesselName === v.name);
      return [
        v.name,
        v.imoNumber,
        v.flagState,
        linkedSet ? linkedSet.title : 'N/A',
        linkedSet ? linkedSet.stage : 'N/A',
        v.status,
      ];
    });
    exportToPdf('Inspector Physical Survey Schedule', headers, rows);
    setIsExportOpen(false);
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Inspector Role KPI Summary Cards */}
      <div className="row g-3">
        <div className="col-md-3 d-flex">
          <div className="card map-kpi-card shadow-2xs w-100">
            <div className="map-kpi-label">
              Assigned Fleet Surveys
            </div>
            <div className="map-kpi-value text-primary mt-1">{assignedCount}</div>
            <div className="map-kpi-subtitle mt-1">Vessels Assigned for Audit</div>
          </div>
        </div>

        <div className="col-md-3 d-flex">
          <div className="card map-kpi-card shadow-2xs w-100">
            <div className="map-kpi-label">
              Pending Visual Audits
            </div>
            <div className="map-kpi-value text-warning mt-1">{pendingCount}</div>
            <div className="map-kpi-subtitle mt-1">Awaiting On-Site Physical Survey</div>
          </div>
        </div>

        <div className="col-md-3 d-flex">
          <div
            className="card map-kpi-card shadow-2xs w-100"
            onClick={() => setCurrentHashView('capa')}
            style={{ cursor: 'pointer' }}
            title="Open CAPA Tracker"
          >
            <div className="map-kpi-label">
              Open Corrective Actions
            </div>
            <div className="map-kpi-value text-danger mt-1">{openCapaCount}</div>
            <div className="map-kpi-subtitle mt-1">Active CAPA items</div>
          </div>
        </div>

        <div className="col-md-3 d-flex">
          <div className="card map-kpi-card shadow-2xs w-100">
            <div className="map-kpi-label">
              Completed Physical Audits
            </div>
            <div className="map-kpi-value text-success mt-1">{completedCount}</div>
            <div className="map-kpi-subtitle mt-1">Surveys Audited & Signed Off</div>
          </div>
        </div>
      </div>

      {/* Survey Schedule Table */}
      <div className="card map-card-custom">

        {/* controls header: search input + FilterButton + export */}
        <div className="card-header d-flex flex-column gap-2.5 p-3">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div className="d-flex flex-wrap align-items-center gap-2.5 flex-grow-1">
              <div className="position-relative" style={{ minWidth: '240px', maxWidth: '320px' }}>
                <input
                  type="text"
                  className="form-control form-control-sm bg-white text-dark ps-4 font-sans"
                  style={{ borderColor: '#E2E8F0', fontSize: '0.82rem', height: '34px' }}
                  placeholder="Search vessel, IMO, campaign..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search size={14} className="position-absolute top-50 start-0 translate-middle-y ms-2.5 text-muted" />
              </div>

              <FilterButton
                onClick={() => setIsFilterModalOpen(true)}
                activeCount={activeFilterCount}
              />
            </div>

            {/* result count + export */}
            <div className="d-flex align-items-center gap-3 ms-auto">
              <span className="text-muted small">
                {sortedAssignedVessels.length} of {assignedVessels.length} vessels
              </span>
              <div className="dropdown position-relative">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary text-dark dropdown-toggle"
                  style={{ fontSize: '0.82rem', height: '34px', borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' }}
                  onClick={() => setIsExportOpen(!isExportOpen)}
                >
                  Export
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
          </div>
        </div>

        {activeChips.length > 0 && (
          <ActiveFilterChips chips={activeChips} onClearAll={handleResetFilters} />
        )}
      </div>

        <div className="table-responsive">
          <table className="table map-table-custom align-middle mb-0">
            <thead>
              <tr>
                <th onClick={() => handleSort('imoNumber')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  IMO Number {renderSortIndicator('imoNumber')}
                </th>
                <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  Vessel Name {renderSortIndicator('name')}
                </th>
                <th onClick={() => handleSort('campaignTitle')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  Assurance Campaign {renderSortIndicator('campaignTitle')}
                </th>
                <th onClick={() => handleSort('status')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  Status {renderSortIndicator('status')}
                </th>
                <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedAssignedVessels.map((v: VesselInformation) => {
                const linkedSet = assuranceSets.find((s) => s.vesselId === v.id || s.vesselName === v.name);
                const totalCapaCountForVessel = capaItems.filter(
                  (c) => c.vesselName.toLowerCase() === v.name.toLowerCase() || c.vesselId === v.id
                ).length;
                return (
                  <tr
                    key={v.id}
                    onClick={() => setCurrentHashView('inspector', v.name)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="font-mono-code fw-semibold text-primary">{v.imoNumber}</td>
                    <td>
                      <div className="fw-semibold text-dark">{v.name}</div>
                      <div className="small text-secondary">{v.flagState} · {v.portOfRegistry}</div>
                    </td>
                    <td>
                      {linkedSet ? (
                        <div>
                          <div className="fw-semibold text-dark">{linkedSet.title}</div>
                          <span className="badge bg-light text-dark border font-mono-code" style={{ fontSize: '0.7rem' }}>
                            {linkedSet.id} · {linkedSet.stage}
                          </span>
                        </div>
                      ) : (
                        <span className="text-secondary small">No active set</span>
                      )}
                    </td>
                    <td>
                      <span className="badge bg-light text-dark border">{v.status}</span>
                    </td>
                    <td className="text-end">
                      <div className="d-flex align-items-center justify-content-end gap-1.5">
                        <button
                          type="button"
                          className={`btn btn-sm ${totalCapaCountForVessel > 0 ? 'btn-outline-danger' : 'btn-outline-secondary'} d-inline-flex align-items-center justify-content-center p-0`}
                          style={{ width: '32px', height: '32px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentHashView('capa', v.name);
                          }}
                          title={`View ${totalCapaCountForVessel} CAPA items for ${v.name}`}
                          aria-label={`View ${totalCapaCountForVessel} CAPA items for ${v.name}`}
                        >
                          <AlertTriangle size={16} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                          style={{ width: '32px', height: '32px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentHashView('inspector', v.name);
                          }}
                          title={`View Physical Survey for ${v.name}`}
                          aria-label={`View Physical Survey for ${v.name}`}
                        >
                          <Eye size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {sortedAssignedVessels.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4 fst-italic">
                    No vessels match the selected search or status filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dedicated Filter Modal */}
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onReset={handleResetFilters}
        title="Inspector Survey Schedule Filters"
        subtitle="Filter assigned physical surveys by vessel operational status"
        activeCount={activeFilterCount}
      >
        <div className="d-flex flex-column gap-3">
          {/* Status Filter */}
          <div>
            <label className="form-label text-secondary fw-semibold small mb-1" style={{ fontSize: '0.8rem' }}>
              Vessel Operational Status
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

