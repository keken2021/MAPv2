/* 
  file summary: fleet registry master page rendering the list of vessels and registration action trigger.
  responsibilities: presents VesselTable component and handles trigger to open VesselModal for registering new vessels.
  role in system: primary view for Fleet Master navigation (/vessels).
*/

import React, { useState } from 'react';
import { useMapStore } from '../store/useMapStore';
import { VesselTable } from '../components/tables/VesselTable';
import { VesselModal } from '../components/modals/VesselModal';

/**
  what: renders the fleet master registry page.
  how: displays VesselTable with persona-specific tabs and opens VesselModal.
  with what file: src/views/FleetRegistryView.tsx loaded by App.tsx.
*/
export const FleetRegistryView: React.FC = () => {
  const { setCurrentHashView, setActiveVesselId } = useMapStore();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleVesselRegistered = (vesselId: string) => {
    setActiveVesselId(vesselId);
    setCurrentHashView('vessels', vesselId);
  };

  return (
    <div className="d-flex flex-column gap-3">
      <VesselTable
        onSelectVessel={(vessel) => {
          setCurrentHashView('vessels', vessel.id);
        }}
        onRegisterVessel={() => setIsModalOpen(true)}
      />

      <VesselModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onRegistered={handleVesselRegistered}
      />
    </div>
  );
};
