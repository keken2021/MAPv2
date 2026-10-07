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
  filterCAdminActiveCharters,
  filterCAdminAvailableToCharter,
  getClientAdminOrganization,
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
      return 'available';
    }
    return 'all';
  });

  useEffect(() => {
    if (activePersona === 'Administrator' || activePersona === 'Submitter') {
      setActiveTab('owned');
    } else if (activePersona === 'C Admin') {
      setActiveTab('available');
    } else {
      setActiveTab('all');
    }
  }, [activePersona]);

  const clientOrg = getClientAdminOrganization(users);

  const availableToCharterCount = filterCAdminAvailableToCharter(
    vessels,
    assuranceSets,
    clientOrg,
  ).length;
  const activeChartersCount = filterCAdminActiveCharters(vessels, assuranceSets).length;

  const isVesselOwned = isVesselOwnedByAdmin;
  const ownedVessels = vessels.filter(isVesselOwned);
  const externalUncharteredVessels = vessels.filter((v) => !isVesselOwned(v) && v.status !== 'Under Charter');
  const ownedCount = ownedVessels.length;
  const externalUncharteredCount = externalUncharteredVessels.length;

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

        {viewMode === 'list' && activePersona === 'C Admin' && (
          <div className="nav nav-pills bg-light p-1 rounded-3 border">
            <button
              type="button"
              className={`nav-link btn-sm font-mono-code px-3 py-1.5 ${activeTab === 'available' ? 'active bg-primary text-white fw-semibold' : 'text-secondary'}`}
              style={{ fontSize: '0.8rem' }}
              onClick={() => setActiveTab('available')}
            >
              Available to Charter ({availableToCharterCount})
            </button>
            <button
              type="button"
              className={`nav-link btn-sm font-mono-code px-3 py-1.5 ${activeTab === 'chartered' ? 'active bg-primary text-white fw-semibold' : 'text-secondary'}`}
              style={{ fontSize: '0.8rem' }}
              onClick={() => setActiveTab('chartered')}
            >
              Active Charters ({activeChartersCount})
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
