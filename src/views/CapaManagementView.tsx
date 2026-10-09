/* 
  file summary: dedicated vessel capa tracking and re-inspection management table view in light theme.
  responsibilities: presents vessel corrective actions (capa) queue as a clean, neat, sortable master table and launches CapaReinspectionDrawer for detailed findings and evidence.
  role in system: full-page view rendered when clicking capa tracker in sidebar or inspector workspace (/capa or /capa/vesselName).
*/

import React, { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Eye } from 'lucide-react';
import { useMapStore } from '../store/useMapStore';
import { filterVesselsForPersona } from '../utils/rbacHelpers';
import { exportToCsv, exportToPdf } from '../utils/exportHelpers';
import { getStatusDisplayLabel } from '../utils/formatters';
import { CapaItem, CapaStatus } from '../types/capa';
import { CapaReinspectionDrawer } from '../components/drawers/CapaReinspectionDrawer';
import { FilterModal } from '../components/common/FilterModal';
import { FilterButton } from '../components/common/FilterButton';
import { ActiveFilterChips, FilterChip } from '../components/common/ActiveFilterChips';
import { usePagination } from '../utils/usePagination';
import { TablePagination } from '../components/common/TablePagination';

interface CapaManagementViewProps {
  vesselName?: string;
}

type CapaSortField = 'id' | 'vesselName' | 'title' | 'owner' | 'dueDate' | 'status';

