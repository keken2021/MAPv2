/* 
  file summary: master crew directory page view for administrator and submitter roles to track fleet seafarers.
  responsibilities: presents stcw compliance KPI summary cards, master CrewTable matching assurance table grid format, and launches AddCrewModal.
  role in system: main view for crew governance navigation (/crew) accessible by Administrator and Submitter personas.
*/

import React, { useState } from 'react';
import { useMapStore } from '../store/useMapStore';
import { CrewTable } from '../components/tables/CrewTable';
import { AddCrewModal } from '../components/modals/AddCrewModal';
import { CrewDocumentUploadModal } from '../components/modals/CrewDocumentUploadModal';
import { CrewMember, STCWLayer } from '../types/crew';

/**
  what: renders crew directory master view in light theme.
  how: aggregates stcw compliance statistics and displays CrewTable component with AddCrewModal and CrewDocumentUploadModal integration.
  with what file: src/views/CrewView.tsx loaded by App.tsx router.
*/
export const CrewView: React.FC = () => {
  const { setCurrentHashView } = useMapStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploadingDocCrew, setUploadingDocCrew] = useState<CrewMember | null>(null);
  const [uploadingDocLayer, setUploadingDocLayer] = useState<STCWLayer | undefined>(undefined);

  const handleOpenUploadDoc = (crewMember: CrewMember, layer?: STCWLayer) => {
    setUploadingDocCrew(crewMember);
    setUploadingDocLayer(layer);
  };

  return (
    <div className="d-flex flex-column gap-4">
      <CrewTable
        onSelectCrew={(selectedCrew) => {
          setCurrentHashView('crew', selectedCrew.id);
        }}
        onRegisterCrew={() => setIsModalOpen(true)}
        onAddDocumentCrew={(selectedCrew) => handleOpenUploadDoc(selectedCrew)}
      />

      {/* Add Crew Member Modal */}
      <AddCrewModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onOpenUploadDoc={(crewMember, layer) => handleOpenUploadDoc(crewMember, layer)}
        onViewCrewDetail={(crewId) => setCurrentHashView('crew', crewId)}
      />

      {/* STCW Document / Certificate Upload Modal for Selected Crew Member */}
      {uploadingDocCrew && (
        <CrewDocumentUploadModal
          isOpen={!!uploadingDocCrew}
          crewId={uploadingDocCrew.id}
          crewName={uploadingDocCrew.fullName}
          initialLayer={uploadingDocLayer}
          onClose={() => {
            setUploadingDocCrew(null);
            setUploadingDocLayer(undefined);
          }}
        />
      )}
    </div>
  );
};
