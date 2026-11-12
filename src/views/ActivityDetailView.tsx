/*
  file summary: detail view for an activity assurance object.
  responsibilities: renders detail header with verification and meta facts, tabs navigation (Overview, Documents, Assurance, Audit Trail), and each tab's content.
  role in system: opened when an activity row is clicked in AssuranceObjectsView or navigated to via #/activities/:id.
*/

import React, { useState, useMemo, useEffect } from 'react';
import { DetailHeader } from '../components/common/DetailHeader';
import { AccessDeniedState } from '../components/common/AccessDeniedState';
import { ObjectVerificationBadge } from '../components/common/ObjectVerificationBadge';
import { UniversalDocumentPreviewModal } from '../components/modals/UniversalDocumentPreviewModal';
import { DocumentUploadModal } from '../components/modals/DocumentUploadModal';
import { useMapStore } from '../store/useMapStore';
import { MasterDocument } from '../types/document';
import { deriveObjectVerification } from '../utils/documentVersionSnapshot';
import { formatMaritimeDate, formatMaritimeDateTime } from '../utils/formatters';
import { setsUsingObject } from './AssuranceObjectsView';
import { setsForObjectDrawer, verificationsForViewer } from '../components/drawers/AssuranceObjectDrawer';
import { isMarketplacePersona, orgFieldMatches } from '../utils/rbacHelpers';
import { useSessionUser } from '../utils/useSessionUser';
import { Eye } from 'lucide-react';

export type ActivityDetailTab = 'overview' | 'documents' | 'assurance' | 'audit';

interface ActivityDetailViewProps {
  activityId: string;
}

