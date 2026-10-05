/*
  file summary: fleet equipment registry page for managing vessel equipment assets.
  responsibilities: presents equipment list/tree views and equipment registration entry point.
  role in system: main view for equipment navigation (/equipment) under the Assets sidebar group.
*/

import React, { useMemo, useState } from 'react';
import { Check, LayoutGrid, Table as TableIcon } from 'lucide-react';
import { useMapStore } from '../store/useMapStore';
import { AssetHierarchyView } from '../components/assets/AssetHierarchyView';
import { EquipmentModal } from '../components/drawers/EquipmentModal';
import { filterEquipmentForPersona } from '../utils/rbacHelpers';

/**
  what: renders the fleet equipment registry page.
  how: displays equipment table or asset tree and opens EquipmentModal for registration.
  with what file: src/views/EquipmentView.tsx loaded by App.tsx.
*/
export const EquipmentView: React.FC = () => {
  const { equipment, vessels, assuranceSets, activePersona, setCurrentHashView } = useMapStore();
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('list');
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const visibleEquipment = useMemo(
    () => filterEquipmentForPersona(equipment, vessels, assuranceSets, activePersona),
    [equipment, vessels, assuranceSets, activePersona],
  );

  const canRegister = activePersona === 'Administrator';

  const handleRegistered = (equipmentId: string) => {
    setCurrentHashView('equipment', equipmentId);
  };

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex flex-wrap align-items-center justify-content-end gap-2">
        <div className="dropdown position-relative">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary text-dark d-flex align-items-center gap-1.5 px-2.5 py-1"
            onClick={() => setIsViewDropdownOpen(!isViewDropdownOpen)}
            title={viewMode === 'list' ? 'List view' : 'Asset tree'}
            aria-label="Toggle view mode"
          >
            {viewMode === 'list' ? <TableIcon size={15} /> : <LayoutGrid size={15} />}
          </button>
          {isViewDropdownOpen && (
            <ul
              className="dropdown-menu dropdown-menu-light show position-absolute end-0 mt-1 shadow border py-1"
              style={{ minWidth: '150px' }}
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
                  title="Asset tree"
                >
                  <div className="d-flex align-items-center gap-2">
                    <LayoutGrid size={15} />
                    <span>Asset Tree</span>
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
            Register Equipment
          </button>
        )}
      </div>

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
                  <th>Name</th>
                  <th>Identifier</th>
                  <th>Category</th>
                  <th>Parent Vessel</th>
                  <th>Availability</th>
                  <th>Compliance</th>
                </tr>
              </thead>
              <tbody>
                {visibleEquipment.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-4">
                      No equipment registered yet.
                    </td>
                  </tr>
                )}
                {visibleEquipment.map((item) => {
                  const parent = vessels.find((v) => v.id === item.parentVesselId);
                  return (
                    <tr
                      key={item.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setCurrentHashView('equipment', item.id)}
                    >
                      <td className="fw-semibold">{item.name}</td>
                      <td className="font-mono-code small">{item.equipmentIdentifier}</td>
                      <td className="small">{item.category}</td>
                      <td className="small">{parent?.name ?? '—'}</td>
                      <td>
                        <span className="badge bg-light text-dark border">{item.availabilityStatus}</span>
                      </td>
                      <td>
                        <span className="badge bg-light text-dark border">{item.complianceStatus}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <EquipmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onRegistered={handleRegistered}
      />
    </div>
  );
};
