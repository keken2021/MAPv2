/* 
  file summary: dedicated vessel capa tracking and re-inspection management table view in light theme.
  responsibilities: presents vessel corrective actions (capa) queue as a clean, neat, sortable master table and launches CapaReinspectionDrawer for detailed findings and evidence.
  role in system: full-page view rendered when clicking capa tracker in sidebar or inspector workspace (/capa or /capa/vesselName).
*/

import React, { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Eye, Search, AlertCircle } from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import { canSessionUserAccessCapa, filterVesselsForPersona, isAssuranceSetAssignedToPersona } from '../../utils/rbacHelpers';
import { useSessionUser } from '../../utils/useSessionUser';
import { AccessDeniedState } from '../common/AccessDeniedState';
import { exportToCsv, exportToPdf } from '../../utils/exportHelpers';
import { formatMaritimeDateTime, getStatusDisplayLabel } from '../../utils/formatters';
import { CapaItem, CapaStatus } from '../../types/capa';
import { CapaReinspectionDrawer } from '../drawers/CapaReinspectionDrawer';
import { FilterModal } from '../common/FilterModal';
import { ActiveFilterChips, FilterChip } from '../common/ActiveFilterChips';
import { CountTabs } from '../common/CountTabs';
import { ListToolbar } from '../common/ListToolbar';
import { EmptyState } from '../common/EmptyState';
import { StatusBadge } from '../common/StatusBadge';
import { DueCell } from '../common/DueCell';
import { usePagination } from '../../utils/usePagination';
import { useDeferredFilters } from '../../utils/useDeferredFilters';
import { TablePagination } from '../common/TablePagination';
import { filterCapaItemsByDashboardFilter } from '../../utils/dashboardTileNavigation';

export interface CapaTableProps {
  vesselName?: string;
  /** When set, locks the table to this vessel (preferred over vesselName). */
  vesselId?: string;
}

type CapaSortField = 'id' | 'vesselName' | 'title' | 'owner' | 'dueDate' | 'status';

