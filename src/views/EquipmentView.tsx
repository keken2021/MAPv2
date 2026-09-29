/*
  file summary: fleet equipment registry page for managing vessel equipment assets.
  responsibilities: presents equipment list/tree views and equipment registration entry point.
  role in system: main view for equipment navigation (/equipment) under the Assets sidebar group.
*/

import React, { useMemo, useState } from 'react';
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
  const [isModalOpen, setIsModalOpen] = useState(false);

  const visibleEquipment = useMemo(
    () => filterEquipmentForPersona(equipment, vessels, assuranceSets, activePersona),
    [equipment, vessels, assuranceSets, activePersona],
  );

  const canRegister = activePersona === 'Administrator' || activePersona === 'Submitter';

  const handleRegistered = (equipmentId: string) => {
    setCurrentHashView('equipment', equipmentId);
  };

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex flex-wrap align-items-center justify-between gap-3">
        <div className="nav nav-pills bg-light p-1 rounded-3 border">
          <button
            type="button"
            className={`nav-link btn-sm font-mono-code px-3 py-1.5 ${viewMode === 'list' ? 'active bg-primary text-white fw-semibold' : 'text-secondary'}`}
            style={{ fontSize: '0.8rem' }}
            onClick={() => setViewMode('list')}
          >
            List ({visibleEquipment.length})
          </button>
          <button
            type="button"
            className={`nav-link btn-sm font-mono-code px-3 py-1.5 ${viewMode === 'tree' ? 'active bg-primary text-white fw-semibold' : 'text-secondary'}`}
            style={{ fontSize: '0.8rem' }}
            onClick={() => setViewMode('tree')}
          >
            Asset Tree
          </button>
        </div>

        {canRegister && (
          <button
            type="button"
            className="btn btn-sm btn-primary fw-semibold"
            onClick={() => setIsModalOpen(true)}
          >
            + Register Equipment
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
