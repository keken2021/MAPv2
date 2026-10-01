/* 
  file summary: master fleet registry table component featuring grouped search/filters on left, interactive column sorting, and grouped export/register buttons on right.
  responsibilities: renders list of vessels with search filters, multi-column sorting by header clicks, and export/register action buttons.
  role in system: main data table for FleetRegistryView.tsx.
*/

import React, { useState, useMemo } from 'react';
import { LayoutGrid, Table as TableIcon, Check, MoreHorizontal, Download } from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import { VesselInformation } from '../../types/vessel';
import { ReadinessGauge } from '../common/ReadinessGauge';
import { exportToCsv, exportToPdf } from '../../utils/exportHelpers';
import { getVesselStatusBadgeClass } from '../../utils/formatters';
import {
  getVesselStockPhoto,
  getVesselListingContact,
  getVesselCharterBadge,
  getOrganizationLogo,
} from '../../utils/vesselImageHelpers';

import {
  filterCAdminActiveCharters,
  filterCAdminAvailableToCharter,
  filterCAdminOwnFleet,
  filterVesselsForPersona,
  getClientAdminOrganization,
  isAssuranceSetAssignedToPersona,
  isVesselOwnedByAdmin,
  matchesVesselSearch,
} from '../../utils/rbacHelpers';
import type { FleetRegistryTab } from '../../utils/rbacHelpers';
import { canPerform } from '../../utils/permissionHelpers';
import { calculateVesselReadiness } from '../../utils/readinessHelpers';

