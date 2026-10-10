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

/**
  what: renders Document Library page.
  how: displays DocumentTable and controls VersionHistoryDrawer and DocumentUploadModal forms.
  with what file: src/views/DocumentLibraryView.tsx loaded by App.tsx.
*/
export const DocumentLibraryView: React.FC = () => {
  const { setCurrentHashView } = useMapStore();
  const [selectedVersionDoc, setSelectedVersionDoc] = useState<MasterDocument | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  return (
    <div className="d-flex flex-column gap-3">
      {/* Document Table with inline Search, Export (CSV/PDF), and Upload buttons */}
      <DocumentTable
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
