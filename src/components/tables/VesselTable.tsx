/* 
  file summary: master fleet registry table component featuring grouped search/filters on left, interactive column sorting, and grouped export/register buttons on right.
  responsibilities: renders list of vessels with search filters, multi-column sorting by header clicks, and export/register action buttons.
  role in system: main data table for FleetRegistryView.tsx.
*/

import React, { useEffect, useState, useMemo } from 'react';
import { LayoutGrid, Table as TableIcon, Check, MoreHorizontal, ArrowUpDown, ArrowUp, ArrowDown, Eye } from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import { VesselInformation } from '../../types/vessel';
import { ReadinessGauge } from '../common/ReadinessGauge';
import { FilterModal } from '../common/FilterModal';
import { CountTabs } from '../common/CountTabs';
import { ListToolbar } from '../common/ListToolbar';
import { StatusBadge } from '../common/StatusBadge';
import { ActiveFilterChips, FilterChip } from '../common/ActiveFilterChips';
import { exportToCsv, exportToPdf } from '../../utils/exportHelpers';
import {
  getVesselStockPhoto,
  getVesselListingContact,
  getVesselCharterBadge,
  getOrganizationLogo,
} from '../../utils/vesselImageHelpers';

import { useSessionUser } from '../../utils/useSessionUser';
import {
  filterCAdminActiveCharters,
  filterVesselAdminChartered,
  filterVesselsForPersona,
  isAssuranceSetAssignedToPersona,
  isVesselOwnedByAdmin,
  isVesselOwnedByClientOrg,
  matchesVesselSearch,
} from '../../utils/rbacHelpers';
import type { FleetRegistryTab } from '../../utils/rbacHelpers';
import { canPerform } from '../../utils/permissionHelpers';
import { calculateVesselReadiness } from '../../utils/readinessHelpers';
import { usePagination } from '../../utils/usePagination';
import { TablePagination } from '../common/TablePagination';
import { deriveObjectVerification } from '../../utils/documentVersionSnapshot';
import { ObjectVerificationBadge } from '../common/ObjectVerificationBadge';

type VesselSortField =
  | 'imoNumber'
  | 'name'
  | 'classNotation'
  | 'flagState'
  | 'registeredOwner'
  | 'status'
  | 'complianceReadinessScore';

interface VesselTableProps {
  onSelectVessel: (vessel: VesselInformation) => void;
  onRegisterVessel?: () => void;
  filterMode?: FleetRegistryTab;
}

