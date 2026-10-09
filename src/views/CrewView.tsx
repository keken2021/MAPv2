/* 
  file summary: master crew directory page view for administrator and submitter roles to track fleet seafarers.
  responsibilities: presents stcw compliance KPI summary cards, master CrewTable matching assurance table grid format, and launches AddCrewModal.
  role in system: main view for crew governance navigation (/crew) accessible by Administrator and Submitter personas.
*/

import React, { useState } from 'react';
import { useMapStore } from '../store/useMapStore';
import { CrewTable } from '../components/tables/CrewTable';
import { AddCrewModal } from '../components/drawers/AddCrewModal';
import { CrewDocumentUploadModal } from '../components/drawers/CrewDocumentUploadModal';
import { CrewMember, STCWLayer } from '../types/crew';

/**
  what: renders crew directory master view in light theme.
  how: aggregates stcw compliance statistics and displays CrewTable component with AddCrewModal and CrewDocumentUploadModal integration.
  with what file: src/views/CrewView.tsx loaded by App.tsx router.
*/
export const CrewView: React.FC = () => {
  const { crew, setCurrentHashView } = useMapStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploadingDocCrew, setUploadingDocCrew] = useState<CrewMember | null>(null);
  const [uploadingDocLayer, setUploadingDocLayer] = useState<STCWLayer | undefined>(undefined);

  const fullyCompliantCount = crew.filter((c) => c.complianceStatus === 'Fully Compliant').length;
  const expiringCount = crew.filter((c) => c.complianceStatus === 'Expiring < 60 Days').length;
  const deficientCount = crew.filter((c) => c.complianceStatus === 'Document Deficient').length;

  const handleOpenUploadDoc = (crewMember: CrewMember, layer?: STCWLayer) => {
    setUploadingDocCrew(crewMember);
    setUploadingDocLayer(layer);
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Top STCW Compliance Summary KPI Cards */}
      <div className="row g-3">
        <div className="col-md-3">
          <div className="card map-kpi-card shadow-2xs">
            <div className="map-kpi-label">
              Crew
            </div>
            <div className="map-kpi-value text-primary mt-1">{crew.length}</div>
            <div className="map-kpi-subtitle mt-1">All crew</div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card map-kpi-card shadow-2xs">
            <div className="map-kpi-label">
              Compliant
            </div>
            <div className="map-kpi-value text-success mt-1">{fullyCompliantCount}</div>
            <div className="map-kpi-subtitle mt-1">All documents valid</div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card map-kpi-card shadow-2xs">
            <div className="map-kpi-label">
              Expiring Soon
            </div>
            <div className="map-kpi-value text-warning mt-1">{expiringCount}</div>
            <div className="map-kpi-subtitle mt-1">Within 60 days</div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card map-kpi-card shadow-2xs">
            <div className="map-kpi-label">
              Non-Compliant
            </div>
            <div className="map-kpi-value text-danger mt-1">{deficientCount}</div>
            <div className="map-kpi-subtitle mt-1">Expired or missing documents</div>
          </div>
        </div>
      </div>

      {/* Master Crew Directory Table matching Assurance Sets table grid format */}
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
