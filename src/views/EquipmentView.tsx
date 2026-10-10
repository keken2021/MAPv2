/*
  file summary: fleet equipment registry page for managing vessel equipment assets.
  responsibilities: presents equipment list/tree views and equipment registration entry point.
  role in system: main view for equipment navigation (/equipment) under the Assets sidebar group.
*/

import React, { useMemo, useState } from 'react';
import { Check, LayoutGrid, Table as TableIcon, Eye } from 'lucide-react';
import { useMapStore } from '../store/useMapStore';
import { AssetHierarchyView } from '../components/assets/AssetHierarchyView';
import { EquipmentModal } from '../components/modals/EquipmentModal';
import { FilterModal } from '../components/common/FilterModal';
import { FilterButton } from '../components/common/FilterButton';
import { ActiveFilterChips, FilterChip } from '../components/common/ActiveFilterChips';
import { filterEquipmentForPersona } from '../utils/rbacHelpers';
import { usePagination } from '../utils/usePagination';
import { TablePagination } from '../components/common/TablePagination';

/**
  what: renders the fleet equipment registry page.
  how: displays equipment table or asset tree with unified filtering, search, and opens EquipmentModal for registration.
  with what file: src/views/EquipmentView.tsx loaded by App.tsx.
*/
export const EquipmentView: React.FC = () => {
  const { equipment, vessels, assuranceSets, activePersona, setCurrentHashView } = useMapStore();
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('list');
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [vesselFilter, setVesselFilter] = useState('ALL');
  const [availabilityFilter, setAvailabilityFilter] = useState('ALL');
  const [complianceFilter, setComplianceFilter] = useState('ALL');

  const visibleEquipment = useMemo(
    () => filterEquipmentForPersona(equipment, vessels, assuranceSets, activePersona),
    [equipment, vessels, assuranceSets, activePersona],
  );

  const categories = useMemo(() => {
    const set = new Set(equipment.map((e) => e.category).filter(Boolean));
    return Array.from(set).sort();
  }, [equipment]);

  const filteredEquipment = useMemo(() => {
    return visibleEquipment.filter((item) => {
      const term = searchTerm.toLowerCase();
      const parent = vessels.find((v) => v.id === item.parentVesselId);
      const matchesSearch =
        !term ||
        item.name.toLowerCase().includes(term) ||
        item.equipmentIdentifier.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term) ||
        (parent?.name && parent.name.toLowerCase().includes(term));

      const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
      const matchesVessel =
        vesselFilter === 'ALL' ||
        (vesselFilter === 'UNASSIGNED' ? !item.parentVesselId : item.parentVesselId === vesselFilter);
      const matchesAvailability = availabilityFilter === 'ALL' || item.availabilityStatus === availabilityFilter;
      const matchesCompliance = complianceFilter === 'ALL' || item.complianceStatus === complianceFilter;

      return matchesSearch && matchesCategory && matchesVessel && matchesAvailability && matchesCompliance;
    });
  }, [visibleEquipment, searchTerm, categoryFilter, vesselFilter, availabilityFilter, complianceFilter, vessels]);

  const activeFilterCount =
    (categoryFilter !== 'ALL' ? 1 : 0) +
    (vesselFilter !== 'ALL' ? 1 : 0) +
    (availabilityFilter !== 'ALL' ? 1 : 0) +
    (complianceFilter !== 'ALL' ? 1 : 0);

  const activeChips: FilterChip[] = [
    ...(categoryFilter !== 'ALL' ? [{ id: 'cat', label: 'Category', value: categoryFilter, onRemove: () => setCategoryFilter('ALL') }] : []),
    ...(vesselFilter !== 'ALL' ? [{ id: 'vessel', label: 'Vessel', value: vesselFilter === 'UNASSIGNED' ? 'Unassigned' : (vessels.find(v => v.id === vesselFilter)?.name || vesselFilter), onRemove: () => setVesselFilter('ALL') }] : []),
    ...(availabilityFilter !== 'ALL' ? [{ id: 'avail', label: 'Availability', value: availabilityFilter, onRemove: () => setAvailabilityFilter('ALL') }] : []),
    ...(complianceFilter !== 'ALL' ? [{ id: 'comp', label: 'Compliance', value: complianceFilter, onRemove: () => setComplianceFilter('ALL') }] : []),
  ];

  const handleResetFilters = () => {
    setCategoryFilter('ALL');
    setVesselFilter('ALL');
    setAvailabilityFilter('ALL');
    setComplianceFilter('ALL');
  };

  const canRegister = activePersona === 'Administrator';

  const handleRegistered = (equipmentId: string) => {
    setCurrentHashView('equipment', equipmentId);
  };

  const equipmentPagination = usePagination(filteredEquipment, [searchTerm, categoryFilter, vesselFilter, availabilityFilter, complianceFilter]);

  return (
    <div className="d-flex flex-column gap-3">
      {/* Top Controls Row */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div className="d-flex flex-wrap align-items-center gap-2">
          <input
            type="text"
            className="form-control form-control-sm bg-white text-dark border-secondary"
            placeholder="Search equipment..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '280px' }}
          />
          <FilterButton
            onClick={() => setIsFilterModalOpen(true)}
            activeCount={activeFilterCount}
          />
        </div>

        <div className="d-flex align-items-center gap-2">
          <div className="dropdown position-relative">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary text-dark d-flex align-items-center gap-1.5 px-2.5 py-1"
              onClick={() => setIsViewDropdownOpen(!isViewDropdownOpen)}
              title={viewMode === 'list' ? 'List view' : 'Asset tree'}
              aria-label="View mode"
            >
              {viewMode === 'list' ? <TableIcon size={15} /> : <LayoutGrid size={15} />}
            </button>
            {isViewDropdownOpen && (
              <ul
                className="dropdown-menu dropdown-menu-light show position-absolute end-0 mt-1 shadow border py-1"
                style={{ minWidth: '150px', zIndex: 1050 }}
              >
                <li>
                  <button
                    type="button"
                    className={`dropdown-item d-flex align-items-center justify-content-between px-3 py-1.5 small ${viewMode === 'list' ? 'active bg-primary text-white' : ''}`}
                    onClick={() => {
                      setViewMode('list');
                      setIsViewDropdownOpen(false);
                    }}
                    title="List view"
                  >
                    <div className="d-flex align-items-center gap-2">
                      <TableIcon size={15} />
                      <span>List</span>
                    </div>
                    {viewMode === 'list' && <Check size={14} />}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={`dropdown-item d-flex align-items-center justify-content-between px-3 py-1.5 small ${viewMode === 'tree' ? 'active bg-primary text-white' : ''}`}
                    onClick={() => {
                      setViewMode('tree');
                      setIsViewDropdownOpen(false);
                    }}
                    title="Tree view"
                  >
                    <div className="d-flex align-items-center gap-2">
                      <LayoutGrid size={15} />
                      <span>Tree</span>
                    </div>
                    {viewMode === 'tree' && <Check size={14} />}
                  </button>
                </li>
              </ul>
            )}
          </div>

          {canRegister && (
            <button
              type="button"
              className="btn btn-sm btn-primary fw-semibold"
              onClick={() => setIsModalOpen(true)}
            >
              Add Equipment
            </button>
          )}
        </div>
      </div>

      {activeChips.length > 0 && (
        <div className="px-3 py-2 bg-light rounded border">
          <ActiveFilterChips chips={activeChips} onClearAll={handleResetFilters} />
        </div>
      )}

      {viewMode === 'tree' ? (
        <AssetHierarchyView
          defaultAssetTypeFilter="equipment"
          onSelectVessel={(id) => setCurrentHashView('vessels', id)}
          onSelectEquipment={(id) => setCurrentHashView('equipment', id)}
        />
      ) : (
        <div className="card map-card-custom">
          <div className="table-responsive">
            <table className="table map-table-custom align-middle mb-0">
              <thead>
                <tr>
                  <th>Equipment ID</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Vessel</th>
                  <th>Availability</th>
                  <th>Compliance</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEquipment.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">
                      No equipment found.
                    </td>
                  </tr>
                )}
                {equipmentPagination.pageItems.map((item) => {
                  const parent = vessels.find((v) => v.id === item.parentVesselId);
                  return (
                    <tr
                      key={item.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setCurrentHashView('equipment', item.id)}
                    >
                      <td className="font-mono-code fw-semibold text-primary">{item.equipmentIdentifier}</td>
                      <td className="fw-semibold text-dark">{item.name}</td>
                      <td className="small">{item.category}</td>
                      <td className="small">{parent?.name ?? '—'}</td>
                      <td>
                        <span className="badge bg-light text-dark border">{item.availabilityStatus}</span>
                      </td>
                      <td>
                        <span className="badge bg-light text-dark border">{item.complianceStatus}</span>
                      </td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                          style={{ width: '32px', height: '32px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentHashView('equipment', item.id);
                          }}
                          title="View"
                          aria-label="View"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <TablePagination {...equipmentPagination.controls} />
        </div>
      )}

      {/* Equipment Filter Modal */}
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
              <label className="form-label small fw-semibold text-secondary mb-1">Category</label>
              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="ALL">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-semibold text-secondary mb-1">Vessel</label>
              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={vesselFilter}
                onChange={(e) => setVesselFilter(e.target.value)}
              >
                <option value="ALL">All Vessels</option>
                <option value="UNASSIGNED">Unassigned</option>
                {vessels.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-semibold text-secondary mb-1">Availability</label>
              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="Available">Available</option>
                <option value="In Use">In Use</option>
                <option value="Under Maintenance">Under Maintenance</option>
                <option value="Decommissioned">Decommissioned</option>
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-semibold text-secondary mb-1">Compliance</label>
              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={complianceFilter}
                onChange={(e) => setComplianceFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="Compliant">Compliant</option>
                <option value="Expiring Soon">Expiring Soon</option>
                <option value="Non-Compliant">Non-Compliant</option>
              </select>
            </div>
          </div>
        </div>
      </FilterModal>

      <EquipmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onRegistered={handleRegistered}
      />
    </div>
  );
};
