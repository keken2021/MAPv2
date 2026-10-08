/* 
  file summary: fleet registry master page rendering the list of vessels and registration action trigger.
  responsibilities: presents VesselTable component and handles trigger to open VesselModal for registering new vessels.
  role in system: primary view for Fleet Master navigation (/vessels).
*/

import React, { useState, useEffect } from 'react';
import { useMapStore } from '../store/useMapStore';
import { VesselTable } from '../components/tables/VesselTable';
import { VesselModal } from '../components/drawers/VesselModal';
import { AssetHierarchyView } from '../components/assets/AssetHierarchyView';
import {
  filterVesselAdminChartered,
  isVesselOwnedByAdmin,
} from '../utils/rbacHelpers';

/**
  what: renders the fleet master registry page.
  how: displays VesselTable with persona-specific tabs and opens VesselModal.
  with what file: src/views/FleetRegistryView.tsx loaded by App.tsx.
*/
export const FleetRegistryView: React.FC = () => {
  const { setCurrentHashView, setActiveVesselId, vessels, assuranceSets, activePersona, users } =
    useMapStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('list');
  const [activeTab, setActiveTab] = useState<'available' | 'chartered' | 'all' | 'owned'>(() => {
    if (activePersona === 'Administrator' || activePersona === 'Submitter') {
      return 'owned';
    }
    if (activePersona === 'C Admin') {
      return 'chartered';
    }
    return 'all';
  });

  useEffect(() => {
    if (activePersona === 'Administrator' || activePersona === 'Submitter') {
      setActiveTab('owned');
    } else if (activePersona === 'C Admin') {
      setActiveTab('chartered');
    } else {
      setActiveTab('all');
    }
  }, [activePersona]);

  const isVesselAdmin = activePersona === 'Administrator' || activePersona === 'Submitter';
  const isClientAdmin = activePersona === 'C Admin';

  /* vessel admin tab counts: own fleet, and other organizations' vessels chartered with this organization as client */
  const viewerOrg = users.find((u) => u.roles.includes(activePersona))?.organization;
  const ownedCount = vessels.filter(isVesselOwnedByAdmin).length;
  const charteredCount = filterVesselAdminChartered(vessels, assuranceSets, viewerOrg).length;

  const handleVesselRegistered = (vesselId: string) => {
    setActiveVesselId(vesselId);
    setCurrentHashView('vessels', vesselId);
  };

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
        {/* <div className="nav nav-pills bg-light p-1 rounded-3 border">
          <button
            type="button"
            className={`nav-link btn-sm font-mono-code px-3 py-1.5 ${viewMode === 'list' ? 'active bg-primary text-white fw-semibold' : 'text-secondary'}`}
            style={{ fontSize: '0.8rem' }}
            onClick={() => setViewMode('list')}
          >
            List
          </button>
          <button
            type="button"
            className={`nav-link btn-sm font-mono-code px-3 py-1.5 ${viewMode === 'tree' ? 'active bg-primary text-white fw-semibold' : 'text-secondary'}`}
            style={{ fontSize: '0.8rem' }}
            onClick={() => setViewMode('tree')}
          >
            Asset Tree
          </button>
        </div> */}

        {/* client admin: chartered vessels only, under a plain heading with no tab bar */}
        {viewMode === 'list' && isClientAdmin && (
          <h2 className="fw-semibold m-0" style={{ fontSize: '18px', lineHeight: '26px', color: '#334155' }}>
            Chartered
          </h2>
        )}

        {/* vessel admin: own fleet and chartered vessels */}
        {viewMode === 'list' && isVesselAdmin && (
          <div className="nav nav-pills bg-light p-1 rounded-3 border" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'owned'}
              className={`nav-link btn-sm font-mono-code px-3 py-1.5 ${activeTab === 'owned' ? 'active bg-primary text-white fw-semibold' : 'text-secondary'}`}
              style={{ fontSize: '0.8rem' }}
              onClick={() => setActiveTab('owned')}
            >
              Own ({ownedCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'chartered'}
              className={`nav-link btn-sm font-mono-code px-3 py-1.5 ${activeTab === 'chartered' ? 'active bg-primary text-white fw-semibold' : 'text-secondary'}`}
              style={{ fontSize: '0.8rem' }}
              onClick={() => setActiveTab('chartered')}
            >
              Chartered ({charteredCount})
            </button>
          </div>
        )}
      </div>

      {viewMode === 'tree' ? (
        <AssetHierarchyView
          defaultAssetTypeFilter="vessel"
          onSelectVessel={(id) => setCurrentHashView('vessels', id)}
          onSelectEquipment={(id) => setCurrentHashView('equipment', id)}
        />
      ) : (
        <VesselTable
          filterMode={activeTab}
          onSelectVessel={(vessel) => {
            setCurrentHashView('vessels', vessel.id);
          }}
          onRegisterVessel={() => setIsModalOpen(true)}
        />
      )}

      <VesselModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onRegistered={handleVesselRegistered}
      />
    </div>
  );
};
