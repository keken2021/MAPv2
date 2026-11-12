/* 
  file summary: master document library page presenting statutory vessel and crew stcw certificates vault.
  responsibilities: renders DocumentTable component and handles triggers to open VersionHistoryDrawer and DocumentUploadModal.
  role in system: primary view for Document Library navigation (/documents).
*/

import React, { useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { useMapStore } from '../store/useMapStore';
import { DocumentTable } from '../components/tables/DocumentTable';
import { VersionHistoryDrawer } from '../components/drawers/VersionHistoryDrawer';
import { DocumentUploadModal } from '../components/modals/DocumentUploadModal';
import { EmptyState } from '../components/common/EmptyState';
import { MasterDocument } from '../types/document';
import { AssuranceSet } from '../types/assurance';
import { UserRolePersona } from '../types/audit';
import { UserProfile } from '../types/user';
import { isAssuranceSetAssignedToPersona, orgFieldMatches } from '../utils/rbacHelpers';
import { getDemoSessionContext, getSessionUserForPersona } from '../utils/userRoleHelpers';
import { isExpiringWithinWarning } from '../utils/expiryPolicy';
import { canCreateLibraryDocuments } from '../utils/permissionHelpers';

/**
  what: documents the signed-in session user may see in the library.
  how: fails closed without a session user; restricts workflow roles to documents on assigned sets, allows Submitter to view assigned-set documents plus unlinked vault documents for their organization, and allows Administrator to view assigned-set documents plus unlinked vault documents in their organization while excluding colleagues' unassigned sets.
*/
export function documentsForSessionLibrary(
  documents: MasterDocument[],
  assuranceSets: AssuranceSet[],
  persona: UserRolePersona,
  organization: string | undefined,
  user?: Pick<UserProfile, 'id' | 'name' | 'organization' | 'roles'> | null,
): MasterDocument[] {
  if (!user || (!user.name?.trim() && !user.id?.trim())) return [];
  const org = organization?.trim() || user.organization?.trim() || undefined;
  const namedSets = assuranceSets.filter((set) =>
    isAssuranceSetAssignedToPersona(set, persona, org, user),
  );
  const docIdsOnAssignedSets = new Set<string>();
  namedSets.forEach((set) => {
    set.requirements?.forEach((req) => {
      if (req.documentId) docIdsOnAssignedSets.add(req.documentId);
      if (req.linkedDocumentId) docIdsOnAssignedSets.add(req.linkedDocumentId);
    });
  });

  if (persona !== 'Administrator' && persona !== 'Submitter') {
    return documents.filter((doc) => docIdsOnAssignedSets.has(doc.id));
  }

  const docIdsOnAnySet = new Set<string>();
  assuranceSets.forEach((set) => {
    set.requirements?.forEach((req) => {
      if (req.documentId) docIdsOnAnySet.add(req.documentId);
      if (req.linkedDocumentId) docIdsOnAnySet.add(req.linkedDocumentId);
    });
  });

  if (persona === 'Submitter') {
    return documents.filter((doc) => {
      if (docIdsOnAssignedSets.has(doc.id)) return true;
      if (docIdsOnAnySet.has(doc.id)) return false;
      return Boolean(org && doc.ownerOrganization && orgFieldMatches(doc.ownerOrganization, org));
    });
  }

  return documents.filter((doc) => {
    if (docIdsOnAssignedSets.has(doc.id)) return true;
    if (docIdsOnAnySet.has(doc.id)) return false;
    return !doc.ownerOrganization || !org || orgFieldMatches(doc.ownerOrganization, org);
  });
}

/**
  what: renders Document Library page.
  how: displays DocumentTable and controls VersionHistoryDrawer and DocumentUploadModal forms.
  with what file: src/views/DocumentLibraryView.tsx loaded by App.tsx.
*/
export interface DocumentLibraryViewProps {
  initialTab?: string;
}

export function normalizeDocumentTab(tab: string | null | undefined): string {
  if (!tab) return 'ALL';
  const lower = tab.toLowerCase();
  if (lower.includes('expir') && !lower.includes('expired')) {
    return 'Expiring < 6 Mos';
  }
  if (lower === 'expired') {
    return 'Expired';
  }
  return tab;
}

export const DocumentLibraryView: React.FC<DocumentLibraryViewProps> = ({ initialTab }) => {
  const {
    setCurrentHashView,
    documents,
    assuranceSets,
    activePersona,
    activeDemoOrganization,
    activeSessionUserId,
    rolePermissionDefaults,
    userPermissionOverrides,
    customScopes,
    users,
  } = useMapStore();
  const [selectedVersionDoc, setSelectedVersionDoc] = useState<MasterDocument | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const getInitialTab = () => {
    if (initialTab) return normalizeDocumentTab(initialTab);
    const windowPreselect = typeof window !== 'undefined' ? (window as any).__MAP_DOC_TAB_PRESELECT : undefined;
    if (windowPreselect) {
      (window as any).__MAP_DOC_TAB_PRESELECT = undefined;
      return normalizeDocumentTab(windowPreselect);
    }
    try {
      if (typeof sessionStorage !== 'undefined') {
        const stored = sessionStorage.getItem('map_doc_tab_preselect');
        if (stored) {
          sessionStorage.removeItem('map_doc_tab_preselect');
          return normalizeDocumentTab(stored);
        }
      }
    } catch {
      /* ignore */
    }
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash;
      const queryPart = hash.includes('?') ? hash.split('?')[1] : '';
      if (queryPart) {
        const params = new URLSearchParams(queryPart);
        const tabParam = params.get('tab') || params.get('status');
        if (tabParam) return normalizeDocumentTab(tabParam);
      }
    }
    return 'ALL';
  };

  const [statusFilter, setStatusFilter] = useState<string>(getInitialTab);
  const sessionUser = useMemo(
    () =>
      getSessionUserForPersona(
        activePersona,
        users,
        getDemoSessionContext({ activeDemoOrganization, activeSessionUserId }),
      ),
    [activePersona, users, activeDemoOrganization, activeSessionUserId],
  );

  const canUpload = canCreateLibraryDocuments(
    rolePermissionDefaults,
    userPermissionOverrides,
    sessionUser,
    activePersona,
    customScopes,
  );

  const visibleDocuments = useMemo(() => {
    const raw = documentsForSessionLibrary(
      documents,
      assuranceSets,
      activePersona,
      activeDemoOrganization,
      sessionUser,
    );
    return raw.map((doc) => {
      if (doc.complianceState === 'Expiring < 6 Mos' && !isExpiringWithinWarning(doc.expiryDate)) {
        return { ...doc, complianceState: 'Valid' as const };
      }
      return doc;
    });
  }, [documents, assuranceSets, activePersona, activeDemoOrganization, sessionUser]);

  const activeDocForDrawer = useMemo(() => {
    if (!selectedVersionDoc) return null;
    return documents.find((d) => d.id === selectedVersionDoc.id) ?? selectedVersionDoc;
  }, [documents, selectedVersionDoc]);

  return (
    <div className="d-flex flex-column gap-3">
      {visibleDocuments.length === 0 ? (
        <div className="card shadow-sm border-0 p-4">
          <EmptyState
            icon={FileText}
            title="No documents yet"
            description="Documents appear here when uploaded or linked to assurance sets"
            action={
              canUpload
                ? {
                    label: 'Upload Document',
                    onClick: () => setIsUploadOpen(true),
                  }
                : undefined
            }
          />
        </div>
      ) : (
        <DocumentTable
          documents={visibleDocuments}
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
      )}

      {/* Version History Drawer */}
      <VersionHistoryDrawer
        document={activeDocForDrawer}
        onClose={() => setSelectedVersionDoc(null)}
      />

      {/* Document Upload Modal */}
      <DocumentUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        allowVersionModeSwitch={true}
      />
    </div>
  );
};
