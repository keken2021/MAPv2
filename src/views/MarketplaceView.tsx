/* 
  file summary: master marketplace view component showcasing service provider vessels, equipment, crew, and turnkey services.
  responsibilities: aggregates external provider assets, provides unified category/filter toolbar with active filter chips, and launches detail view.
  role in system: primary view for Marketplace navigation (/marketplace) mounted by App.tsx router.
*/

import React, { useState, useMemo } from 'react';
import {
  Search,
  LayoutGrid,
  Table as TableIcon,
  Download,
  Ship,
  Wrench,
  Users,
  Briefcase,
  Layers,
  ArrowUpDown,
  RotateCcw,
  X,
  ArrowRight,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import { useMapStore } from '../store/useMapStore';
import { MarketplaceCategory, MarketplaceItem } from '../types/marketplace';
import { getMarketplaceItems, filterMarketplaceItems, resolveMarketplaceCharterTarget } from '../utils/marketplaceHelpers';
import { filterCAdminAvailableToCharter, filterVesselAdminAvailableToCharter, getClientAdminOrganization } from '../utils/rbacHelpers';
import { MarketplaceCard } from '../components/marketplace/MarketplaceCard';
import { MarketplaceDetailModal } from '../components/marketplace/MarketplaceDetailModal';
import { getOrganizationLogo } from '../utils/vesselImageHelpers';
import { exportToCsv, exportToPdf } from '../utils/exportHelpers';
import { formatReadinessScore } from '../utils/formatters';
import { FilterModal } from '../components/common/FilterModal';
import { FilterButton } from '../components/common/FilterButton';
import { ActiveFilterChips, FilterChip } from '../components/common/ActiveFilterChips';

export const MarketplaceView: React.FC = () => {
  const {
    vessels,
    equipment,
    crew,
    assuranceSets,
    documents,
    activePersona,
    activeDemoOrganization,
    users,
    setCurrentHashView,
    setCreateAssuranceForVesselId,
    setCreateAssuranceForAsset,
  } = useMapStore();
  const [activeCategory, setActiveCategory] = useState<MarketplaceCategory>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [providerFilter, setProviderFilter] = useState('ALL');
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [availableOn, setAvailableOn] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'readiness' | 'provider' | 'category'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  /* registered asset behind the open listing, or null when the listing is not linked to one */
  const charterTarget = selectedItem
    ? resolveMarketplaceCharterTarget(selectedItem, { vessels, equipment, crew })
    : null;

  /* reason the charter action is unavailable for the open listing; undefined when it can proceed */
  const charterDisabledReason = ((): string | undefined => {
    if (activePersona !== 'Administrator' && activePersona !== 'C Admin') {
      return 'Only Service Provider and Client Admin roles can start a charter.';
    }
    if (!charterTarget) {
      return 'This listing is not linked to a registered asset.';
    }
    if (charterTarget.scope === 'Vessel') {
      const vessel = vessels.filter((v) => v.id === charterTarget.assetId);
      const available =
        activePersona === 'C Admin'
          ? filterCAdminAvailableToCharter(
              vessel,
              assuranceSets,
              getClientAdminOrganization(users, activeDemoOrganization),
            )
          : filterVesselAdminAvailableToCharter(vessel);
      if (available.length === 0) {
        return 'This vessel is not available to charter.';
      }
    }
    return undefined;
  })();

  /* opens create assurance set with the scope and asset of the listing preselected and locked */
  const handleCharter = () => {
    if (!charterTarget || charterDisabledReason) return;
    if (charterTarget.scope === 'Vessel') {
      setCreateAssuranceForVesselId(charterTarget.assetId);
    }
    setCreateAssuranceForAsset(charterTarget);
    setIsDetailOpen(false);
    setSelectedItem(null);
    setCurrentHashView('create-assurance-set');
  };

  // 1. Resolve all marketplace items strictly excluding current user's organization
  const allMarketplaceItems = useMemo(() => {
    return getMarketplaceItems(vessels, equipment, activePersona, users, crew, assuranceSets, documents);
  }, [vessels, equipment, crew, activePersona, users, assuranceSets, documents]);

  // 2. Count statistics per category
  const counts = useMemo(() => {
    return {
      all: allMarketplaceItems.length,
      vessel: allMarketplaceItems.filter((i) => i.category === 'vessel').length,
      equipment: allMarketplaceItems.filter((i) => i.category === 'equipment').length,
      crew: allMarketplaceItems.filter((i) => i.category === 'crew').length,
      service: allMarketplaceItems.filter((i) => i.category === 'service').length,
    };
  }, [allMarketplaceItems]);

  // 3. Unique providers and locations for dropdown filters
  const uniqueProviders = useMemo(() => {
    const set = new Set<string>();
    allMarketplaceItems.forEach((i) => set.add(i.providerOrg));
    return Array.from(set).sort();
  }, [allMarketplaceItems]);

  const uniqueLocations = useMemo(() => {
    const set = new Set<string>();
    allMarketplaceItems.forEach((i) => {
      const loc = i.location.split(' ')[0].replace(',', '');
      if (loc) set.add(loc);
    });
    return Array.from(set).sort();
  }, [allMarketplaceItems]);

  // 4. Apply active filters and sorting
  const filteredItems = useMemo(() => {
    return filterMarketplaceItems(allMarketplaceItems, {
      category: activeCategory,
      searchTerm,
      providerFilter,
      locationFilter,
      statusFilter,
      availableOn,
      assuranceSets,
      sortBy,
      sortOrder,
    });
  }, [allMarketplaceItems, activeCategory, searchTerm, providerFilter, locationFilter, statusFilter, availableOn, assuranceSets, sortBy, sortOrder]);

  const handleSelectItem = (item: MarketplaceItem) => {
    setSelectedItem(item);
    setIsDetailOpen(true);
  };

  const handleResetFilters = () => {
    setActiveCategory('all');
    setSearchTerm('');
    setProviderFilter('ALL');
    setLocationFilter('ALL');
    setStatusFilter('ALL');
    setAvailableOn('');
    setSortBy('name');
    setSortOrder('asc');
  };

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    providerFilter !== 'ALL' ||
    locationFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    availableOn !== '' ||
    activeCategory !== 'all';

  const activeChips = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    if (providerFilter !== 'ALL') {
      chips.push({
        id: 'provider',
        label: 'Service Provider',
        value: providerFilter,
        onRemove: () => setProviderFilter('ALL'),
      });
    }
    if (locationFilter !== 'ALL') {
      chips.push({
        id: 'location',
        label: 'Location',
        value: locationFilter,
        onRemove: () => setLocationFilter('ALL'),
      });
    }
    if (statusFilter !== 'ALL') {
      chips.push({
        id: 'status',
        label: 'Availability',
        value: statusFilter,
        onRemove: () => setStatusFilter('ALL'),
      });
    }
    if (availableOn) {
      chips.push({
        id: 'availableOn',
        label: 'Available on',
        value: availableOn,
        onRemove: () => setAvailableOn(''),
      });
    }
    if (activeCategory !== 'all') {
      chips.push({
        id: 'category',
        label: 'Category',
        value: activeCategory.toUpperCase(),
        onRemove: () => setActiveCategory('all'),
      });
    }
    return chips;
  }, [providerFilter, locationFilter, statusFilter, availableOn, activeCategory]);

  const activeFilterCount = activeChips.length;

  const handleExportCsv = () => {
    const exportData = filteredItems.map((item) => ({
      ID: item.id,
      Name: item.name,
      Category: item.category.toUpperCase(),
      Subcategory: item.subcategory,
      Provider: item.providerOrg,
      Location: item.location,
      Status: item.availabilityStatus,
      ComplianceScore: formatReadinessScore(item.complianceReadinessScore),
      RateEstimate: item.rateEstimate || 'N/A',
      MobilizationLeadTime: item.mobilizationLeadTime || 'Standard',
    }));
    exportToCsv('Marketplace_Offerings_Registry', exportData);
    setIsExportOpen(false);
  };

  const handleExportPdf = () => {
    const headers = ['Title', 'Category', 'Service Provider', 'Location', 'Availability', 'Readiness'];
    const rows = filteredItems.map((item) => [
      item.name,
      item.subcategory,
      item.providerOrg,
      item.location,
      item.availabilityStatus,
      formatReadinessScore(item.complianceReadinessScore),
    ]);
    exportToPdf('Maritime Marketplace Offerings', headers, rows);
    setIsExportOpen(false);
  };

  return (
    <div className="d-flex flex-column gap-3.5">
      {/* Top Unified Header: Category Navigation Pills + Action Controls */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
        {/* Category Navigation Pills with Universal Font and Counts */}
        <div
          className="nav nav-pills p-1 rounded-2 border d-inline-flex flex-wrap gap-1"
          style={{
            backgroundColor: '#F8FAFC',
            borderColor: '#E2E8F0',
          }}
        >
          <button
            type="button"
            className={`nav-link btn-sm font-mono-code px-3 py-1.5 ${
              activeCategory === 'all'
                ? 'active bg-primary text-white fw-semibold'
                : 'text-secondary'
            }`}
            style={{ fontSize: '0.8rem' }}
            onClick={() => setActiveCategory('all')}
          >
            All ({counts.all})
          </button>

          <button
            type="button"
            className={`nav-link btn-sm font-mono-code px-3 py-1.5 ${
              activeCategory === 'vessel'
                ? 'active bg-primary text-white fw-semibold'
                : 'text-secondary'
            }`}
            style={{ fontSize: '0.8rem' }}
            onClick={() => setActiveCategory('vessel')}
          >
            Vessels ({counts.vessel})
          </button>

          <button
            type="button"
            className={`nav-link btn-sm font-mono-code px-3 py-1.5 ${
              activeCategory === 'equipment'
                ? 'active bg-primary text-white fw-semibold'
                : 'text-secondary'
            }`}
            style={{ fontSize: '0.8rem' }}
            onClick={() => setActiveCategory('equipment')}
          >
            Equipment ({counts.equipment})
          </button>

          <button
            type="button"
            className={`nav-link btn-sm font-mono-code px-3 py-1.5 ${
              activeCategory === 'crew'
                ? 'active bg-primary text-white fw-semibold'
                : 'text-secondary'
            }`}
            style={{ fontSize: '0.8rem' }}
            onClick={() => setActiveCategory('crew')}
          >
            Crew ({counts.crew})
          </button>
        </div>

        {/* Right Action Controls: View Switcher & Export */}
        <div className="d-flex align-items-center gap-2">
          {/* View Mode Switcher */}
          <div
            className="btn-group border rounded-2 p-0.5 shadow-2xs"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}
          >
            <button
              type="button"
              className={`btn btn-sm py-1 px-2.5 d-flex align-items-center gap-1 border-0 ${viewMode === 'grid' ? 'text-white' : 'text-secondary'
                }`}
              style={{
                backgroundColor: viewMode === 'grid' ? '#0B1B2B' : 'transparent',
                borderRadius: '4px',
                fontSize: '0.8rem',
              }}
              onClick={() => setViewMode('grid')}
              title="Grid view"
              aria-label="Grid view"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              type="button"
              className={`btn btn-sm py-1 px-2.5 d-flex align-items-center gap-1 border-0 ${viewMode === 'table' ? 'text-white' : 'text-secondary'
                }`}
              style={{
                backgroundColor: viewMode === 'table' ? '#0B1B2B' : 'transparent',
                borderRadius: '4px',
                fontSize: '0.8rem',
              }}
              onClick={() => setViewMode('table')}
              title="Table view"
              aria-label="Table view"
            >
              <TableIcon size={15} />
            </button>
          </div>

          {/* Export Action */}
          <div className="dropdown position-relative">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1.5 px-3 py-1.5 text-dark"
              style={{ fontSize: '0.82rem', height: '34px', borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' }}
              onClick={() => setIsExportOpen(!isExportOpen)}
            >
              <Download size={14} />
              <span>Export</span>
            </button>

            {isExportOpen && (
              <ul
                className="dropdown-menu dropdown-menu-end show position-absolute end-0 mt-1 shadow-sm border py-1"
                style={{ minWidth: '150px', zIndex: 1000 }}
              >
                <li>
                  <button type="button" className="dropdown-item small py-1.5" onClick={handleExportCsv}>
                    CSV
                  </button>
                </li>
                <li>
                  <button type="button" className="dropdown-item small py-1.5" onClick={handleExportPdf}>
                    PDF
                  </button>
                </li>
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Main Container Card */}
      <div
        className="card map-card-custom overflow-hidden border shadow-2xs"
        style={{ borderRadius: '8px', borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' }}
      >
        {/* Consolidated Search & Filter Toolbar Header */}
        <div
          className="card-header p-3 bg-white border-bottom d-flex flex-column gap-2.5"
          style={{ borderBottomColor: '#E2E8F0' }}
        >
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2.5">
            <div className="d-flex flex-wrap align-items-center gap-2.5 flex-grow-1">
              {/* Search Input */}
              <div className="position-relative" style={{ minWidth: '240px', maxWidth: '300px' }}>
                <input
                  type="text"
                  className="form-control form-control-sm bg-white text-dark ps-4 font-sans"
                  style={{ borderColor: '#E2E8F0', fontSize: '0.82rem', height: '34px' }}
                  placeholder="Search offerings..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Search size={14} className="position-absolute top-50 start-0 translate-middle-y ms-2.5 text-muted" />
              </div>

              {/* Filter Button */}
              <FilterButton
                onClick={() => setIsFilterModalOpen(true)}
                activeCount={activeFilterCount}
              />

              {/* Sort By Dropdown */}
              <select
                className="form-select form-select-sm bg-white text-dark font-sans"
                style={{ width: '160px', borderColor: '#E2E8F0', fontSize: '0.82rem', height: '34px' }}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                title="Sort"
              >
                <option value="name">Sort: Name</option>
                <option value="readiness">Sort: Readiness</option>
                <option value="provider">Sort: Service Provider</option>
                <option value="category">Sort: Category</option>
              </select>

              {/* Sort Direction Toggle */}
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary text-dark px-2.5 d-flex align-items-center justify-content-center"
                style={{ borderColor: '#E2E8F0', height: '34px', backgroundColor: '#FFFFFF' }}
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                title={`Sort direction: ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
              >
                <ArrowUpDown size={14} />
              </button>
            </div>

            {/* Clear All Filters Button */}
            {hasActiveFilters && (
              <button
                type="button"
                className="btn btn-sm btn-link text-secondary d-flex align-items-center gap-1 text-decoration-none px-2 ms-auto"
                onClick={handleResetFilters}
                style={{ fontSize: '0.8rem', color: '#64748B' }}
              >
                <RotateCcw size={13} />
                <span>Clear All</span>
              </button>
            )}
          </div>

          {/* Active Filter Chips Bar */}
          {activeChips.length > 0 && (
            <ActiveFilterChips chips={activeChips} onClearAll={handleResetFilters} />
          )}
        </div>

        {/* Content Area: Grid View vs Table View */}
        {viewMode === 'grid' ? (
          <div className="p-4" style={{ backgroundColor: '#F8FAFC' }}>
            {filteredItems.length === 0 ? (
              <div
                className="text-center py-5 bg-white rounded-2 border"
                style={{ borderColor: '#E2E8F0' }}
              >
                <div className="fw-semibold text-dark mb-1" style={{ fontSize: '1rem', color: '#0B1B2B' }}>
                  No offerings found
                </div>
                <div className="text-muted small mb-3" style={{ fontSize: '0.82rem' }}>
                  Try a different search or filter.
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary px-3 py-1.5"
                  onClick={handleResetFilters}
                  style={{ fontSize: '0.8rem' }}
                >
                  Clear All
                </button>
              </div>
            ) : (
              <div className="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-4">
                {filteredItems.map((item) => (
                  <div key={item.id} className="col">
                    <MarketplaceCard item={item} onSelect={handleSelectItem} />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* 5. Table View Optimization: Data-Dense Mode with Combined Cell Density */
          <div className="table-responsive bg-white">
            <table className="table map-table-custom align-middle mb-0">
              <thead>
                <tr>
                  <th style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#64748B', fontWeight: 500 }}>
                    Offering ID
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#64748B', fontWeight: 500 }}>
                    Title
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#64748B', fontWeight: 500 }}>
                    Category
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#64748B', fontWeight: 500 }}>
                    Service Provider
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#64748B', fontWeight: 500 }}>
                    Availability
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#64748B', fontWeight: 500 }}>
                    Readiness
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#64748B', fontWeight: 500, textAlign: 'right' }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-5" style={{ fontSize: '0.85rem' }}>
                      No offerings found.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const orgInfo = getOrganizationLogo(item.providerOrg);
                    return (
                      <tr
                        key={item.id}
                        style={{ cursor: 'pointer', transition: 'background-color 0.15s ease' }}
                        onClick={() => handleSelectItem(item)}
                      >
                        {/* Column 1: Offering ID */}
                        <td style={{ padding: '12px 16px' }}>
                          <span className="font-mono-code fw-semibold text-primary" style={{ fontSize: '0.82rem' }}>
                            {item.id}
                          </span>
                        </td>

                        {/* Column 2: Asset Name */}
                        <td style={{ padding: '12px 16px' }}>
                          <div className="d-flex align-items-center gap-3">
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="rounded-2 border flex-shrink-0"
                              style={{ width: '38px', height: '38px', objectFit: 'cover', borderColor: '#E2E8F0' }}
                            />
                            <div className="d-flex flex-column min-w-0">
                              <span
                                className="fw-semibold text-dark text-truncate"
                                style={{ maxWidth: '260px', fontSize: '0.88rem', color: '#0B1B2B' }}
                                title={item.name}
                              >
                                {item.name}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Column 2: Category Eyebrow Tag */}
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            className="badge rounded-pill border text-capitalize px-2.5 py-1"
                            style={{
                              backgroundColor: '#F8FAFC',
                              borderColor: '#E2E8F0',
                              color: '#334155',
                              fontSize: '0.72rem',
                              fontWeight: 500,
                            }}
                          >
                            {item.subcategory || item.category}
                          </span>
                        </td>

                        {/* Combined Column 3: Provider Logo + Name + Location */}
                        <td style={{ padding: '12px 16px' }}>
                          <div className="d-flex align-items-center gap-2">
                            {orgInfo.logoUrl ? (
                              <img
                                src={orgInfo.logoUrl}
                                alt={orgInfo.name}
                                className="rounded-2 flex-shrink-0 border"
                                style={{ width: '24px', height: '24px', objectFit: 'cover', borderColor: '#E2E8F0' }}
                              />
                            ) : (
                              <div
                                className="rounded-2 flex-shrink-0 d-flex align-items-center justify-content-center fw-bold"
                                style={{
                                  width: '24px',
                                  height: '24px',
                                  background: orgInfo.badgeBg,
                                  color: orgInfo.badgeColor,
                                  fontSize: '0.65rem',
                                }}
                              >
                                {orgInfo.initials}
                              </div>
                            )}
                            <div className="d-flex flex-column min-w-0">
                              <span className="fw-medium text-dark text-truncate" style={{ fontSize: '0.82rem' }}>
                                {item.providerOrg}
                              </span>
                              <span className="text-secondary small text-truncate" style={{ fontSize: '0.72rem', color: '#64748B' }}>
                                {item.location}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Column 4: Availability Status */}
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            className="badge rounded-pill d-inline-flex align-items-center gap-1.5 px-2.5 py-1"
                            style={{
                              backgroundColor: `${item.availabilityTagColor}15`,
                              color: item.availabilityTagColor,
                              border: `1px solid ${item.availabilityTagColor}40`,
                              fontSize: '0.72rem',
                              fontWeight: 600,
                            }}
                          >
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: item.availabilityTagColor }} />
                            {item.availabilityStatus}
                          </span>
                        </td>

                        {/* Column 5: Tabular Readiness Score in Mono */}
                        <td style={{ padding: '12px 16px' }}>
                          <div className="d-flex align-items-center gap-1.5">
                            <ShieldCheck size={14} className={item.complianceReadinessScore === null ? 'text-secondary' : 'text-primary'} />
                            <span
                              className={`font-mono-code ${item.complianceReadinessScore === null ? 'text-secondary' : 'fw-semibold text-dark'}`}
                              style={{ fontSize: '0.88rem' }}
                            >
                              {formatReadinessScore(item.complianceReadinessScore)}
                            </span>
                          </div>
                        </td>

                        {/* Column 6: Streamlined Action */}
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                            style={{ width: '32px', height: '32px' }}
                            title="View"
                            aria-label="View"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectItem(item);
                            }}
                          >
                            <Eye size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Interactive Detail Modal (Progressive Disclosure) */}
      <MarketplaceDetailModal
        item={selectedItem}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedItem(null);
        }}
        onNavigateToEntity={(view, entityId) => {
          setCurrentHashView(view, entityId);
        }}
        onCharter={handleCharter}
        charterDisabledReason={charterDisabledReason}
      />

      {/* Dedicated Filter Modal */}
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onReset={handleResetFilters}
        title="Filters"
        activeCount={activeFilterCount}
      >
        <div className="d-flex flex-column gap-3">
          {/* Category Filter */}
          <div>
            <label className="form-label text-secondary fw-semibold small mb-1" style={{ fontSize: '0.8rem' }}>
              Category
            </label>
            <select
              className="form-select form-select-sm bg-white text-dark font-sans"
              style={{ borderColor: '#E2E8F0', fontSize: '0.84rem' }}
              value={activeCategory}
              onChange={(e) => setActiveCategory(e.target.value as MarketplaceCategory)}
            >
              <option value="all">All Categories ({counts.all})</option>
              <option value="vessel">Vessels ({counts.vessel})</option>
              <option value="equipment">Equipment ({counts.equipment})</option>
              <option value="crew">Crew ({counts.crew})</option>
              <option value="service">Services ({counts.service})</option>
            </select>
          </div>

          {/* Provider Organization Filter */}
          <div>
            <label className="form-label text-secondary fw-semibold small mb-1" style={{ fontSize: '0.8rem' }}>
              Service Provider
            </label>
            <select
              className="form-select form-select-sm bg-white text-dark font-sans"
              style={{ borderColor: '#E2E8F0', fontSize: '0.84rem' }}
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
            >
              <option value="ALL">All Service Providers ({uniqueProviders.length})</option>
              {uniqueProviders.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Location Filter */}
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
              <option value="ALL">All Locations ({uniqueLocations.length})</option>
              {uniqueLocations.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label text-secondary fw-semibold small mb-1" htmlFor="marketplace-available-on" style={{ fontSize: '0.8rem' }}>
              Available on
            </label>
            <input
              id="marketplace-available-on"
              type="date"
              className="form-control form-control-sm bg-white text-dark font-sans"
              style={{ borderColor: '#E2E8F0', fontSize: '0.84rem' }}
              value={availableOn}
              onChange={(e) => setAvailableOn(e.target.value)}
            />
            <div className="text-muted small mt-1">
              A chartered asset appears on its charter end date.
            </div>
          </div>

          {/* Availability Status Filter */}
          <div>
            <label className="form-label text-secondary fw-semibold small mb-1" style={{ fontSize: '0.8rem' }}>
              Availability
            </label>
            <select
              className="form-select form-select-sm bg-white text-dark font-sans"
              style={{ borderColor: '#E2E8F0', fontSize: '0.84rem' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="Available Now">Available Now</option>
              <option value="Ready for Mobilization">Ready for Mobilization</option>
              <option value="Under Review">Under Review</option>
              <option value="On Assignment">On Assignment</option>
            </select>
          </div>
        </div>
      </FilterModal>
    </div>
  );
};