/**
  what: renders clean, un-cramped vessel capa master table displaying essential columns and offloading detailed findings to CapaReinspectionDrawer.
  how: aggregates capaItems into a neat sortable table with status/vessel dropdown filters and launches CapaReinspectionDrawer on click.
  with what file: src/components/tables/CapaTable.tsx used by CapaManagementView and VesselDetailView.
*/
export const CapaTable: React.FC<CapaTableProps> = ({ vesselName, vesselId }) => {
  const {
    capaItems,
    vessels,
    assuranceSets,
    activePersona,
    activeDemoOrganization,
    users,
    setCurrentHashView,
    previousHashView,
    previousEntityId,
    logExport,
  } = useMapStore();
  const sessionUser = useSessionUser();

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  const accessibleSets = React.useMemo(
    () =>
      sessionUser
        ? assuranceSets.filter((set) =>
            isAssuranceSetAssignedToPersona(
              set,
              activePersona,
              activeDemoOrganization,
              sessionUser,
              users,
            ),
          )
        : [],
    [assuranceSets, activePersona, activeDemoOrganization, sessionUser, users],
  );

  const availableCapas = React.useMemo(
    () =>
      sessionUser
        ? capaItems.filter((c) =>
            canSessionUserAccessCapa(
              c,
              assuranceSets,
              activePersona,
              activeDemoOrganization,
              sessionUser,
              users,
            ),
          )
        : [],
    [capaItems, assuranceSets, activePersona, activeDemoOrganization, sessionUser, users],
  );

  const availableVessels = React.useMemo(
    () =>
      filterVesselsForPersona(
        vessels,
        assuranceSets,
        activePersona,
        activeDemoOrganization,
        sessionUser,
      ).filter(
        (v) =>
          availableCapas.some(
            (c) => c.vesselId === v.id || c.vesselName.toLowerCase() === v.name.toLowerCase(),
          ) ||
          accessibleSets.some(
            (s) => s.vesselId === v.id || s.vesselName?.toLowerCase() === v.name.toLowerCase(),
          ),
      ),
    [vessels, assuranceSets, activePersona, activeDemoOrganization, sessionUser, availableCapas, accessibleSets],
  );

  /* parse vesselName prop or target CAPA ID if passed as vesselName:capaId or CAPA ID */
  const lockedVessel = vesselId ? vessels.find((v) => v.id === vesselId) : undefined;
  const rawProp = decodeURIComponent(
    lockedVessel ? lockedVessel.name : (vesselName || ''),
  );
  let targetVesselName = rawProp;
  let targetCapaId: string | undefined = undefined;

  if (rawProp.includes(':')) {
    const parts = rawProp.split(':');
    targetVesselName = parts[0];
    targetCapaId = parts[1];
  } else if (rawProp) {
    const foundCapa =
      availableCapas.find((c) => c.id === rawProp) ?? capaItems.find((c) => c.id === rawProp);
    if (foundCapa || rawProp.startsWith('CAPA-')) {
      targetCapaId = rawProp;
      if (foundCapa) {
        targetVesselName = foundCapa.vesselName;
      }
    }
  }

  const isFleetOverview =
    !vesselId &&
    (!targetVesselName ||
      targetVesselName === '' ||
      targetVesselName === 'ALL' ||
      targetVesselName === 'ALL_FLEET' ||
      targetVesselName === 'All Vessels' ||
      targetVesselName === 'capa' ||
      targetVesselName === 'capas');

  const selectedVesselName = isFleetOverview
    ? 'All Fleet Vessels'
    : targetVesselName;

  const vesselCapas = isFleetOverview
    ? availableCapas
    : availableCapas.filter((c) => {
        if (vesselId) {
          return c.vesselId === vesselId || (lockedVessel && c.vesselName.toLowerCase() === lockedVessel.name.toLowerCase());
        }
        return (
          c.vesselName.toLowerCase() === selectedVesselName.toLowerCase() ||
          c.vesselId === selectedVesselName ||
          c.vesselName.toLowerCase().includes(selectedVesselName.toLowerCase()) ||
          selectedVesselName.toLowerCase().includes(c.vesselName.toLowerCase())
        );
      });

  /* filter, sort & search state */
  const [activeTab, setActiveTab] = useState<'All' | CapaStatus>(() => {
    if (typeof sessionStorage !== 'undefined') {
      const stored = sessionStorage.getItem('map_capa_tab_preselect');
      if (stored) {
        sessionStorage.removeItem('map_capa_tab_preselect');
        return stored as 'All' | CapaStatus;
      }
    }
    return 'All';
  });
  const [subFilter, setSubFilter] = useState<string>(() => {
    if (typeof sessionStorage !== 'undefined') {
      const stored = sessionStorage.getItem('map_capa_subfilter');
      if (stored) {
        sessionStorage.removeItem('map_capa_subfilter');
        return stored;
      }
    }
    return '';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<CapaSortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const committedVessel = isFleetOverview ? 'ALL_FLEET' : selectedVesselName;
  const filterState = useDeferredFilters<{
    vessel: string;
    status: 'All' | CapaStatus;
  }>({
    isOpen: isFilterModalOpen,
    applied: {
      vessel: committedVessel,
      status: activeTab,
    },
    defaults: {
      vessel: 'ALL_FLEET',
      status: 'All',
    },
    onCommit: (next) => {
      setActiveTab(next.status);
      if (!vesselId && next.vessel !== committedVessel) {
        setCurrentHashView('capas', next.vessel);
      }
    },
  });

  const draftActiveFilterCount =
    (!vesselId && filterState.draft.vessel !== 'ALL_FLEET' ? 1 : 0) +
    (filterState.draft.status !== 'All' ? 1 : 0);

  const handleResetFilters = () => {
    setActiveTab('All');
    setSubFilter('');
    setSearchQuery('');
    if (!isFleetOverview && !vesselId) {
      setCurrentHashView('capas', 'ALL_FLEET');
    }
  };

  const isFiltered = Boolean(searchQuery.trim() || activeTab !== 'All' || subFilter || !isFleetOverview);

  const activeChips: FilterChip[] = [
    ...(!isFleetOverview && !vesselId
      ? [{ id: 'vessel', label: 'Vessel', value: selectedVesselName, onRemove: () => setCurrentHashView('capas', 'ALL_FLEET') }]
      : []),
    ...(subFilter ? [{ id: 'subFilter', label: 'Filter', value: subFilter, onRemove: () => setSubFilter('') }] : []),
    ...(activeTab !== 'All' ? [{ id: 'status', label: 'Status', value: activeTab, onRemove: () => setActiveTab('All') }] : []),
  ];

  const activeFilterCount = activeChips.length;

  /* re-inspection drawer state */
  const [activeCapaId, setActiveCapaId] = useState<string | null>(null);
  const lastAutoOpenedCapaIdRef = React.useRef<string | undefined>(undefined);

  /* auto-open target CAPA item re-inspection drawer if targetCapaId is specified */
  React.useEffect(() => {
    if (!targetCapaId) {
      lastAutoOpenedCapaIdRef.current = undefined;
      return;
    }
    if (lastAutoOpenedCapaIdRef.current === targetCapaId) return;
    const found = availableCapas.find((c) => c.id === targetCapaId);
    if (found) {
      lastAutoOpenedCapaIdRef.current = targetCapaId;
      setActiveCapaId(found.id);
    }
  }, [targetCapaId, availableCapas]);

  const activeCapa = activeCapaId
    ? availableCapas.find((c) => c.id === activeCapaId) ?? null
    : null;

  /* compute capa KPI counts */
  const subFilteredCapas = subFilter
    ? filterCapaItemsByDashboardFilter(vesselCapas, subFilter)
    : vesselCapas;
  const totalCount = subFilteredCapas.length;
  const openCount = subFilteredCapas.filter((c) => c.status === 'Open').length;
  const reInspectionCount = subFilteredCapas.filter((c) => c.status === 'Under Re-Inspection').length;
  const closedCount = subFilteredCapas.filter((c) => c.status === 'Verified & Closed').length;

  /* apply search & status filtering */
  const filteredCapas = subFilteredCapas.filter((item) => {
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

  const exportSetId = (() => {
    if (isFleetOverview) return undefined;
    const ids = new Set(
      accessibleSets
        .filter(
          (set) =>
            set.vesselName.toLowerCase() === selectedVesselName.toLowerCase() ||
            set.vesselId === selectedVesselName,
        )
        .map((set) => set.id),
    );
    return ids.size === 1 ? [...ids][0] : undefined;
  })();

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
      ClosedDate: c.closedDate || '',
      EvidenceCount: c.evidences.length,
    }));
    exportToCsv(`${selectedVesselName.replace(/\s+/g, '_')}_CAPA_Report`, exportData);
    logExport({
      screen: `CAPA register · ${selectedVesselName}`,
      format: 'CSV',
      setId: exportSetId,
      detail: `${sortedCapas.length} findings`,
    });
  };

  const handleExportPdf = () => {
    const headers = ['CAPA ID', 'Vessel', 'Title', 'Status', 'Owner', 'Due Date'];
    const rows = sortedCapas.map((c) => [
      c.id,
      c.vesselName,
      `${c.title}\n(${c.checklistItemTitle})`,
      c.closedDate ? `${c.status} (Closed ${formatMaritimeDateTime(c.closedDate)})` : c.status,
      c.owner,
      c.dueDate,
    ]);
    exportToPdf(`${selectedVesselName} CAPA Re-Inspection Summary`, headers, rows);
    logExport({
      screen: `CAPA register · ${selectedVesselName}`,
      format: 'PDF',
      setId: exportSetId,
      detail: `${sortedCapas.length} findings`,
    });
  };


  const capasPagination = usePagination(sortedCapas, [committedVessel, activeTab, subFilter, searchQuery, sortField, sortOrder]);

  const capaTabs = [
    { key: 'All', label: 'All', count: totalCount },
    { key: 'Open', label: 'Open', count: openCount, tone: 'warn' as const },
    { key: 'Under Re-Inspection', label: 'Re-Inspection', count: reInspectionCount },
    { key: 'Verified & Closed', label: 'Closed', count: closedCount },
  ];

  if (
    !vesselId &&
    targetCapaId &&
    capaItems.some((c) => c.id === targetCapaId) &&
    !availableCapas.some((c) => c.id === targetCapaId)
  ) {
    return <AccessDeniedState onBack={() => setCurrentHashView('capas', 'ALL_FLEET')} />;
  }

  return (
    <div className="d-flex flex-column gap-4" data-testid={vesselId ? "vessel-scoped-capa-table" : undefined}>
      <div className="card map-card-custom">
        <div className="p-3 border-bottom">
          <CountTabs
            tabs={capaTabs}
            active={activeTab}
            onChange={(key) => setActiveTab(key as 'All' | CapaStatus)}
            aria-label="CAPA tabs"
          />
        </div>
        <ListToolbar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search CAPAs..."
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

        {/* Table Area */}
        <div className="table-responsive">
          <table className="table map-table-custom align-middle mb-0">
            <thead>
              <tr>
                {renderSortHeader('CAPA ID', 'id')}
                {renderSortHeader('Finding', 'title')}
                {renderSortHeader('Vessel', 'vesselName')}
                {renderSortHeader('Due Date', 'dueDate')}
                {renderSortHeader('Status', 'status')}
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {capasPagination.pageItems.map((capa) => (
                <tr key={capa.id} onClick={() => setActiveCapaId(capa.id)} style={{ cursor: 'pointer' }}>
                  <td>
                    <span className="font-mono-code fw-bold text-primary">{capa.id}</span>
                  </td>
                  <td>
                    <div className="fw-semibold text-dark" style={{ fontSize: '0.88rem' }}>
                      {capa.title}
                    </div>
                    {capa.flaggedForReinspection && (
                      <span className="badge bg-danger-subtle text-danger-emphasis border border-danger-subtle mt-0.5" style={{ fontSize: '0.65rem' }}>
                        Re-Inspection
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="fw-semibold text-dark small">{capa.vesselName}</div>
                  </td>
                  <td className="small due-cell">
                    <DueCell date={capa.dueDate} status={capa.status} />
                  </td>
                  <td>
                    <StatusBadge value={capa.status} />
                  </td>
                  <td className="text-end">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                      style={{ width: '32px', height: '32px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveCapaId(capa.id);
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
                  <td colSpan={6} className="p-0">
                    <EmptyState
                      icon={isFiltered ? Search : AlertCircle}
                      title={isFiltered ? 'No matches' : 'No CAPAs found'}
                      description={isFiltered ? undefined : 'Corrective action plans will appear here when raised during inspections'}
                      action={isFiltered ? { label: 'Clear filters', onClick: handleResetFilters } : undefined}
                    />
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
        onReset={filterState.resetDraft}
        onApply={filterState.applyDraft}
        title="Filters"
        activeCount={draftActiveFilterCount}
      >
        <div className="card p-3 bg-white border rounded">
          <div className="row g-3">
            {!vesselId && (
            <div className="col-md-6">
              <label className="form-label small fw-semibold text-secondary mb-1">Vessel</label>
              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={filterState.draft.vessel}
                onChange={(e) => filterState.setField('vessel', e.target.value)}
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
            )}

            <div className={vesselId ? 'col-12' : 'col-md-6'}>
              <label className="form-label small fw-semibold text-secondary mb-1">Status</label>
              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={filterState.draft.status}
                onChange={(e) => filterState.setField('status', e.target.value as 'All' | CapaStatus)}
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
          onClose={() => {
            setActiveCapaId(null);
            if (targetCapaId && !vesselId) {
              setCurrentHashView('capas', 'ALL_FLEET');
            }
          }}
        />
      )}
    </div>
  );
};
