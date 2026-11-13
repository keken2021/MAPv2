/*
  file summary: single row component for ProjectTasksTable.
  responsibilities: renders a single task row with compact one-line cells, regular font weights, hover tooltips for IDs, and handles per-row permissions and actions.
  role in system: extracted row component used by ProjectTasksTable per Map Design System §12.
*/

import React from 'react';
import { StatusBadge } from '../common/StatusBadge';
import { useMapStore } from '../../store/useMapStore';
import type { AssuranceRequirement, AssuranceSet } from '../../types/assurance';
import type { MasterDocument } from '../../types/document';
import type { UserProfile } from '../../types/user';
import { getAssuranceSetRoleActions } from '../../utils/rbacHelpers';
import { isClosedAssuranceSet } from '../../utils/documentVersionSnapshot';
import { documentExpiresBeforeContractEnd, isDocumentExpired } from '../../utils/documentRenewalHelpers';
import {
  INSPECTION_TASK_TITLE,
  INSPECTION_TASK_STATUS,
  APPROVAL_TASK_TITLE,
  APPROVAL_TASK_STATUS,
} from '../../utils/stageTasks';

export type TaskStatus = 'Pending' | 'On-going' | 'Done' | 'To Inspect' | 'To Approve';

export interface ProjectTaskRow {
  id: string;
  requirement: AssuranceRequirement;
  parentSet: AssuranceSet;
  targetObject: { name: string; identifier?: string; type?: string };
  assignee: string;
  status: TaskStatus;
  targetDate?: string;
  isOverdue: boolean;
  isBlocking: boolean;
  isCompleted: boolean;
  isMyOrg: boolean;
  outcomeLabel?: string;
  note?: string;
}

export type ProjectTaskRowData = ProjectTaskRow;

export interface ProjectTaskRowProps {
  row: ProjectTaskRow;
  hasActions?: boolean;
  showParentSet?: boolean;
  isHighlighted?: boolean;
  explicitParty?: 'requesting' | 'responding' | 'other' | string;
  canUploadProp?: boolean;
  canVerifyProp?: boolean;
  resolvedOrg?: string;
  resolvedSessionUser?: Partial<Pick<UserProfile, 'id' | 'name' | 'organization' | 'roles'>> | null;
  resolvedDocuments?: MasterDocument[];
  today?: Date;
  onOpenSet?: (set: AssuranceSet) => void;
  onOpenRequirement?: (requirement: AssuranceRequirement, set: AssuranceSet) => void;
  onTaskAction?: (requirement: AssuranceRequirement, set: AssuranceSet) => void;
}

export function getTaskRowActionLabel(
  row: { requirement: AssuranceRequirement; status?: string; parentSet?: AssuranceSet; outcomeLabel?: string; note?: string },
  viewerParty?: 'requesting' | 'responding' | 'other' | string,
  permissions?: { canUpload?: boolean; canVerify?: boolean; canInspect?: boolean; canApprove?: boolean },
  context?: { document?: Pick<MasterDocument, 'expiryDate' | 'complianceState'>; today?: Date; isActionable?: boolean },
): 'Upload' | 'Review' | 'View' | 'Inspect' | 'Approve' | undefined {
  const req = row.requirement;
  const isInspectionRow =
    req?.id?.endsWith('-INSPECTION') ||
    req?.title === INSPECTION_TASK_TITLE ||
    (row.status as string) === INSPECTION_TASK_STATUS;

  if (isInspectionRow) {
    if (row.status === 'Done') {
      return 'View';
    }
    const isActionable = context?.isActionable ?? permissions?.canInspect;
    return isActionable ? 'Inspect' : 'View';
  }

  const isApprovalRow =
    req?.id?.endsWith('-APPROVAL') ||
    req?.title === APPROVAL_TASK_TITLE ||
    (row.status as string) === APPROVAL_TASK_STATUS;

  if (isApprovalRow) {
    if (row.status === 'Done') {
      return 'View';
    }
    if (row.status === 'On-going') {
      return undefined;
    }
    const isActionable = context?.isActionable ?? permissions?.canApprove;
    return isActionable ? 'Approve' : 'View';
  }
  const party = (viewerParty || '').toLowerCase();
  const statusLower = (row.status || '').toLowerCase();

  const isReuploadRequested =
    Boolean(req?.reuploadRequested) ||
    statusLower === 'reupload_requested' ||
    statusLower === 'reupload requested' ||
    req?.verifierStatus === 'Correction Requested' ||
    req?.verifierStatus === 'Rejected';

  const needsRenewalUpload = Boolean(
    context?.document &&
      (isDocumentExpired(context.document, context.today) ||
        (row.parentSet?.charterWindowEnd &&
          documentExpiresBeforeContractEnd(context.document, row.parentSet.charterWindowEnd))),
  );

  const isPending =
    statusLower === 'pending' ||
    isReuploadRequested ||
    (!req?.documentId && !req?.linkedDocumentId && req?.verifierStatus !== 'Verified');

  const isSubmitted =
    statusLower === 'submitted' ||
    (!isReuploadRequested &&
      Boolean(req?.documentId || req?.linkedDocumentId) &&
      (req?.verifierStatus === 'Pending' || statusLower === 'on-going'));

  if (party === 'responding') {
    if (isPending || isReuploadRequested || needsRenewalUpload) {
      return permissions?.canUpload === false ? 'View' : 'Upload';
    }
  }

  if (party === 'requesting') {
    if (isSubmitted) {
      return permissions?.canVerify === false ? 'View' : 'Review';
    }
  }

  return 'View';
}