/**
  what: renders master fleet registry table with search filters, column sorting, and export/register actions.
  how: filters and sorts base vessels by persona and sortField, rendering interactive table rows and header controls.
  with what file: src/components/tables/VesselTable.tsx loaded by FleetRegistryView.tsx.
*/
export const VesselTable: React.FC<VesselTableProps> = ({
  onSelectVessel,
  onRegisterVessel,
  filterMode: filterModeProp,
}) => {
  const {
    vessels,
    assuranceSets,
    documents,
    setActiveVesselId,
    activePersona,
    rolePermissionDefaults,
    userPermissionOverrides,
    customScopes,
    users,
    activeDemoOrganization,
  } = useMapStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [flagFilter, setFlagFilter] = useState('ALL');
  const [classFilter, setClassFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [assuranceSetFilter, setAssuranceSetFilter] = useState('ALL');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [sortField, setSortField] = useState<VesselSortField>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const sessionUser = useSessionUser();
  const [internalFilterMode, setInternalFilterMode] = useState<FleetRegistryTab>(
    activePersona === 'C Admin' ? 'chartered' : 'owned',
  );
  const filterMode = filterModeProp ?? internalFilterMode;
  const isVesselAdmin = activePersona === 'Administrator';
  const isClientAdmin = activePersona === 'C Admin';

  useEffect(() => {
    if (filterModeProp) return;
    setInternalFilterMode(isClientAdmin ? 'chartered' : isVesselAdmin ? 'owned' : 'all');
  }, [activePersona, filterModeProp, isClientAdmin, isVesselAdmin]);
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);

  const availableAssuranceSets = useMemo(() => {
    return assuranceSets.filter((set) =>
      isAssuranceSetAssignedToPersona(set, activePersona, activeDemoOrganization, sessionUser),
    );
  }, [assuranceSets, activePersona, activeDemoOrganization, sessionUser]);

  const matchingUser = users.find((u) => u.roles.includes(activePersona)) ?? null;
  const canRegister =
    activePersona === 'Administrator' ||
    canPerform(
      rolePermissionDefaults,
      userPermissionOverrides,
      matchingUser,
      activePersona,
      'vessels',
      'create',
      customScopes,
    );

  const isVesselOwned = isVesselOwnedByAdmin;

  const viewerOrg = matchingUser?.organization;
  const ownedVessels = isClientAdmin
    ? vessels.filter((vessel) => isVesselOwnedByClientOrg(vessel, viewerOrg ?? ''))
    : activePersona === 'Submitter'
      ? filterVesselsForPersona(vessels, assuranceSets, activePersona, activeDemoOrganization, sessionUser)
      : vessels.filter(isVesselOwned);
  const charteredVessels = isClientAdmin
    ? filterCAdminActiveCharters(vessels, assuranceSets)
    : filterVesselAdminChartered(vessels, assuranceSets, viewerOrg);

  const baseVessels =
    activePersona === 'C Admin'
      ? filterMode === 'owned'
        ? ownedVessels
        : charteredVessels
      : activePersona === 'Administrator'
        ? filterMode === 'chartered'
          ? charteredVessels
          : filterMode === 'all'
          ? vessels.filter((v) => !isVesselOwned(v) && v.status !== 'Under Charter')
          : filterMode === 'owned'
            ? ownedVessels
            : filterVesselsForPersona(vessels, assuranceSets, activePersona, activeDemoOrganization, sessionUser)
        : filterVesselsForPersona(vessels, assuranceSets, activePersona, activeDemoOrganization, sessionUser);

  /* empty-state copy: an empty chartered list is explained, a filtered-out list points at the filters */
  const isCharteredEmpty = filterMode === 'chartered' && baseVessels.length === 0;
  const emptyTitle = isCharteredEmpty ? 'No chartered vessels yet' : 'No vessels match your search';
  const emptyHint = isCharteredEmpty
    ? 'Vessels from other organizations appear here once an assurance set names your organization as the client. Start one from a Marketplace listing.'
    : 'Try adjusting filters or search terms.';

  const filteredVessels = baseVessels.filter((v) => {
    if (activePersona === 'C Admin' && v.status === 'Under Charter') {
      return false;
    }
    if (filterMode === 'all' && v.status === 'Under Charter') {
      return false;
    }

    const matchesSearch = matchesVesselSearch(v, searchTerm, assuranceSets, documents);

    const matchesFlag = flagFilter === 'ALL' || v.flagState === flagFilter;
    const matchesClass = classFilter === 'ALL' || v.classificationSociety === classFilter;
    const matchesStatus =
      statusFilter === 'ALL' || v.status === statusFilter;
    const matchesAssuranceSet =
      assuranceSetFilter === 'ALL' ||
      assuranceSets.some(
        (set) =>
          set.id === assuranceSetFilter &&
          (set.vesselId === v.id ||
            (set.vesselName && v.name && set.vesselName.toLowerCase() === v.name.toLowerCase()) ||
            (set.imoNumber && v.imoNumber && set.imoNumber === v.imoNumber))
      );

    return matchesSearch && matchesFlag && matchesClass && matchesStatus && matchesAssuranceSet;
  });

  const handleSort = (field: VesselSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIndicator = (field: VesselSortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={14} className="text-muted ms-1 opacity-50 inline-block align-middle" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp size={14} className="text-primary ms-1 inline-block align-middle" />
    ) : (
      <ArrowDown size={14} className="text-primary ms-1 inline-block align-middle" />
    );
  };

  const sortedVessels = [...filteredVessels].sort((a, b) => {
    let valA: any = '';
    let valB: any = '';

    if (sortField === 'complianceReadinessScore') {
      valA = calculateVesselReadiness(a, assuranceSets, documents);
      valB = calculateVesselReadiness(b, assuranceSets, documents);
    } else {
      valA = a[sortField] ?? '';
      valB = b[sortField] ?? '';
    }

    if (typeof valA === 'string') {
      valA = valA.toLowerCase();
    }
    if (typeof valB === 'string') {
      valB = valB.toLowerCase();
    }

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleExportCsv = () => {
    const exportData = sortedVessels.map((v) => ({
      VesselName: v.name,
      VesselType: v.vesselType,
      VesselSubtype: v.vesselSubtype,
      Organization: v.registeredOwner,
      ImoNumber: v.imoNumber,
      OfficialRegNumber: v.officialRegNumber,
      MmsiNumber: v.mmsiNumber,
      CallSign: v.callSign,
      FlagState: v.flagState,
      ClassSociety: v.classificationSociety,
      Status: v.status,
      ReadinessScore: `${calculateVesselReadiness(v, assuranceSets, documents)}%`,
    }));
    exportToCsv('Master_Fleet_Registry', exportData);
  };

  const handleExportPdf = () => {
    const headers = ['Name', 'Type', 'Organization', 'IMO Number', 'Flag State', 'Class Society', 'Operating Status', 'Readiness'];
    const rows = sortedVessels.map((v) => [
      v.name,
      v.vesselSubtype || v.vesselType,
      v.registeredOwner,
      v.imoNumber,
      v.flagState,
      v.classificationSociety,
      v.status,
      `${calculateVesselReadiness(v, assuranceSets, documents)}%`,
    ]);
    exportToPdf('Master Fleet Registry', headers, rows);
  };

  const activeFilterCount =
    (flagFilter !== 'ALL' ? 1 : 0) +
    (classFilter !== 'ALL' ? 1 : 0) +
    (statusFilter !== 'ALL' ? 1 : 0) +
    (assuranceSetFilter !== 'ALL' ? 1 : 0);

  const activeChips: FilterChip[] = [
    ...(flagFilter !== 'ALL' ? [{ id: 'flag', label: 'Flag State', value: flagFilter, onRemove: () => setFlagFilter('ALL') }] : []),
    ...(classFilter !== 'ALL' ? [{ id: 'class', label: 'Class Society', value: classFilter, onRemove: () => setClassFilter('ALL') }] : []),
    ...(statusFilter !== 'ALL' ? [{ id: 'status', label: 'Operating Status', value: statusFilter, onRemove: () => setStatusFilter('ALL') }] : []),
    ...(assuranceSetFilter !== 'ALL' ? [{ id: 'set', label: 'Assurance Set', value: assuranceSetFilter, onRemove: () => setAssuranceSetFilter('ALL') }] : []),
  ];

  const handleResetFilters = () => {
    setFlagFilter('ALL');
    setClassFilter('ALL');
    setStatusFilter('ALL');
    setAssuranceSetFilter('ALL');
  };

  const vesselsPagination = usePagination(sortedVessels, [searchTerm, flagFilter, classFilter, statusFilter, assuranceSetFilter, filterMode, sortField, sortDirection]);

  const vesselTabs = (isVesselAdmin || isClientAdmin)
    ? [
        { key: 'owned', label: 'Own', count: ownedVessels.length },
        { key: 'chartered', label: 'Chartered', count: charteredVessels.length },
      ]
    : [{ key: 'all', label: 'All', count: baseVessels.length }];

  return (
    <div className="card map-card-custom">
      <div className="p-3 border-bottom">
        <CountTabs
          tabs={vesselTabs}
          active={filterMode}
          onChange={(key) => setInternalFilterMode(key as FleetRegistryTab)}
          aria-label="Vessel tabs"
        />
      </div>
      <ListToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search vessels..."
        onFilterClick={() => setIsFilterModalOpen(true)}
        activeFilterCount={activeFilterCount}
        onExportCsv={handleExportCsv}
        onExportPdf={handleExportPdf}
        primaryAction={
          canRegister && onRegisterVessel ? (
            <button type="button" className="btn btn-sm btn-primary" onClick={onRegisterVessel}>
              Add Vessel
            </button>
          ) : undefined
        }
      >
          <div className="dropdown position-relative">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary text-dark d-flex align-items-center gap-1.5 px-2.5 py-1"
              onClick={() => setIsViewDropdownOpen(!isViewDropdownOpen)}
              title={viewMode === 'grid' ? 'Grid View' : 'Table View'}
              aria-label="View mode"
            >
              {viewMode === 'grid' ? (
                <LayoutGrid size={15} />
              ) : (
                <TableIcon size={15} />
              )}
            </button>
            {isViewDropdownOpen && (
              <ul className="dropdown-menu dropdown-menu-light show position-absolute end-0 mt-1 shadow border py-1" style={{ minWidth: '120px' }}>
                <li>
                  <button
                    type="button"
                    className={`dropdown-item d-flex align-items-center justify-content-between px-3 py-1.5 small ${viewMode === 'grid' ? 'active bg-primary text-white' : ''}`}
                    onClick={() => {
                      setViewMode('grid');
                      setIsViewDropdownOpen(false);
                    }}
                    title="Grid view"
                  >
                    <div className="d-flex align-items-center gap-2">
                      <LayoutGrid size={15} />
                      <span>Grid</span>
                    </div>
                    {viewMode === 'grid' && <Check size={14} />}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={`dropdown-item d-flex align-items-center justify-content-between px-3 py-1.5 small ${viewMode === 'table' ? 'active bg-primary text-white' : ''}`}
                    onClick={() => {
                      setViewMode('table');
                      setIsViewDropdownOpen(false);
                    }}
                    title="Table view"
                  >
                    <div className="d-flex align-items-center gap-2">
                      <TableIcon size={15} />
                      <span>Table</span>
                    </div>
                    {viewMode === 'table' && <Check size={14} />}
                  </button>
                </li>
              </ul>
            )}
          </div>
      </ListToolbar>

      {activeChips.length > 0 && (
        <div className="px-3 py-2 bg-light border-bottom">
          <ActiveFilterChips chips={activeChips} onClearAll={handleResetFilters} />
        </div>
      )}

      {/* Main Content: Tile Grid vs Data Table */}
      {viewMode === 'grid' ? (
        <div className="p-3 bg-light border-top">
          {sortedVessels.length === 0 ? (
            <div className="text-center py-5 bg-white rounded-3 border">
              <div className="map-vessel-empty-title fw-semibold text-dark mb-1">{emptyTitle}</div>
              <div className="map-vessel-empty-hint text-muted small">{emptyHint}</div>
            </div>
          ) : (
            <div className="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">
              {sortedVessels.map((v) => {
                const readinessScore = calculateVesselReadiness(v, assuranceSets, documents);
                const charterBadge = getVesselCharterBadge(v.status, v.intendedUse);
                const orgInfo = getOrganizationLogo(v.registeredOwner);

                return (
                  <div key={v.id} className="col">
                    <div
                      className="map-marketplace-card h-100"
                      onClick={() => {
                        setActiveVesselId(v.id);
                        onSelectVessel(v);
                      }}
                    >
                      {/* Image Header with Floating Charter Pill */}
                      <div className="map-marketplace-img-wrapper">
                        <img
                          src={getVesselStockPhoto(v.id, v.name, v.vesselType, v.vesselSubtype, v.imageUrl)}
                          alt={v.name}
                          className="map-marketplace-img"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              'https://plus.unsplash.com/premium_photo-1661880889658-6c3ac991146f?q=80&w=1074&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';
                          }}
                        />
                        {/* Top Left Floating Pill */}
                        <div className="map-marketplace-badge-pill">
                          <span
                            style={{
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              backgroundColor: charterBadge.dotColor,
                              display: 'inline-block',
                            }}
                          />
                          <span>{charterBadge.label}</span>
                        </div>
                      </div>

                      {/* Card Content Section */}
                      <div className="p-3 d-flex flex-column flex-grow-1">
                        {/* Title & Options Row */}
                        <div className="d-flex align-items-start justify-content-between gap-2 mb-1">
                          <h6 className="mb-0 fw-bold text-dark text-truncate" style={{ fontSize: '1.05rem' }} title={v.name}>
                            {v.name}
                          </h6>
                          <ObjectVerificationBadge
                            verification={deriveObjectVerification(v.id, assuranceSets, activeDemoOrganization)}
                          />
                          <button
                            type="button"
                            className="btn btn-link p-0 text-muted text-decoration-none border-0 flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveVesselId(v.id);
                              onSelectVessel(v);
                            }}
                            title="More options"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                        </div>

                        {/* Subtitle / Vessel Type */}
                        <div className="text-secondary small mb-3 text-truncate" style={{ fontSize: '0.85rem' }}>
                          {v.vesselSubtype || v.vesselType || 'Offshore Support Vessel (OSV)'} {v.dynamicPositioningClass ? `· ${v.dynamicPositioningClass.split(' ')[0]}` : ''}
                        </div>

                        {/* 2-Column Key Metrics Row (Uncluttered, high-contrast stats) */}
                        <div className="d-flex align-items-center justify-content-between mb-3 py-1">
                          {/* Left Metric: Capacity / DWT */}
                          <div className="d-flex flex-column">
                            <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                              Capacity (DWT)
                            </span>
                            <span className="fw-bold text-dark font-mono-code" style={{ fontSize: '0.95rem' }}>
                              {v.deadweightTonnageDWT ? `${v.deadweightTonnageDWT.toLocaleString()} MT` : `${v.grossTonnageGT?.toLocaleString() || '3,250'} GT`}
                            </span>
                          </div>

                          {/* Right Metric: Class / Readiness */}
                          <div className="d-flex flex-column text-end">
                            <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                              Class &amp; Readiness
                            </span>
                            <span className="fw-bold text-dark" style={{ fontSize: '0.95rem' }}>
                              {v.classificationSociety ? `${v.classificationSociety} · ${readinessScore}%` : `${readinessScore}% Ready`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Vessels Data Table */
        <div className="table-responsive">
          <table className="table map-table-custom align-middle mb-0">
            <thead>
              <tr>
                <th onClick={() => handleSort('imoNumber')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  IMO Number {renderSortIndicator('imoNumber')}
                </th>
                <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  Name {renderSortIndicator('name')}
                </th>
                <th onClick={() => handleSort('classNotation')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  Type {renderSortIndicator('classNotation')}
                </th>
                <th onClick={() => handleSort('flagState')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  Flag &amp; Port {renderSortIndicator('flagState')}
                </th>
                <th onClick={() => handleSort('registeredOwner')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  Registered Owner {renderSortIndicator('registeredOwner')}
                </th>
                <th onClick={() => handleSort('status')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  Operating Status {renderSortIndicator('status')}
                </th>
                <th onClick={() => handleSort('complianceReadinessScore')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  Readiness {renderSortIndicator('complianceReadinessScore')}
                </th>
                <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedVessels.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-5">
                    <div className="map-vessel-empty-state">
                      <div className="map-vessel-empty-title">{emptyTitle}</div>
                      <div className="map-vessel-empty-hint text-muted small">{emptyHint}</div>
                    </div>
                  </td>
                </tr>
              ) : (
                vesselsPagination.pageItems.map((v) => (
                  <tr
                    key={v.id}
                    onClick={() => {
                      setActiveVesselId(v.id);
                      onSelectVessel(v);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="font-mono-code fw-semibold text-primary text-nowrap">{v.imoNumber}</td>
                    <td className="fw-semibold text-dark text-nowrap">{v.name}</td>
                    <td className="small text-nowrap">
                      {v.vesselSubtype || v.classNotation}
                      {v.classificationSociety ? ` · ${v.classificationSociety}` : ''}
                    </td>
                    <td className="text-nowrap">
                      {v.flagState}
                      {v.portOfRegistry ? ` · ${v.portOfRegistry}` : ''}
                    </td>
                    <td className="small fw-semibold text-dark text-nowrap">{v.registeredOwner}</td>
                    <td>
                      <StatusBadge value={v.status} />
                    </td>
                    <td>
                      <ReadinessGauge score={calculateVesselReadiness(v, assuranceSets, documents)} size="sm" />
                    </td>
                    <td className="text-end" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                        style={{ width: '32px', height: '32px' }}
                        title="View"
                        aria-label="View"
                        onClick={() => {
                          setActiveVesselId(v.id);
                          onSelectVessel(v);
                        }}
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      {viewMode === 'table' && <TablePagination {...vesselsPagination.controls} />}

      {/* Vessel Filter Modal */}
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
              <label className="form-label small fw-semibold text-secondary mb-1">Flag State</label>
              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={flagFilter}
                onChange={(e) => setFlagFilter(e.target.value)}
              >
                <option value="ALL">All Flag States</option>
                <option value="Australia">Australia</option>
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-semibold text-secondary mb-1">Class Society</label>
              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
              >
                <option value="ALL">All Class Societies</option>
                <option value="DNV">DNV</option>
                <option value="ABS">ABS</option>
                <option value="Lloyd's Register">Lloyd's Register</option>
                <option value="Austral Classification Society">Austral Classification Society</option>
                <option value="Bureau Veritas">Bureau Veritas</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card p-3 bg-white border rounded">
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label small fw-semibold text-secondary mb-1">Operating Status</label>
              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="In Operations">In Operations</option>
                <option value="In Transit">In Transit</option>
                <option value="Port Stay">Port Stay</option>
                <option value="Under Charter">Under Charter</option>
                <option value="Active">Active</option>
                <option value="Standby">Standby</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Dry Docking">Dry Docking</option>
                <option value="Lay-up">Lay-up</option>
                <option value="Decommissioned">Decommissioned</option>
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-semibold text-secondary mb-1">Assurance Set</label>
              <select
                className="form-select form-select-sm bg-white text-dark border-secondary font-mono-code"
                value={assuranceSetFilter}
                onChange={(e) => setAssuranceSetFilter(e.target.value)}
              >
                <option value="ALL">All Assurance Sets</option>
                {availableAssuranceSets.map((set) => (
                  <option key={set.id} value={set.id}>
                    {set.id} - {set.title}
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

