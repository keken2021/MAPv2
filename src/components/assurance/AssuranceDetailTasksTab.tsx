/*
  file summary: sub-view rendering the Tasks tab pane inside AssuranceDetailView.
  responsibilities: displays the ProjectTasksTable scoped to the assurance set (including dynamic inspection tasks), contract expiry alerts, and open CAPA findings.
  role in system: extracted from AssuranceDetailView.tsx to comply with Map Design System §12 file size limits.
*/

import React from 'react';
import { AssuranceSet, AssuranceRequirement } from '../../types/assurance';
import { MasterDocument } from '../../types/document';
import { CapaItem } from '../../types/capa';
import { UserProfile } from '../../types/user';
import { UserRolePersona } from '../../types/audit';
import { ProjectTasksTable, getTaskRowActionLabel } from '../tables/ProjectTasksTable';
import { StatusBadge } from '../common/StatusBadge';
import { INSPECTION_TASK_TITLE, APPROVAL_TASK_TITLE } from '../../utils/stageTasks';
import { AssuranceSetRoleActions } from '../../utils/rbacHelpers';

export interface AssuranceDetailTasksTabProps {
  tasksPaneMounted: boolean;
  activeTab: string;
  isRestrictedProjectOwner: boolean;
  shortCertificates: unknown[];
  formatMaritimeDate: (dateStr: string) => string;
  assuranceSet: AssuranceSet;
  documents: MasterDocument[];
  focusedTaskReqId?: string;
  viewerParty?: 'requesting' | 'responding' | 'other' | string;
  canUploadHere: boolean;
  roleActions: AssuranceSetRoleActions;
  isApproverViewer: boolean;
  setSelectedTaskReqIdForApproverDrawer: (id: string | null) => void;
  setFocusedRequirementId: (id: string | undefined) => void;
  setShowBackToTasks: (show: boolean) => void;
  setActiveTab: (tab: any) => void;
  openRequirementUpload: (req: AssuranceRequirement, linkedDoc?: MasterDocument) => void;
  getRequirementDocumentView: (
    set: AssuranceSet,
    req: AssuranceRequirement,
    doc: MasterDocument,
  ) => { doc?: MasterDocument; isLocked?: boolean } | undefined;
  setSelectedDocForReview: (info: {
    doc: MasterDocument;
    notes?: string;
    requirementId?: string;
    verifierStatus?: string;
    isVersionLocked?: boolean;
  } | null) => void;
  openFindings: CapaItem[];
  canSessionUserAccessCapa: (
    capa: CapaItem,
    sets: AssuranceSet[],
    persona: UserRolePersona,
    org?: string,
    user?: UserProfile | null,
    users?: UserProfile[],
  ) => boolean;
  assuranceSets: AssuranceSet[];
  activePersona: UserRolePersona;
  activeDemoOrganization?: string;
  sessionUser?: UserProfile | null;
  users: UserProfile[];
  selectedFindingCapaId: string | null;
  setSelectedFindingCapaId: (id: string | null) => void;
  setCurrentHashView: (view: string, entityId?: string) => void;
}

