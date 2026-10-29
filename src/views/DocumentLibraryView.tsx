/* 
  file summary: master document library page presenting statutory vessel and crew stcw certificates vault.
  responsibilities: renders DocumentTable component and handles triggers to open VersionHistoryDrawer and DocumentUploadModal.
  role in system: primary view for Document Library navigation (/documents).
*/

import React, { useMemo, useState } from 'react';
import { useMapStore } from '../store/useMapStore';
import { DocumentTable } from '../components/tables/DocumentTable';
import { VersionHistoryDrawer } from '../components/drawers/VersionHistoryDrawer';
import { DocumentUploadModal } from '../components/modals/DocumentUploadModal';
import { MasterDocument } from '../types/document';
import { AssuranceSet } from '../types/assurance';
import { UserRolePersona } from '../types/audit';
import { UserProfile } from '../types/user';
import { isAssuranceSetAssignedToPersona } from '../utils/rbacHelpers';
import { getDemoSessionContext, getSessionUserForPersona } from '../utils/userRoleHelpers';

/**
  what: documents a Submitter or Verifier may see in the library.
  how: keeps documents linked to assurance sets that name the session user; every other role keeps the full library.
*/
export function documentsForSessionLibrary(
  documents: MasterDocument[],
  assuranceSets: AssuranceSet[],
  persona: UserRolePersona,
  organization: string | undefined,
  user?: Pick<UserProfile, 'id' | 'name' | 'organization' | 'roles'> | null,
): MasterDocument[] {
  if (persona !== 'Submitter' && persona !== 'Verifier') return documents;
  if (!user?.name) return [];
  const org = organization?.trim() || undefined;
  const namedSets = assuranceSets.filter((set) =>
    isAssuranceSetAssignedToPersona(set, persona, org, user),
  );
  const ids = new Set<string>();
  namedSets.forEach((set) => {
    set.requirements?.forEach((req) => {
      if (req.documentId) ids.add(req.documentId);
      if (req.linkedDocumentId) ids.add(req.linkedDocumentId);
    });
  });
  return documents.filter((doc) => ids.has(doc.id));
}

/**
  what: renders Document Library page.
  how: displays DocumentTable and controls VersionHistoryDrawer and DocumentUploadModal forms.
  with what file: src/views/DocumentLibraryView.tsx loaded by App.tsx.
*/
export const DocumentLibraryView: React.FC = () => {
  const {
    setCurrentHashView,
    documents,
    assuranceSets,
    activePersona,
    activeDemoOrganization,
    activeSessionUserId,
    users,
  } = useMapStore();
  const [selectedVersionDoc, setSelectedVersionDoc] = useState<MasterDocument | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const sessionUser = useMemo(
    () =>
      getSessionUserForPersona(
        activePersona,
        users,
        getDemoSessionContext({ activeDemoOrganization, activeSessionUserId }),
      ),
    [activePersona, users, activeDemoOrganization, activeSessionUserId],
  );
  const visibleDocuments = useMemo(
    () =>
      documentsForSessionLibrary(
        documents,
        assuranceSets,
        activePersona,
        activeDemoOrganization,
        sessionUser,
      ),
    [documents, assuranceSets, activePersona, activeDemoOrganization, sessionUser],
  );

  return (
    <div className="d-flex flex-column gap-3">
      <DocumentTable
        documents={visibleDocuments}
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