type VesselSortField =
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
export const VesselTable: React.FC<VesselTableProps> = ({ onSelectVessel, onRegisterVessel, filterMode }) => {
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
  } = useMapStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [flagFilter, setFlagFilter] = useState('ALL');
  const [classFilter, setClassFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [assuranceSetFilter, setAssuranceSetFilter] = useState('ALL');
  const [sortField, setSortField] = useState<VesselSortField>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);

  const availableAssuranceSets = useMemo(() => {
    if (activePersona === 'C Admin') {
      return assuranceSets.filter((set) => isAssuranceSetAssignedToPersona(set, 'C Admin'));
    }
    if (activePersona === 'Administrator' || activePersona === 'Submitter') {
      return assuranceSets.filter((set) => isAssuranceSetAssignedToPersona(set, activePersona));
    }
    return assuranceSets;
  }, [assuranceSets, activePersona]);

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
  const clientOrg = getClientAdminOrganization(users);

  const baseVessels =
    activePersona === 'C Admin'
      ? filterMode === 'chartered'
        ? filterCAdminActiveCharters(vessels, assuranceSets)
        : filterMode === 'own-fleet'
          ? filterCAdminOwnFleet(vessels, clientOrg)
          : filterCAdminAvailableToCharter(vessels, assuranceSets, clientOrg)
      : activePersona === 'Administrator' || activePersona === 'Submitter'
        ? filterMode === 'all'
          ? vessels.filter((v) => !isVesselOwned(v) && v.status !== 'Under Charter')
          : filterMode === 'owned'
            ? vessels.filter(isVesselOwned)
            : filterVesselsForPersona(vessels, assuranceSets, activePersona)
        : filterVesselsForPersona(vessels, assuranceSets, activePersona);

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
      statusFilter === 'ALL' ||
      v.status === statusFilter ||
      (statusFilter === 'In-Transit' && (v.status === 'In Transit' || v.status === 'In-Transit')) ||
      (statusFilter === 'In Transit' && (v.status === 'In Transit' || v.status === 'In-Transit')) ||
      (statusFilter === 'Dry-Docking' && (v.status === 'Dry Docking' || v.status === 'Dry-Docking')) ||
      (statusFilter === 'Dry Docking' && (v.status === 'Dry Docking' || v.status === 'Dry-Docking'));
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
    if (sortField !== field) return <span className="text-muted ms-1 small opacity-50">↕</span>;
    return <span className="text-primary ms-1 small fw-bold">{sortDirection === 'asc' ? '▲' : '▼'}</span>;
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
      ClassificationSociety: v.classificationSociety,
      Status: v.status,
      ReadinessScore: `${calculateVesselReadiness(v, assuranceSets, documents)}%`,
    }));
    exportToCsv('Master_Fleet_Registry', exportData);
    setIsExportOpen(false);
  };

  const handleExportPdf = () => {
    const headers = ['Vessel Name', 'Type', 'Organization', 'IMO', 'Flag State', 'Class', 'Status', 'Readiness'];
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
    setIsExportOpen(false);
  };

  return (
    <div className="card map-card-custom">
      {/* Table Controls Header */}
      <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-3 p-3">
        {/* Left: Search & Filter */}
        <div className="d-flex flex-wrap align-items-center gap-2">
          <input
            type="text"
            className="form-control form-control-sm bg-white text-dark border-secondary"
            placeholder="Search by Name, Type, Assurance Set, Docs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '280px' }}
          />

          <select
            className="form-select form-select-sm bg-white text-dark border-secondary"
            value={flagFilter}
            onChange={(e) => setFlagFilter(e.target.value)}
            style={{ width: '150px' }}
          >
            <option value="ALL">All Flags</option>
            <option value="Australia">Australia</option>
          </select>

          <select
            className="form-select form-select-sm bg-white text-dark border-secondary"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            style={{ width: '160px' }}
          >
            <option value="ALL">All Class Societies</option>
            <option value="DNV">DNV</option>
            <option value="ABS">ABS</option>
            <option value="Lloyd's Register">Lloyd's Register</option>
            <option value="Bureau Veritas">Bureau Veritas</option>
          </select>

          {(activePersona === 'Administrator' || activePersona === 'Submitter') && filterMode === 'owned' && (
            <select
              className="form-select form-select-sm bg-white text-dark border-secondary"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: '160px' }}
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
          )}

          {(activePersona === 'C Admin' || activePersona === 'Administrator' || activePersona === 'Submitter') && availableAssuranceSets.length > 0 && (
            <select
              className="form-select form-select-sm bg-white text-dark border-secondary font-mono-code"
              value={assuranceSetFilter}
              onChange={(e) => setAssuranceSetFilter(e.target.value)}
              style={{ minWidth: '220px', maxWidth: '300px', fontSize: '0.8rem' }}
              title="Filter by Assurance Set"
            >
              <option value="ALL">All Assurance Sets</option>
              {availableAssuranceSets.map((set) => (
                <option key={set.id} value={set.id}>
                  {set.id} - {set.title}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Right: View Mode Dropdown (Icons only), Export & Register */}
        <div className="d-flex align-items-center gap-2 ms-auto">
          {/* View Mode Icon Dropdown */}
          <div className="dropdown position-relative">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary text-dark d-flex align-items-center gap-1.5 px-2.5 py-1"
              onClick={() => setIsViewDropdownOpen(!isViewDropdownOpen)}
              title={viewMode === 'grid' ? 'Grid View' : 'Table View'}
              aria-label="Toggle View Mode"
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
                    title="Grid View"
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
                    title="Table View"
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

          <div className="dropdown position-relative">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary text-dark dropdown-toggle"
              onClick={() => setIsExportOpen(!isExportOpen)}
            >
              Export Data
            </button>
            {isExportOpen && (
              <ul className="dropdown-menu dropdown-menu-light show position-absolute end-0 mt-1 shadow border">
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

          {canRegister && onRegisterVessel && (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={onRegisterVessel}
            >
              Register Vessel
            </button>
          )}
        </div>
      </div>

      {/* Main Content: Tile Grid vs Data Table */}
      {viewMode === 'grid' ? (
        <div className="p-3 bg-light border-top">
          {sortedVessels.length === 0 ? (
            <div className="text-center py-5 bg-white rounded-3 border">
              <div className="map-vessel-empty-title fw-semibold text-dark mb-1">No vessels match your search</div>
              <div className="map-vessel-empty-hint text-muted small">
                Try adjusting filters or search terms.
              </div>
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
                          <button
                            type="button"
                            className="btn btn-link p-0 text-muted text-decoration-none border-0 flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveVesselId(v.id);
                              onSelectVessel(v);
                            }}
                            title="View Options"
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
                              Assurance / Class
                            </span>
                            <span className="fw-bold text-dark" style={{ fontSize: '0.95rem' }}>
                              {v.classificationSociety ? `${v.classificationSociety} · ${readinessScore}%` : `${readinessScore}% Ready`}
                            </span>
                          </div>
                        </div>

                        {/* Bottom Listing / Organization Box */}
                        <div className="map-marketplace-org-box mt-auto">
                          <div
                            className="text-uppercase fw-bold mb-1.5"
                            style={{ fontSize: '0.625rem', letterSpacing: '0.08em', color: '#94a3b8' }}
                          >
                            LISTING ORGANIZATION
                          </div>
                          <div className="d-flex align-items-center gap-1">
                            {orgInfo.logoUrl ? (
                              <img
                                src={orgInfo.logoUrl}
                                alt={orgInfo.name}
                                className="rounded-2 flex-shrink-0 border"
                                style={{ width: '36px', height: '36px', objectFit: 'cover' }}
                              />
                            ) : (
                              <div
                                className="rounded-2 flex-shrink-0 d-flex align-items-center justify-content-center fw-bold shadow-sm"
                                style={{
                                  width: '36px',
                                  height: '36px',
                                  background: orgInfo.badgeBg,
                                  color: orgInfo.badgeColor,
                                  fontSize: '0.78rem',
                                  letterSpacing: '0.04em',
                                }}
                              >
                                {orgInfo.initials}
                              </div>
                            )}
                            <div className="d-flex flex-column min-w-0 ps-0.5">
                              <span className="fw-bold text-dark text-truncate" style={{ fontSize: '0.88rem' }} title={orgInfo.name}>
                                {orgInfo.name}
                              </span>
                              <span className="text-muted text-truncate" style={{ fontSize: '0.72rem' }}>
                                Verified Maritime Provider
                              </span>
                            </div>
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
                <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  Vessel Name {renderSortIndicator('name')}
                </th>
                <th onClick={() => handleSort('classNotation')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  Class Notation / Type {renderSortIndicator('classNotation')}
                </th>
                <th onClick={() => handleSort('flagState')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  Flag State {renderSortIndicator('flagState')}
                </th>
                <th onClick={() => handleSort('registeredOwner')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  Registered Owner {renderSortIndicator('registeredOwner')}
                </th>
                <th onClick={() => handleSort('status')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  Status {renderSortIndicator('status')}
                </th>
                <th onClick={() => handleSort('complianceReadinessScore')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  Assurance Readiness {renderSortIndicator('complianceReadinessScore')}
                </th>
                <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedVessels.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-5">
                    <div className="map-vessel-empty-state">
                      <div className="map-vessel-empty-title">No vessels match your search</div>
                      <div className="map-vessel-empty-hint text-muted small">
                        Try adjusting filters or register a new OSV vessel.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedVessels.map((v) => (
                  <tr
                    key={v.id}
                    onClick={() => {
                      setActiveVesselId(v.id);
                      onSelectVessel(v);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div className="fw-semibold text-primary">{v.name}</div>
                    </td>
                    <td className="small">
                      <div>{v.vesselSubtype || v.classNotation}</div>
                      <span className="badge bg-light text-dark border mt-1">{v.classificationSociety}</span>
                    </td>
                    <td>
                      <div>{v.flagState}</div>
                      <div className="small text-muted">{v.portOfRegistry}</div>
                    </td>
                    <td className="small">
                      <div className="fw-semibold text-dark">{v.registeredOwner}</div>
                    </td>
                    <td>
                      <span className={`badge ${getVesselStatusBadgeClass(v.status)} text-uppercase`}>{v.status}</span>
                    </td>
                    <td>
                      <ReadinessGauge score={calculateVesselReadiness(v, assuranceSets, documents)} size="sm" />
                    </td>
                    <td className="text-end" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => {
                          setActiveVesselId(v.id);
                          onSelectVessel(v);
                        }}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