export const AssuranceDetailTasksTab: React.FC<AssuranceDetailTasksTabProps> = ({
  tasksPaneMounted,
  activeTab,
  isRestrictedProjectOwner,
  shortCertificates,
  formatMaritimeDate,
  assuranceSet,
  documents,
  focusedTaskReqId,
  viewerParty,
  canUploadHere,
  roleActions,
  isApproverViewer,
  setSelectedTaskReqIdForApproverDrawer,
  setFocusedRequirementId,
  setShowBackToTasks,
  setActiveTab,
  openRequirementUpload,
  getRequirementDocumentView,
  setSelectedDocForReview,
  openFindings,
  canSessionUserAccessCapa,
  assuranceSets,
  activePersona,
  activeDemoOrganization,
  sessionUser,
  users,
  selectedFindingCapaId,
  setSelectedFindingCapaId,
  setCurrentHashView,
}) => {
  if (!tasksPaneMounted) return null;

  return (
    <div
      style={{ display: activeTab === 'tasks' ? 'flex' : 'none' }}
      className="flex-column gap-3"
      data-testid="assurance-detail-tasks-tab-pane"
    >
      {isRestrictedProjectOwner ? (
        <div className="card map-card-custom p-4 text-center my-2" data-testid="restricted-project-owner-tasks-note">
          <p className="text-secondary mb-0">Documents and requirements are restricted to participating group members.</p>
        </div>
      ) : (
        <>
          {shortCertificates.length > 0 && (
            <div className="alert alert-warning mb-0" role="status">
              {shortCertificates.length === 1
                ? '1 certificate expires'
                : `${shortCertificates.length} certificates expire`}{' '}
              before the contract ends on {formatMaritimeDate(assuranceSet.charterWindowEnd || '')}.
            </div>
          )}
          <ProjectTasksTable
            sets={assuranceSet ? [assuranceSet] : []}
            scope={{ type: 'set', id: assuranceSet?.id || '' }}
            documents={documents}
            highlightedTaskId={focusedTaskReqId}
            today={new Date()}
            showActions
            viewerParty={viewerParty}
            canUpload={canUploadHere}
            canVerify={roleActions.canVerify}
            onOpenRequirement={(req, parentSet) => {
              if (req.title === INSPECTION_TASK_TITLE || req.category === 'Inspection' || req.id.endsWith('-INSPECTION')) {
                setCurrentHashView('inspector', parentSet?.id || assuranceSet.id);
                return;
              }
              if (req.title === APPROVAL_TASK_TITLE || req.category === 'Approval' || req.id.endsWith('-APPROVAL')) {
                setCurrentHashView('approver', parentSet?.id || assuranceSet.id);
                return;
              }
              if (isApproverViewer) {
                setSelectedTaskReqIdForApproverDrawer(req.id);
                return;
              }
              setFocusedRequirementId(req.id);
              setShowBackToTasks(true);
              setActiveTab('requirements');
            }}
            onTaskAction={(req, parentSet) => {
              const linkedDoc = documents.find((d) => d.id === req.documentId || (req.linkedDocumentId && d.id === req.linkedDocumentId));
              const action = getTaskRowActionLabel(
                { requirement: req, parentSet },
                viewerParty,
                {
                  canUpload: canUploadHere,
                  canVerify: roleActions.canVerify,
                  canInspect: roleActions.canInspect,
                  canApprove: roleActions.canApprove,
                },
                { document: linkedDoc, today: new Date() },
              );
              if (action === 'Inspect') {
                setCurrentHashView('inspector', parentSet.id);
                return;
              }
              if (action === 'Approve') {
                setCurrentHashView('approver', parentSet.id);
                return;
              }
              if (req.title === APPROVAL_TASK_TITLE || req.category === 'Approval' || req.id.endsWith('-APPROVAL')) {
                setCurrentHashView('approver', parentSet.id);
                return;
              }
              if (req.title === INSPECTION_TASK_TITLE || req.category === 'Inspection' || req.id.endsWith('-INSPECTION')) {
                setCurrentHashView('inspector', parentSet.id);
                return;
              }
              if (action === 'Upload') {
                openRequirementUpload(req, linkedDoc);
              } else if (action === 'Review') {
                if (linkedDoc) {
                  const docView = getRequirementDocumentView(parentSet, req, linkedDoc);
                  setSelectedDocForReview({
                    doc: docView?.doc || linkedDoc,
                    notes: req.notes,
                    requirementId: req.id,
                    verifierStatus: req.verifierStatus,
                    isVersionLocked: docView?.isLocked,
                  });
                }
              } else if (isApproverViewer) {
                setSelectedTaskReqIdForApproverDrawer(req.id);
              } else {
                setFocusedRequirementId(req.id);
                setShowBackToTasks(true);
                setActiveTab('requirements');
              }
            }}
          />

          {(() => {
            const setOpenCapas = openFindings.filter(
              (c) =>
                (!c.assuranceSetId || c.assuranceSetId === assuranceSet.id) &&
                canSessionUserAccessCapa(
                  c,
                  assuranceSets,
                  activePersona,
                  activeDemoOrganization,
                  sessionUser,
                  users,
                ),
            );
            if (setOpenCapas.length === 0) return null;
            return (
              <div className="card map-card-custom" data-testid="tasks-open-findings-card">
                <div className="card-header p-3 border-bottom d-flex align-items-center justify-content-between">
                  <span className="fw-bold text-dark fs-6">Open Findings</span>
                  <span className="badge bg-warning text-dark font-mono-code">
                    {setOpenCapas.length}
                  </span>
                </div>
                <div className="table-responsive">
                  <table className="table map-table-custom align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Finding</th>
                        <th>Owner</th>
                        <th>Due Date</th>
                        <th>Status</th>
                        <th className="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {setOpenCapas.map((capa) => {
                        const isResponder =
                          activePersona === 'Submitter' || activePersona === 'Administrator';
                        const actionText = isResponder
                          ? 'Respond'
                          : activePersona === 'Inspector'
                          ? 'Re-inspect'
                          : 'View';
                        return (
                          <tr
                            key={capa.id}
                            className={selectedFindingCapaId === capa.id ? 'table-primary' : undefined}
                            data-capa-id={capa.id}
                          >
                            <td>
                              <div className="fw-semibold text-dark">{capa.title}</div>
                              <div className="font-mono-code text-muted small" style={{ fontSize: '0.72rem' }}>
                                {capa.id} · {capa.checklistItemTitle}
                              </div>
                            </td>
                            <td className="small text-dark">{capa.owner}</td>
                            <td className="small font-mono-code">{formatMaritimeDate(capa.dueDate)}</td>
                            <td>
                              <StatusBadge value={capa.status} />
                            </td>
                            <td className="text-end">
                              <button
                                type="button"
                                className={`btn btn-sm ${
                                  isResponder || activePersona === 'Inspector'
                                    ? 'btn-primary'
                                    : 'btn-outline-primary'
                                }`}
                                onClick={() => setSelectedFindingCapaId(capa.id)}
                                data-testid={`finding-action-btn-${capa.id}`}
                              >
                                {actionText}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
};