/**
  what: renders clean, un-cramped vessel capa master table displaying essential columns and offloading detailed findings to CapaReinspectionDrawer.
  how: aggregates capaItems into a neat sortable table with status/vessel dropdown filters and launches CapaReinspectionDrawer on click.
  with what file: src/views/CapaManagementView.tsx loaded by App.tsx when currentHashView is capa or capas.
*/
export const CapaManagementView: React.FC<CapaManagementViewProps> = ({ vesselName }) => {
  const {
    capaItems,
    vessels,
    assuranceSets,
    activePersona,
    setCurrentHashView,
    previousHashView,
    previousEntityId,
  } = useMapStore();

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);


  /* filter available vessels and capas for non-admin personas */
  const availableVessels =
    activePersona === 'Administrator'
      ? vessels
      : filterVesselsForPersona(vessels, assuranceSets, activePersona);

  const availableCapas =
    activePersona === 'Administrator'
      ? capaItems
      : capaItems.filter((c) =>
          availableVessels.some(
            (v) =>
              v.name.toLowerCase() === c.vesselName.toLowerCase() ||
              v.id === c.vesselId
          )
        );

  /* parse vesselName prop or target CAPA ID if passed as vesselName:capaId or CAPA ID */
  const rawProp = decodeURIComponent(vesselName || '');
  let targetVesselName = rawProp;
  let targetCapaId: string | undefined = undefined;

  if (rawProp.includes(':')) {
    const parts = rawProp.split(':');
    targetVesselName = parts[0];
    targetCapaId = parts[1];
  } else if (rawProp.startsWith('CAPA-')) {
    targetCapaId = rawProp;
    const foundCapa = availableCapas.find((c) => c.id === rawProp);
    if (foundCapa) {
      targetVesselName = foundCapa.vesselName;
    }
  }

  const isFleetOverview =
    !targetVesselName ||
    targetVesselName === '' ||
    targetVesselName === 'ALL' ||
    targetVesselName === 'ALL_FLEET' ||
    targetVesselName === 'All Vessels' ||
    targetVesselName === 'capa' ||
    targetVesselName === 'capas';

  const selectedVesselName = isFleetOverview
    ? 'All Fleet Vessels'
    : targetVesselName;

  const vesselCapas = isFleetOverview
    ? availableCapas
    : availableCapas.filter(
        (c) =>
          c.vesselName.toLowerCase() === selectedVesselName.toLowerCase() ||
          c.vesselId === selectedVesselName ||
          c.vesselName.toLowerCase().includes(selectedVesselName.toLowerCase()) ||
          selectedVesselName.toLowerCase().includes(c.vesselName.toLowerCase())
      );

  /* filter, sort & search state */
  const [activeTab, setActiveTab] = useState<'All' | CapaStatus>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [sortField, setSortField] = useState<CapaSortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleResetFilters = () => {
    setActiveTab('All');
    setSearchQuery('');
    if (!isFleetOverview) {
      setCurrentHashView('capas', 'ALL_FLEET');
    }
  };

  const activeChips: FilterChip[] = [
    ...(!isFleetOverview ? [{ id: 'vessel', label: 'Vessel', value: selectedVesselName, onRemove: () => setCurrentHashView('capas', 'ALL_FLEET') }] : []),
    ...(activeTab !== 'All' ? [{ id: 'status', label: 'Status', value: activeTab, onRemove: () => setActiveTab('All') }] : []),
  ];

  const activeFilterCount = activeChips.length;

  /* re-inspection drawer state */
  const [activeCapa, setActiveCapa] = useState<CapaItem | null>(null);

  /* auto-open target CAPA item re-inspection drawer if targetCapaId is specified */
  React.useEffect(() => {
    if (targetCapaId) {
      const found = capaItems.find((c) => c.id === targetCapaId);
      if (found) {
        setActiveCapa(found);
      }
    }
  }, [targetCapaId, capaItems]);

  /* compute capa KPI counts */
  const totalCount = vesselCapas.length;
  const openCount = vesselCapas.filter((c) => c.status === 'Open').length;
  const reInspectionCount = vesselCapas.filter((c) => c.status === 'Under Re-Inspection').length;
  const closedCount = vesselCapas.filter((c) => c.status === 'Verified & Closed').length;

  /* apply search & status filtering */
  const filteredCapas = vesselCapas.filter((item) => {
    const matchesTab = activeTab === 'All' || item.status === activeTab;
    const matchesSearch =
      item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.vesselName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.owner.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.findingDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.checklistItemTitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  /* apply column sorting */
  const sortedCapas = [...filteredCapas].sort((a, b) => {
    let valA = (a[sortField] || '').toString().toLowerCase();
    let valB = (b[sortField] || '').toString().toLowerCase();

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (field: CapaSortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const renderSortHeader = (label: string, field: CapaSortField) => (
    <th
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
      onClick={() => handleSort(field)}
    >
      {label}{' '}
      {sortField !== field ? (
        <ArrowUpDown size={14} className="text-muted ms-1 opacity-50 inline-block align-middle" />
      ) : sortOrder === 'asc' ? (
        <ArrowUp size={14} className="text-primary ms-1 inline-block align-middle" />
      ) : (
        <ArrowDown size={14} className="text-primary ms-1 inline-block align-middle" />
      )}
    </th>
  );

  const handleExportCsv = () => {
    const exportData = sortedCapas.map((c) => ({
      CapaId: c.id,
      Vessel: c.vesselName,
      ChecklistItem: c.checklistItemTitle,
      Title: c.title,
      FindingDescription: c.findingDescription,
      Status: c.status,
      Owner: c.owner,
      DueDate: c.dueDate,
      InspectorNotes: c.inspectorNotes || 'None',
      EvidenceCount: c.evidences.length,
    }));
    exportToCsv(`${selectedVesselName.replace(/\s+/g, '_')}_CAPA_Report`, exportData);
    setIsExportOpen(false);
  };

  const handleExportPdf = () => {
    const headers = ['CAPA ID', 'Vessel', 'Title', 'Status', 'Owner', 'Due Date'];
    const rows = sortedCapas.map((c) => [
      c.id,
      c.vesselName,
      `${c.title}\n(${c.checklistItemTitle})`,
      c.status,
      c.owner,
      c.dueDate,
    ]);
    exportToPdf(`${selectedVesselName} CAPA Re-Inspection Summary`, headers, rows);
    setIsExportOpen(false);
  };

  const getStatusBadgeClass = (status: CapaStatus) => {
    switch (status) {
      case 'Verified & Closed':
        return 'bg-success text-white';
      case 'Under Re-Inspection':
        return 'bg-warning text-dark';
      case 'Rectification Required':
        return 'bg-danger text-white';
      case 'Open':
      default:
        return 'bg-secondary text-white';
    }
  };

  const capasPagination = usePagination(sortedCapas, [activeTab, searchQuery, sortField, sortOrder]);

  return (
    <div className="d-flex flex-column gap-4">
      {/* CAPA Metric KPI Cards */}
      <div className="row g-3">
        <div className="col-md-3">
          <div className="card map-kpi-card shadow-2xs">
            <div className="map-kpi-label">
              CAPAs
            </div>
            <div className="map-kpi-value text-primary mt-1">{totalCount}</div>
            <div className="map-kpi-subtitle mt-1">All CAPAs</div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card map-kpi-card shadow-2xs">
            <div className="map-kpi-label">
              Open
            </div>
            <div className="map-kpi-value text-danger mt-1">{openCount}</div>
            <div className="map-kpi-subtitle mt-1">Waiting to be fixed</div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card map-kpi-card shadow-2xs">
            <div className="map-kpi-label">
              Re-Inspection
            </div>
            <div className="map-kpi-value text-warning mt-1">{reInspectionCount}</div>
            <div className="map-kpi-subtitle mt-1">Waiting for the inspector</div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card map-kpi-card shadow-2xs">
            <div className="map-kpi-label">
              Closed
            </div>
            <div className="map-kpi-value text-success mt-1">{closedCount}</div>
            <div className="map-kpi-subtitle mt-1">Verified by the inspector</div>
          </div>
        </div>
      </div>

      {/* Main CAPA Master Table Card */}
      <div className="card map-card-custom">
        {/* Controls Header: Search + Filter Button + Export */}
        <div className="card-header d-flex flex-wrap align-items-center justify-between gap-3 p-3">
          <div className="d-flex flex-wrap align-items-center gap-2">
            {/* Search Input */}
            <input
              type="text"
              className="form-control form-control-sm bg-white text-dark border-secondary"
              placeholder="Search CAPAs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '270px' }}
            />

            <FilterButton
              onClick={() => setIsFilterModalOpen(true)}
              activeCount={activeFilterCount}
            />
          </div>

          <div className="dropdown position-relative ms-auto">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary text-dark dropdown-toggle ms-2"
              onClick={() => setIsExportOpen(!isExportOpen)}
            >
              Export
            </button>
            {isExportOpen && (
              <ul className="dropdown-menu dropdown-menu-light show position-absolute end-0 mt-1 shadow border" style={{ zIndex: 1050 }}>
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

        {activeChips.length > 0 && (
          <div className="px-3 py-2 bg-light border-bottom">
            <ActiveFilterChips chips={activeChips} onClearAll={handleResetFilters} />
          </div>
        )}

        {/* Table Area */}
        <div className="table-responsive">
          <table className="table map-table-custom align-middle mb-0">
            <thead>
              <tr>
                {renderSortHeader('CAPA ID', 'id')}
                {renderSortHeader('Finding & Description', 'title')}
                {renderSortHeader('Vessel Scope & Owner', 'vesselName')}
                {renderSortHeader('Due Date', 'dueDate')}
                {renderSortHeader('Status', 'status')}
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {capasPagination.pageItems.map((capa) => (
                <tr key={capa.id} onClick={() => setActiveCapa(capa)} style={{ cursor: 'pointer' }}>
                  <td>
                    <span className="font-mono-code fw-bold text-primary">{capa.id}</span>
                  </td>
                  <td>
                    <div className="fw-semibold text-dark" style={{ fontSize: '0.88rem' }}>
                      {capa.title}
                    </div>
                    {capa.flaggedForReinspection && (
                      <span className="badge bg-danger-subtle text-danger-emphasis border border-danger-subtle mt-0.5" style={{ fontSize: '0.65rem' }}>
                        Flagged for Re-Inspection
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="fw-semibold text-dark font-mono-code small">{capa.vesselName}</div>
                    <div className="small text-secondary">{capa.owner}</div>
                  </td>
                  <td className="font-mono-code small">{capa.dueDate}</td>
                  <td>
                    <span className={`badge ${getStatusBadgeClass(capa.status)}`}>
                      {getStatusDisplayLabel(capa.status)}
                    </span>
                  </td>
                  <td className="text-end">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                      style={{ width: '32px', height: '32px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveCapa(capa);
                      }}
                      title="View"
                      aria-label="View"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}

              {sortedCapas.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4 fst-italic">
                    No CAPAs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePagination {...capasPagination.controls} />
      </div>

      {/* CAPA Filter Modal */}
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
              <label className="form-label small fw-semibold text-secondary mb-1">Vessel</label>
              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={isFleetOverview ? 'ALL_FLEET' : selectedVesselName}
                onChange={(e) => setCurrentHashView('capas', e.target.value)}
              >
                <option value="ALL_FLEET">
                  {activePersona === 'Submitter' ? 'All Assigned Vessels' : 'All Fleet Vessels'} ({availableCapas.length})
                </option>
                {availableVessels.map((v) => {
                  const vesselCapaCount = availableCapas.filter(
                    (c) => c.vesselName.toLowerCase() === v.name.toLowerCase() || c.vesselId === v.id
                  ).length;
                  return (
                    <option key={v.id} value={v.name}>
                      {v.name} ({vesselCapaCount})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-semibold text-secondary mb-1">Status</label>
              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value as any)}
              >
                <option value="All">All Statuses</option>
                <option value="Open">Open</option>
                <option value="Under Re-Inspection">Re-Inspection</option>
                <option value="Rectification Required">Rectification Required</option>
                <option value="Verified & Closed">Closed</option>
              </select>
            </div>
          </div>
        </div>
      </FilterModal>

      {/* Interactive CAPA Re-Inspection & Evidence Drawer */}
      {activeCapa && (
        <CapaReinspectionDrawer
          capa={activeCapa}
          onClose={() => setActiveCapa(null)}
        />
      )}
    </div>
  );
};