export function resolveViewerPartyForRow(
  parentSet: AssuranceSet,
  explicitParty?: string,
  sessionUser?: { organization?: string; name?: string; id?: string } | null,
  activeDemoOrganization?: string,
): 'requesting' | 'responding' | 'other' {
  if (explicitParty) {
    const p = explicitParty.toLowerCase();
    if (p === 'requesting' || p === 'responding') return p;
  }
  const org = (activeDemoOrganization || sessionUser?.organization || '').trim().toLowerCase();
  if (org && parentSet) {
    const responding = (parentSet.respondingParty || parentSet.serviceProviderOrg || '').trim().toLowerCase();
    const requesting = (parentSet.requestingParty || parentSet.clientOrg || '').trim().toLowerCase();
    if (responding && (org === responding || org.includes(responding) || responding.includes(org))) {
      return 'responding';
    }
    if (requesting && (org === requesting || org.includes(requesting) || requesting.includes(org))) {
      return 'requesting';
    }
  }
  return 'other';
}

export const ProjectTaskRow: React.FC<ProjectTaskRowProps> = ({
  row,
  hasActions = false,
  showParentSet = true,
  isHighlighted = false,
  explicitParty,
  canUploadProp,
  canVerifyProp,
  resolvedOrg,
  resolvedSessionUser,
  resolvedDocuments = [],
  today,
  onOpenSet,
  onOpenRequirement,
  onTaskAction,
}) => {
  const store = useMapStore();
  const { requirement, parentSet, targetObject, assignee, status, targetDate } = row;

  const rowParty =
    explicitParty ||
    resolveViewerPartyForRow(parentSet, explicitParty, resolvedSessionUser, resolvedOrg);

  const roleActions = getAssuranceSetRoleActions(
    parentSet,
    store.activePersona,
    resolvedOrg, 
    resolvedSessionUser as Pick<UserProfile, 'id' | 'name' | 'organization' | 'roles'> | null | undefined,
  );

  const isNonUploadPersona =
    store.activePersona !== 'Administrator' && store.activePersona !== 'Submitter';

  const rowPermissions = {
    canUpload:
      canUploadProp !== undefined
        ? canUploadProp
        : store.isAuthenticated
          ? roleActions.canUpload && !isClosedAssuranceSet(parentSet) && parentSet.stage !== 'Cancelled'
          : !isNonUploadPersona && !isClosedAssuranceSet(parentSet) && parentSet.stage !== 'Cancelled',
    canVerify:
      canVerifyProp !== undefined
        ? canVerifyProp
        : store.isAuthenticated
          ? roleActions.canVerify
          : undefined,
    canInspect: roleActions.canInspect,
    canApprove: roleActions.canApprove,
  };

  const rowLinkedDocId = requirement.documentId || requirement.linkedDocumentId;
  const rowLinkedDoc = rowLinkedDocId
    ? resolvedDocuments.find((d) => d.id === rowLinkedDocId)
    : undefined;

  const actionLabel = getTaskRowActionLabel(row, rowParty, rowPermissions, {
    document: rowLinkedDoc,
    today,
  });

  const handleOpenSetClick = () => {
    if (onOpenSet) {
      onOpenSet(parentSet);
    } else {
      store.setCurrentHashView?.('assurance-sets', parentSet.id);
    }
  };

  const handleOpenRequirementClick = () => {
    if (actionLabel === 'Inspect' || requirement.title === INSPECTION_TASK_TITLE || requirement.id.endsWith('-INSPECTION')) {
      store.setCurrentHashView?.('inspector', parentSet.id);
      return;
    }
    if (actionLabel === 'Approve' || requirement.title === APPROVAL_TASK_TITLE || requirement.id.endsWith('-APPROVAL')) {
      store.setCurrentHashView?.('approver', parentSet.id);
      return;
    }
    onOpenRequirement?.(requirement, parentSet);
  };

  const hasLinkedDoc = Boolean(row.requirement.documentId || row.requirement.linkedDocumentId || rowLinkedDoc);
  const isReupload =
    Boolean(row.requirement.reuploadRequested) ||
    (row.status || '').toLowerCase().includes('reupload') ||
    (hasLinkedDoc &&
      (row.requirement.verifierStatus === 'Correction Requested' ||
        row.requirement.verifierStatus === 'Rejected' ||
        Boolean(
          rowLinkedDoc &&
            (isDocumentExpired(rowLinkedDoc, today) ||
              (parentSet.charterWindowEnd &&
                documentExpiresBeforeContractEnd(rowLinkedDoc, parentSet.charterWindowEnd))),
        )));
  const displayActionLabel = actionLabel === 'Upload' && isReupload ? 'Reupload' : actionLabel;

  return (
    <tr
      key={row.id}
      data-task-id={requirement.id}
      data-set-id={parentSet.id}
      className={isHighlighted ? 'table-primary' : undefined}
    >
      <td>
        {onOpenRequirement ? (
          <button
            type="button"
            className="btn btn-link p-0 text-start fw-normal text-decoration-none"
            onClick={handleOpenRequirementClick}
            title={`Open ${requirement.title}`}
            data-testid={`task-open-req-${requirement.id}`}
          >
            {requirement.title}
          </button>
        ) : (
          <div className="fw-normal text-dark">{requirement.title}</div>
        )}
      </td>
      {showParentSet && (
        <td>
          <button
            type="button"
            className="btn btn-link p-0 text-start fw-normal text-decoration-none"
            onClick={handleOpenSetClick}
            title={`Open ${parentSet.title} (${parentSet.id})`}
          >
            {parentSet.title}
          </button>
        </td>
      )}
      <td>
        <div
          className="fw-normal text-dark"
          title={targetObject.identifier || undefined}
        >
          {targetObject.name}
        </div>
      </td>
      <td>
        <div className="text-dark small fw-medium">{assignee}</div>
      </td>
      <td>
        <div className="d-flex flex-column align-items-start gap-1">
          <div className="d-flex align-items-center gap-1.5 flex-wrap">
            <span
              className={`badge ${
                status === 'Done'
                  ? 'bg-success text-white'
                  : status === 'On-going'
                    ? 'bg-info text-dark'
                    : 'bg-secondary text-white'
              }`}
              style={{ fontSize: '0.75rem' }}
              data-testid="task-status-badge"
            >
              {status}
            </span>
            {row.outcomeLabel && (
              <StatusBadge value={row.outcomeLabel} />
            )}
            {row.isOverdue && (
              <span
                className="badge bg-danger text-white"
                style={{ fontSize: '0.7rem' }}
                data-testid="task-overdue-flag"
              >
                Overdue
              </span>
            )}
            {row.requirement.reuploadRequested && (
              <span
                className="badge bg-warning text-dark"
                style={{ fontSize: '0.7rem' }}
                data-testid="task-reupload-requested-flag"
                title={row.requirement.reuploadRequested.reason}
              >
                Reupload requested
              </span>
            )}
          </div>
          {row.note && (
            <span
              className="text-muted small fst-italic"
              style={{ fontSize: '0.72rem' }}
              data-testid="task-row-note"
            >
              {row.note}
            </span>
          )}
          {row.requirement.reuploadRequested?.reason && (
            <span
              className="text-warning-emphasis small fst-italic"
              style={{ fontSize: '0.72rem', maxWidth: '240px' }}
              title={row.requirement.reuploadRequested.reason}
            >
              {row.requirement.reuploadRequested.reason}
            </span>
          )}
          {targetDate ? (
            <span
              className={`small font-mono-code ${
                row.isOverdue ? 'text-danger fw-semibold' : 'text-muted'
              }`}
              style={{ fontSize: '0.72rem' }}
            >
              Due: {targetDate}
            </span>
          ) : (
            <span className="text-muted small" style={{ fontSize: '0.72rem' }}>
              —
            </span>
          )}
        </div>
      </td>
      {hasActions && (
        <td className="text-end" style={{ whiteSpace: 'nowrap' }}>
          {(() => {
            if (!displayActionLabel) {
              return null;
            }
            return (
              <button
                type="button"
                className={`btn btn-sm ${
                  displayActionLabel === 'Upload' ||
                  displayActionLabel === 'Reupload' ||
                  displayActionLabel === 'Review' ||
                  displayActionLabel === 'Inspect' ||
                  displayActionLabel === 'Approve'
                    ? 'btn-primary'
                    : 'btn-outline-primary'
                }`}
                onClick={() => {
                  if (displayActionLabel === 'Inspect') {
                    store.setCurrentHashView?.('inspector', parentSet.id);
                    onTaskAction?.(requirement, parentSet);
                    return;
                  }
                  if (displayActionLabel === 'Approve') {
                    store.setCurrentHashView?.('approver', parentSet.id);
                    onTaskAction?.(requirement, parentSet);
                    return;
                  }
                  if (onTaskAction) {
                    onTaskAction(requirement, parentSet);
                  } else {
                    onOpenRequirement?.(requirement, parentSet);
                  }
                }}
                data-testid={`task-action-btn-${requirement.id}`}
                aria-label={`${displayActionLabel} requirement ${requirement.title}`}
              >
                {displayActionLabel}
              </button>
            );
          })()}
        </td>
      )}
    </tr>
  );
};

export default ProjectTaskRow;
