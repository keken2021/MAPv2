/* 
  file summary: master document library page presenting statutory vessel and crew stcw certificates vault.
  responsibilities: renders DocumentTable component and handles triggers to open VersionHistoryDrawer and DocumentUploadModal.
  role in system: primary view for Document Library navigation (/documents).
*/

import React, { useState } from 'react';
import { useMapStore } from '../store/useMapStore';
import { DocumentTable } from '../components/tables/DocumentTable';
import { VersionHistoryDrawer } from '../components/drawers/VersionHistoryDrawer';
import { DocumentUploadModal } from '../components/modals/DocumentUploadModal';
import { MasterDocument } from '../types/document';
import { countDocumentsByExpiry } from '../utils/documentRenewalHelpers';

/**
  what: renders Document Library page.
  how: displays DocumentTable and controls VersionHistoryDrawer and DocumentUploadModal forms.
  with what file: src/views/DocumentLibraryView.tsx loaded by App.tsx.
*/
export const DocumentLibraryView: React.FC = () => {
  const { documents, setCurrentHashView } = useMapStore();
  const [selectedVersionDoc, setSelectedVersionDoc] = useState<MasterDocument | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const { expiring, expired } = countDocumentsByExpiry(documents);

  const toggleStatus = (next: 'Expiring < 6 Mos' | 'Expired') => {
    setStatusFilter((current) => (current === next ? 'ALL' : next));
  };

  return (
    <div className="d-flex flex-column gap-3">
      <div className="row g-3">
        <div className="col-md-6">
          <button
            type="button"
            className={`card map-kpi-card shadow-2xs w-100 text-start${statusFilter === 'Expiring < 6 Mos' ? ' border-warning' : ''}`}
            onClick={() => toggleStatus('Expiring < 6 Mos')}
            aria-pressed={statusFilter === 'Expiring < 6 Mos'}
          >
            <div className="map-kpi-label">Expiring Soon</div>
            <div className="map-kpi-value text-warning mt-1">{expiring}</div>
            <div className="map-kpi-subtitle mt-1">Within 6 months</div>
          </button>
        </div>
        <div className="col-md-6">
          <button
            type="button"
            className={`card map-kpi-card shadow-2xs w-100 text-start${statusFilter === 'Expired' ? ' border-danger' : ''}`}
            onClick={() => toggleStatus('Expired')}
            aria-pressed={statusFilter === 'Expired'}
          >
            <div className="map-kpi-label">Expired</div>
            <div className="map-kpi-value text-danger mt-1">{expired}</div>
            <div className="map-kpi-subtitle mt-1">Past the expiry date</div>
          </button>
        </div>
      </div>

      {/* Document Table with inline Search, Export (CSV/PDF), and Upload buttons */}
      <DocumentTable
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onSelectDocument={(doc) => {
          setCurrentHashView('documents', doc.id);
        }}
        onOpenVersionHistory={(doc) => {
          setSelectedVersionDoc(doc);
        }}
        onUploadDocument={() => setIsUploadOpen(true)}
      />

      {/* Version History Drawer */}
      <VersionHistoryDrawer
        document={selectedVersionDoc}
        onClose={() => setSelectedVersionDoc(null)}
      />

      {/* Document Upload Modal */}
      <DocumentUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
      />
    </div>
  );
};