export const ActivityDetailView: React.FC<ActivityDetailViewProps> = ({ activityId }) => {
  const {
    assuranceObjects,
    assuranceSets,
    documents,
    activePersona,
    activeDemoOrganization,
    users,
    currentHashView,
    previousHashView,
    previousEntityId,
    setCurrentHashView,
  } = useMapStore();

  const [activeTab, setActiveTab] = useState<ActivityDetailTab>('overview');
  const [previewDoc, setPreviewDoc] = useState<MasterDocument | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [versionTargetDoc, setVersionTargetDoc] = useState<MasterDocument | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const activity = useMemo(
    () => assuranceObjects.find((obj) => obj.id === activityId && obj.type === 'activity'),
    [assuranceObjects, activityId],
  );

  const sessionUser = useSessionUser();
  const organization = sessionUser?.organization || activeDemoOrganization;

  const usedInCount = useMemo(
    () => (activity ? setsUsingObject(activity.id, assuranceSets) : 0),
    [activity, assuranceSets],
  );

  const verification = useMemo(
    () => (activity ? deriveObjectVerification(activity.id, assuranceSets, organization) : null),
    [activity, assuranceSets, organization],
  );

  const viewerVerifications = useMemo(
    () => (activity ? verificationsForViewer(activity, assuranceSets, activePersona, organization) : []),
    [activity, assuranceSets, activePersona, organization],
  );

  const visibleSets = useMemo(
    () =>
      activity
        ? setsForObjectDrawer(
            activity.id,
            assuranceSets,
            activePersona,
            organization,
            sessionUser,
            users,
          )
        : [],
    [activity, assuranceSets, activePersona, organization, sessionUser, users],
  );

  const isOwnedActivity = Boolean(
    sessionUser &&
      activity &&
      organization &&
      orgFieldMatches(organization, activity.ownerOrganization),
  );

  const activityDocs = useMemo(() => {
    if (!activity || !sessionUser) return [];
    const docMap = new Map<string, MasterDocument>();
    const docIdsOnAnySet = new Set<string>();
    assuranceSets.forEach((set) => {
      set.requirements?.forEach((req) => {
        if (req.documentId) docIdsOnAnySet.add(req.documentId);
        if (req.linkedDocumentId) docIdsOnAnySet.add(req.linkedDocumentId);
      });
    });
    const docIdsOnSets = new Set<string>();

    visibleSets.forEach((set) => {
      set.requirements?.forEach((req) => {
        const matchesActivity =
          req.targetObjectId === activity.id ||
          (req.description && req.description.toLowerCase().includes(activity.name.toLowerCase())) ||
          (activity.identifier &&
            req.description &&
            req.description.toLowerCase().includes(activity.identifier.toLowerCase()));

        if (matchesActivity) {
          if (req.documentId) docIdsOnSets.add(req.documentId);
          if (req.linkedDocumentId) docIdsOnSets.add(req.linkedDocumentId);
        }
      });
    });

    documents.forEach((doc) => {
      if (docIdsOnSets.has(doc.id)) {
        docMap.set(doc.id, doc);
      }
    });

    visibleSets.forEach((set) => {
      set.requirements?.forEach((req) => {
        const matchesActivity =
          req.targetObjectId === activity.id ||
          (req.description && req.description.toLowerCase().includes(activity.name.toLowerCase())) ||
          (activity.identifier &&
            req.description &&
            req.description.toLowerCase().includes(activity.identifier.toLowerCase()));

        if (matchesActivity && (req.documentId || req.linkedDocumentId)) {
          const docId = req.documentId || req.linkedDocumentId!;
          if (!docMap.has(docId)) {
            const found = documents.find((d) => d.id === docId);
            if (found) {
              docMap.set(docId, found);
            } else {
              docMap.set(docId, {
                id: docId,
                title: req.title,
                certificateNo: docId,
                issuingAuthority: req.responsibleParty || set.clientOrg || 'Issuing Authority',
                expiryDate: set.charterWindowEnd || '',
                verificationStatus: req.verifierStatus === 'Verified' ? 'Internally verified' : 'Uploaded',
                documentType: 'Certificate',
                category: req.category,
                ownerOrganization: activity.ownerOrganization,
                entityType: 'Vessel',
                vesselId: '',
                ocrConfidence: 100,
                complianceState: 'Compliant',
                issueDate: '',
                fileUrl: '',
              } as unknown as MasterDocument);
            }
          }
        }
      });
    });

    if (isOwnedActivity) {
      const idLower = activity.id.toLowerCase();
      const tagLower = (activity.identifier || '').toLowerCase();
      documents.forEach((doc) => {
        if (docIdsOnAnySet.has(doc.id) && !docIdsOnSets.has(doc.id)) return;
        if (doc.targetObjectType === 'activity' && doc.targetObjectId === activity.id) {
          docMap.set(doc.id, doc);
          return;
        }
        const haystack = `${doc.id} ${doc.title} ${doc.certificateNo}`.toLowerCase();
        if (haystack.includes(idLower) || (tagLower && haystack.includes(tagLower))) {
          docMap.set(doc.id, doc);
        }
      });
    }

    return Array.from(docMap.values());
  }, [activity, sessionUser, assuranceSets, visibleSets, documents, isOwnedActivity]);

  const auditEntries = useMemo(
    () => [...(activity?.statusHistory || [])].reverse(),
    [activity],
  );

  const isAdmin = activePersona === 'Administrator';
  const isCAdmin = activePersona === 'C Admin';
  const isSubmitter = activePersona === 'Submitter';

  const canManageActivityDocs = Boolean(sessionUser && isOwnedActivity && (isAdmin || isSubmitter));
  const canAddDocuments = Boolean(sessionUser && isAdmin && isOwnedActivity);
  const canAddAssurance = Boolean(sessionUser && (isAdmin || isCAdmin));

  const showDocumentsTab = activityDocs.length > 0 || canAddDocuments;
  const showAssuranceTab = visibleSets.length > 0 || canAddAssurance;
  const showAuditTab = auditEntries.length > 0;

  useEffect(() => {
    const allowed: ActivityDetailTab[] = ['overview'];
    if (showDocumentsTab) allowed.push('documents');
    if (showAssuranceTab) allowed.push('assurance');
    if (showAuditTab) allowed.push('audit');
    if (!allowed.includes(activeTab)) {
      setActiveTab('overview');
    }
  }, [activeTab, showDocumentsTab, showAssuranceTab, showAuditTab]);

  const handleBack = () => {
    if (previousHashView && previousHashView !== 'login' && previousHashView !== currentHashView) {
      setCurrentHashView(previousHashView, previousEntityId);
    } else {
      setCurrentHashView('objects');
    }
  };

  const backLabel =
    previousHashView && previousHashView !== 'login' && previousHashView !== currentHashView
      ? previousHashView === 'objects'
        ? 'Objects'
        : previousHashView === 'assurance-sets'
          ? 'Assurance Sets'
          : previousHashView
      : 'Objects';

  if (!activity) {
    return (
      <div className="alert alert-warning m-4">
        Activity not found.
      </div>
    );
  }

  const isAccessibleActivity = Boolean(
    sessionUser &&
      (isOwnedActivity ||
        visibleSets.length > 0 ||
        isMarketplacePersona(activePersona)),
  );
  if (!isAccessibleActivity) {
    return <AccessDeniedState onBack={() => setCurrentHashView('objects')} />;
  }

  return (
    <div className="d-flex flex-column gap-3">
      <DetailHeader
        title={activity.name}
        status={verification?.status}
        metaItems={[
          activity.identifier || '',
          activity.ownerOrganization || '',
          `Used in ${usedInCount} ${usedInCount === 1 ? 'set' : 'sets'}`,
        ].filter(Boolean)}
        mainAction={
          canManageActivityDocs ? (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => {
                setVersionTargetDoc(null);
                setIsUploadModalOpen(true);
              }}
            >
              Upload Document
            </button>
          ) : undefined
        }
        backLink={{
          label: backLabel,
          onClick: handleBack,
        }}
      />
      {verification && (
        <div className="px-4 py-2 bg-white border-bottom d-flex align-items-center gap-2">
          <span className="small text-muted fw-semibold">Verification:</span>
          <ObjectVerificationBadge verification={verification} />
        </div>
      )}

      {/* Tabs navigation: Overview, Documents, Assurance, Audit Trail */}
      <ul className="nav nav-tabs border-bottom px-4" role="tablist" aria-label="Activity detail tabs">
        <li className="nav-item">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'overview'}
            className={`nav-link ${activeTab === 'overview' ? 'active fw-bold text-primary' : 'text-secondary'}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
        </li>
        {showDocumentsTab && (
          <li className="nav-item">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'documents'}
              className={`nav-link ${activeTab === 'documents' ? 'active fw-bold text-primary' : 'text-secondary'}`}
              onClick={() => setActiveTab('documents')}
            >
              Documents ({activityDocs.length})
            </button>
          </li>
        )}
        {showAssuranceTab && (
          <li className="nav-item">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'assurance'}
              className={`nav-link ${activeTab === 'assurance' ? 'active fw-bold text-primary' : 'text-secondary'}`}
              onClick={() => setActiveTab('assurance')}
            >
              Assurance ({visibleSets.length})
            </button>
          </li>
        )}
        {showAuditTab && (
          <li className="nav-item">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'audit'}
              className={`nav-link ${activeTab === 'audit' ? 'active fw-bold text-primary' : 'text-secondary'}`}
              onClick={() => setActiveTab('audit')}
            >
              Audit Trail ({auditEntries.length})
            </button>
          </li>
        )}
      </ul>

      <div className="p-4">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="card shadow-sm p-4">
            <h2 className="h5 mb-4 fw-bold">Overview</h2>
            <div className="row g-4">
              <div className="col-12 col-md-6">
                <div className="text-muted small mb-1">Identifier</div>
                <div className="fw-semibold">{activity.identifier || '—'}</div>
              </div>
              <div className="col-12 col-md-6">
                <div className="text-muted small mb-1">Owner</div>
                <div className="fw-semibold">{activity.ownerOrganization || '—'}</div>
              </div>
              <div className="col-12">
                <div className="text-muted small mb-1">Description</div>
                <div>{activity.description || 'No description.'}</div>
              </div>
              <div className="col-12">
                <h3 className="h6 mb-3 fw-bold">Verification</h3>
                {viewerVerifications.length === 0 ? (
                  <div className="text-muted">No verification for your organization.</div>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {viewerVerifications.map((v) => (
                      <div key={v.clientOrganization} className="p-3 border rounded" data-testid="object-verification">
                        <div className="fw-semibold mb-1">{v.clientOrganization}</div>
                        <ObjectVerificationBadge verification={v} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="card map-card-custom">
            <div className="card-header fw-bold bg-white p-3 border-bottom d-flex align-items-center justify-content-between">
              <div>Documents ({activityDocs.length})</div>
              {canManageActivityDocs && (
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    setVersionTargetDoc(null);
                    setIsUploadModalOpen(true);
                  }}
                >
                  Upload Document
                </button>
              )}
            </div>
            <div className="table-responsive">
              <table className="table map-table-custom align-middle mb-0" data-testid="activity-documents-table">
                <thead>
                  <tr>
                    <th>Document No</th>
                    <th>Title</th>
                    <th>Issuing Authority</th>
                    <th>Expiry Date</th>
                    <th>Status</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activityDocs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-muted py-4">
                        No documents on file.
                      </td>
                    </tr>
                  ) : (
                    activityDocs.map((doc) => (
                      <tr key={doc.id}>
                        <td className="font-mono-code small fw-semibold text-primary">
                          {doc.certificateNo || doc.id}
                        </td>
                        <td>{doc.title}</td>
                        <td className="small">{doc.issuingAuthority || '—'}</td>
                        <td className="font-mono-code small">
                          {doc.expiryDate ? formatMaritimeDate(doc.expiryDate) : '—'}
                        </td>
                        <td>
                          <span className="badge bg-light text-dark border">
                            {doc.verificationStatus || 'Verified'}
                          </span>
                        </td>
                        <td className="text-end">
                          <div className="d-flex align-items-center justify-content-end gap-1">
                            {canManageActivityDocs && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => {
                                  setVersionTargetDoc(doc);
                                  setIsUploadModalOpen(true);
                                }}
                                title="Upload New Version"
                              >
                                New Version
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center justify-content-center p-0"
                              style={{ width: '32px', height: '32px' }}
                              onClick={() => setPreviewDoc(doc)}
                              title="View document"
                              aria-label={`View ${doc.title}`}
                            >
                              <Eye size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Assurance Tab */}
        {activeTab === 'assurance' && (
          <div className="card map-card-custom">
            <div className="card-header fw-bold bg-white p-3 border-bottom d-flex align-items-center justify-content-between">
              <div>Assurance Sets ({visibleSets.length})</div>
            </div>
            <div className="table-responsive">
              <table className="table map-table-custom align-middle mb-0" data-testid="activity-assurance-table">
                <thead>
                  <tr>
                    <th>Set ID</th>
                    <th>Title</th>
                    <th>Stage</th>
                    <th>Created By</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSets.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-4">
                        No assurance sets for this activity.
                      </td>
                    </tr>
                  ) : (
                    visibleSets.map((set) => (
                      <tr
                        key={set.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setCurrentHashView('assurance-sets', set.id)}
                      >
                        <td className="font-mono-code small">{set.id}</td>
                        <td className="fw-semibold text-dark">{set.title}</td>
                        <td>
                          <span className="badge bg-light text-dark border">{set.stage}</span>
                        </td>
                        <td className="small">{set.initiatorOrg || set.clientOrg || '—'}</td>
                        <td className="text-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentHashView('assurance-sets', set.id);
                            }}
                            aria-label={`View ${set.title}`}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Audit Trail Tab */}
        {activeTab === 'audit' && (
          <div className="card map-card-custom">
            <div className="card-header fw-bold bg-white p-3 border-bottom d-flex align-items-center justify-content-between">
              <div>Audit Trail ({auditEntries.length})</div>
            </div>
            <div className="p-3">
              {auditEntries.length === 0 ? (
                <div className="text-muted text-center py-4">No status changes recorded.</div>
              ) : (
                <ul className="list-unstyled mb-0" data-testid="object-status-history">
                  {auditEntries.map((entry) => (
                    <li key={entry.id} className="mb-3 p-3 border rounded bg-white shadow-2xs" data-testid="object-status-history-row">
                      <div className="fw-semibold text-dark mb-1">
                        {entry.previousStatus ? `${entry.previousStatus} → ` : ''}
                        {entry.newStatus}
                      </div>
                      <div className="text-muted small">
                        {[
                          entry.changedBy,
                          entry.changedAt ? formatMaritimeDateTime(entry.changedAt) : null,
                          entry.note,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Universal Document Preview Modal */}
      {previewDoc && (
        <UniversalDocumentPreviewModal
          isOpen={Boolean(previewDoc)}
          document={previewDoc}
          onClose={() => setPreviewDoc(null)}
          title={previewDoc.title || 'Document Preview'}
          subtitle={`${previewDoc.certificateNo || previewDoc.id} · ${activity.name}`}
          extraAction={
            previewDoc && canManageActivityDocs ? (
              <button
                type="button"
                className="btn btn-sm btn-outline-light text-nowrap"
                onClick={() => {
                  const target = previewDoc;
                  setPreviewDoc(null);
                  setVersionTargetDoc(target);
                  setIsUploadModalOpen(true);
                }}
              >
                Upload New Version
              </button>
            ) : undefined
          }
        />
      )}

      {/* Upload Document Modal */}
      {isUploadModalOpen && activity && (
        <DocumentUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => {
            setIsUploadModalOpen(false);
            setVersionTargetDoc(null);
          }}
          existingDocument={versionTargetDoc ?? undefined}
          defaultObjectType="activity"
          defaultObjectId={activity.id}
          allowVersionModeSwitch={true}
          modalTitle={
            versionTargetDoc
              ? `Upload New Version: ${versionTargetDoc.title}`
              : `Upload Document for ${activity.name}`
          }
          onUploadComplete={() => {
            setIsUploadModalOpen(false);
            setVersionTargetDoc(null);
            setToastMessage('Document uploaded.');
            setTimeout(() => setToastMessage(null), 3500);
          }}
        />
      )}
    </div>
  );
};
