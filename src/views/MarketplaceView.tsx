/* 
  file summary: master marketplace view component showcasing service provider vessels, equipment, crew, and turnkey services.
  responsibilities: aggregates external provider assets, provides unified category/filter toolbar with active filter chips, and launches detail view.
  role in system: primary view for Marketplace navigation (/marketplace) mounted by App.tsx router.
*/

import React, { useState, useMemo } from 'react';
import { LayoutGrid, Table as TableIcon, ArrowUpDown, Eye } from 'lucide-react';
import { useMapStore } from '../store/useMapStore';
import { MarketplaceCategory, MarketplaceItem } from '../types/marketplace';
import { getMarketplaceItems, filterMarketplaceItems, formatListingAvailability, resolveMarketplaceCharterTarget } from '../utils/marketplaceHelpers';
import { toIsoLocalDate } from '../utils/validation';
import { filterCAdminAvailableToCharter, filterVesselAdminAvailableToCharter, getClientAdminOrganization } from '../utils/rbacHelpers';
import { MarketplaceCard } from '../components/marketplace/MarketplaceCard';
import { MarketplaceDetailModal } from '../components/marketplace/MarketplaceDetailModal';
import { getOrganizationLogo } from '../utils/vesselImageHelpers';
import { exportToCsv, exportToPdf } from '../utils/exportHelpers';
import { formatReadinessScore, PROVIDER_GENERIC_LABEL } from '../utils/formatters';
import { FilterModal } from '../components/common/FilterModal';
import { CountTabs } from '../components/common/CountTabs';
import { ListToolbar } from '../components/common/ListToolbar';
import { StatusBadge } from '../components/common/StatusBadge';
import { ReadinessGauge } from '../components/common/ReadinessGauge';
import { ActiveFilterChips, FilterChip } from '../components/common/ActiveFilterChips';
import { usePagination } from '../utils/usePagination';
import { TablePagination } from '../components/common/TablePagination';

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
  const [availableFrom, setAvailableFrom] = useState('');
  const [availableTo, setAvailableTo] = useState('');
  /* earliest Available date the filter accepts */
  const todayIso = toIsoLocalDate();
  const [sortBy, setSortBy] = useState<'name' | 'readiness' | 'provider' | 'category'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  /* registered asset behind the open listing, or null when the listing is not linked to one */
  const charterTarget = selectedItem
    ? resolveMarketplaceCharterTarget(selectedItem, { vessels, equipment, crew })
    : null;

  /* reason the charter action is unavailable for the open listing; undefined when it can proceed */
  const charterDisabledReason = ((): string | undefined => {
    if (activePersona !== 'Administrator' && activePersona !== 'C Admin') {
      return 'Only Provider and Client Admin roles can start a charter.';
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
      availableFrom,
      availableTo,
      assuranceSets,
      sortBy,
      sortOrder,
    });
  }, [allMarketplaceItems, activeCategory, searchTerm, providerFilter, locationFilter, statusFilter, availableOn, availableFrom, availableTo, assuranceSets, sortBy, sortOrder]);

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
    setAvailableFrom('');
    setAvailableTo('');
    setSortBy('name');
    setSortOrder('asc');
  };

  const activeChips = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    if (providerFilter !== 'ALL') {
      chips.push({
        id: 'provider',
        label: PROVIDER_GENERIC_LABEL,
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
    if (availableFrom || availableTo) {
      const fromLabel = availableFrom || 'any';
      const toLabel = availableTo || 'any';
      chips.push({
        id: 'availability-window',
        label: 'Availability window',
        value: `${fromLabel} to ${toLabel}`,
        onRemove: () => {
          setAvailableFrom('');
          setAvailableTo('');
        },
      });
    }
    if (availableOn) {
      chips.push({
        id: 'availableOn',
        label: 'Available date',
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
  }, [providerFilter, locationFilter, statusFilter, availableOn, availableFrom, availableTo, activeCategory]);

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
  };

  const handleExportPdf = () => {
    const headers = ['Title', 'Category', PROVIDER_GENERIC_LABEL, 'Location', 'Availability', 'Readiness'];
    const rows = filteredItems.map((item) => [
      item.name,
      item.subcategory,
      item.providerOrg,
      item.location,
      item.availabilityStatus,
      formatReadinessScore(item.complianceReadinessScore),
    ]);
    exportToPdf('Maritime Marketplace Offerings', headers, rows);
  };

  const itemsPagination = usePagination(filteredItems, [activeCategory, searchTerm, providerFilter, locationFilter, statusFilter, availableOn, availableFrom, availableTo, sortBy, sortOrder]);

  return (
    <div className="d-flex flex-column gap-3.5">
      <div className="card map-card-custom overflow-hidden">
        <div className="p-3 border-bottom">
          <CountTabs
            tabs={[
              { key: 'all', label: 'All', count: counts.all },
              { key: 'vessel', label: 'Vessels', count: counts.vessel },
              { key: 'equipment', label: 'Equipment', count: counts.equipment },
              { key: 'crew', label: 'Crew', count: counts.crew },
            ]}
            active={activeCategory}
            onChange={(key) => setActiveCategory(key as MarketplaceCategory)}
            aria-label="Marketplace tabs"
          />
        </div>
        <ListToolbar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search offerings..."
          onFilterClick={() => setIsFilterModalOpen(true)}
          activeFilterCount={activeFilterCount}
          onExportCsv={handleExportCsv}
          onExportPdf={handleExportPdf}
        >
          <select
            className="form-select form-select-sm bg-white text-dark"
            style={{ width: '160px', height: '36px' }}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'readiness' | 'provider' | 'category')}
            aria-label="Sort"
          >
            <option value="name">Sort: Name</option>
            <option value="readiness">Sort: Readiness</option>
            <option value="provider">Sort: {PROVIDER_GENERIC_LABEL}</option>
            <option value="category">Sort: Category</option>
          </select>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary text-dark px-2.5 d-flex align-items-center justify-content-center"
            style={{ height: '36px' }}
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            title={`Sort direction: ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
            aria-label="Sort direction"
          >
            <ArrowUpDown size={14} />
          </button>
          <div className="btn-group" role="group" aria-label="View mode">
            <button type="button" className={`btn btn-sm ${viewMode === 'grid' ? 'btn-dark' : 'btn-outline-secondary'}`} onClick={() => setViewMode('grid')} aria-label="Grid view" title="Grid view">
              <LayoutGrid size={15} />
            </button>
            <button type="button" className={`btn btn-sm ${viewMode === 'table' ? 'btn-dark' : 'btn-outline-secondary'}`} onClick={() => setViewMode('table')} aria-label="Table view" title="Table view">
              <TableIcon size={15} />
            </button>
          </div>
        </ListToolbar>
        {activeChips.length > 0 && (
          <div className="px-3 py-2 bg-light border-bottom">
            <ActiveFilterChips chips={activeChips} onClearAll={handleResetFilters} />
          </div>
        )}

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
                <div className="text-muted small" style={{ fontSize: '0.82rem' }}>
                  Try a different search or filter.
                </div>
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
                    {PROVIDER_GENERIC_LABEL}
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#64748B', fontWeight: 500 }}>
                    Availability
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#64748B', fontWeight: 500 }}>
                    Readiness
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#64748B', fontWeight: 500, textAlign: 'right' }}>
                    Actions
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
                  itemsPagination.pageItems.map((item) => {
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
                              <span className="text-secondary text-truncate" style={{ maxWidth: '280px', fontSize: '0.75rem' }}>
                                {formatListingAvailability(item)}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Column 2: Category Eyebrow Tag */}
                        <td className="text-nowrap" style={{ padding: '12px 16px' }}>
                          {item.subcategory || item.category}
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
                            <span className="text-dark text-truncate" style={{ fontSize: '0.82rem' }}>
                              {item.providerOrg}
                              {item.location ? ` · ${item.location}` : ''}
                            </span>
                          </div>
                        </td>

                        {/* Column 4: Availability Status */}
                        <td style={{ padding: '12px 16px' }}>
                          <StatusBadge value={item.availabilityStatus} />
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          {item.complianceReadinessScore === null ? (
                            <span className="text-secondary">—</span>
                          ) : (
                            <ReadinessGauge score={item.complianceReadinessScore} size="sm" />
                          )}
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
        {viewMode === 'table' && <TablePagination {...itemsPagination.controls} />}
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
              {PROVIDER_GENERIC_LABEL}
            </label>
            <select
              className="form-select form-select-sm bg-white text-dark font-sans"
              style={{ borderColor: '#E2E8F0', fontSize: '0.84rem' }}
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
            >
              <option value="ALL">All Providers ({uniqueProviders.length})</option>
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
              Available date
            </label>
            <input
              id="marketplace-available-on"
              type="date"
              className="form-control form-control-sm bg-white text-dark font-sans"
              style={{ borderColor: '#E2E8F0', fontSize: '0.84rem' }}
              value={availableOn}
              min={todayIso}
              onChange={(e) => {
                /* a typed date can bypass min, so a date before today is not kept */
                if (!e.target.value || e.target.value >= todayIso) {
                  setAvailableOn(e.target.value);
                }
              }}
            />
            <div className="text-muted small mt-1">
              Shows assets with no contract on this date. A contracted asset is listed again on its contract end date.
            </div>
          </div>

          <div>
            <label className="form-label text-secondary fw-semibold small mb-1" htmlFor="marketplace-available-from" style={{ fontSize: '0.8rem' }}>
              Availability window
            </label>
            <div className="d-flex align-items-center gap-2">
              <input
                id="marketplace-available-from"
                type="date"
                aria-label="Available from"
                className="form-control form-control-sm bg-white text-dark font-sans"
                style={{ borderColor: '#E2E8F0', fontSize: '0.84rem' }}
                value={availableFrom}
                onChange={(e) => setAvailableFrom(e.target.value)}
              />
              <span className="text-muted small">to</span>
              <input
                id="marketplace-available-to"
                type="date"
                aria-label="Available to"
                className="form-control form-control-sm bg-white text-dark font-sans"
                style={{ borderColor: '#E2E8F0', fontSize: '0.84rem' }}
                value={availableTo}
                onChange={(e) => setAvailableTo(e.target.value)}
              />
            </div>
            <div className="text-muted small mt-1">
              Keeps offerings whose availability window overlaps these dates.
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
