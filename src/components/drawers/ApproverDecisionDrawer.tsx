/*
  file summary: approver decision drawer for inspecting a task's verification record, linked document preview, and executing task-level or set-level approval actions directly from the Tasks tab.
  responsibilities: keeps approvers in-place on Tasks tab when clicking View on a task row, surfacing linked certificate preview, verifier attestation details, requirement-level return/reject, and ApproverDecisionBar controls.
  role in system: drawer overlay opened from AssuranceDetailView Tasks tab for Approver persona.
*/

import React, { useState } from 'react';
import { FileText, RotateCcw, XCircle } from 'lucide-react';
import { AssuranceRequirement, AssuranceSet } from '../../types/assurance';
import { MasterDocument } from '../../types/document';
import { useMapStore } from '../../store/useMapStore';
import { formatMaritimeDate, formatMaritimeDateTime, getStatusDisplayLabel } from '../../utils/formatters';
import { calculateAssuranceSetReadiness } from '../../utils/readinessHelpers';
import { documentExpiresBeforeContractEnd } from '../../utils/documentRenewalHelpers';
import { Drawer } from './Drawer';
import { StatusBadge } from '../common/StatusBadge';
import { ReadinessGauge } from '../common/ReadinessGauge';
import { ApproverDecisionBar } from '../common/ApproverDecisionBar';
import { DocumentCertificatePreview } from '../common/DocumentCertificatePreview';
import { ConfirmDialog } from '../modals/ConfirmDialog';

export interface ApproverDecisionDrawerProps {
  assuranceSet: AssuranceSet;
  requirement: AssuranceRequirement | null;
  linkedDoc?: MasterDocument;
  openFindingsCount: number;
  isNamedApprover: boolean;
  isApprovalStage: boolean;
  onDecisionSubmitted?: (message: string) => void;
  onClose: () => void;
}

export const ApproverDecisionDrawer: React.FC<ApproverDecisionDrawerProps> = ({
  assuranceSet,
  requirement,
  linkedDoc,
  openFindingsCount,
  isNamedApprover,
  isApprovalStage,
  onDecisionSubmitted,
  onClose,
}) => {
  const denyRequirementByApprover = useMapStore((s) => s.denyRequirementByApprover);

  const [pendingReqAction, setPendingReqAction] = useState<'Correction Requested' | 'Rejected' | null>(null);
  const [isBarModalOpen, setIsBarModalOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  if (!requirement) return null;

  const canDecideRequirement =
    isNamedApprover &&
    isApprovalStage &&
    requirement.verifierStatus === 'Verified';

  const readinessScore = calculateAssuranceSetReadiness(assuranceSet);
  const statusDisplayValue =
    requirement.verifierStatus || (requirement.isFulfilled ? 'Verified' : 'Pending');

  const verificationCard = (
    <div className="map-drawer-card">
      <h3 className="map-drawer-section-title">Verification Record</h3>
      <div className="row g-2 small">
        <div className="col-sm-6">
          <div className="map-drawer-label">Verifier Status</div>
          <div>
            <StatusBadge value={statusDisplayValue} />
          </div>
        </div>
        <div className="col-sm-6">
          <div className="map-drawer-label">Assignee</div>
          <div className="text-dark fw-medium">{requirement.assignedSubmitter || assuranceSet.assignedSubmitter || 'Unassigned'}</div>
        </div>
        <div className="col-sm-6">
          <div className="map-drawer-label">Verifier</div>
          <div className="text-dark fw-medium">{requirement.verifiedVersion?.verifiedBy || requirement.assignedVerifier || assuranceSet.assignedVerifier || 'Unassigned'}</div>
        </div>
        <div className="col-sm-6">
          <div className="map-drawer-label">Verification Method</div>
          <div className="text-dark fw-medium">{requirement.verificationMethod || 'Not recorded'}</div>
        </div>
        {requirement.verificationReference && (
          <div className="col-sm-6">
            <div className="map-drawer-label">Reference</div>
            <div className="font-mono-code text-dark">{requirement.verificationReference}</div>
          </div>
        )}
        {requirement.decisionTime && (
          <div className="col-sm-6">
            <div className="map-drawer-label">Decision Date</div>
            <div className="font-mono-code text-dark">{formatMaritimeDateTime(requirement.decisionTime)}</div>
          </div>
        )}
        {requirement.overrideReason && (
          <div className="col-12">
            <div className="map-drawer-label">Override Reason</div>
            <div className="map-drawer-inset text-warning-emphasis">{requirement.overrideReason}</div>
          </div>
        )}
        {(requirement.notes || requirement.verificationResultSummary) && (
          <div className="col-12">
            <div className="map-drawer-label">Verification Notes</div>
            <div className="map-drawer-inset">
              {requirement.notes || requirement.verificationResultSummary}
            </div>
          </div>
        )}
      </div>

      {linkedDoc && documentExpiresBeforeContractEnd(linkedDoc, assuranceSet.charterWindowEnd) && (
        <div className="alert alert-warning py-2 px-3 small mt-3 mb-0">
          Certificate expires {formatMaritimeDate(linkedDoc.expiryDate)}, before the contract ends{' '}
          {formatMaritimeDate(assuranceSet.charterWindowEnd)}.
        </div>
      )}

      {canDecideRequirement && (
        <div className="d-flex flex-wrap align-items-center gap-2 pt-3 mt-3 border-top">
          <button
            type="button"
            className="btn btn-sm btn-warning text-dark fw-semibold d-inline-flex align-items-center gap-1.5"
            data-testid="approver-drawer-return-req-btn"
            onClick={() => setPendingReqAction('Correction Requested')}
          >
            <RotateCcw size={14} />
            Return task for correction
          </button>
          <button
            type="button"
            className="btn btn-sm btn-danger text-white fw-semibold d-inline-flex align-items-center gap-1.5"
            data-testid="approver-drawer-reject-req-btn"
            onClick={() => setPendingReqAction('Rejected')}
          >
            <XCircle size={14} />
            Reject task
          </button>
        </div>
      )}
    </div>
  );

  const decisionCard = (
    <div className="map-drawer-card" data-testid="approver-drawer-decision-section">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h3 className="map-drawer-section-title mb-0">Approver Decision</h3>
        <StatusBadge value={assuranceSet.stage} />
      </div>

      <div className="mb-3">
        <ReadinessGauge score={readinessScore} size="sm" />
      </div>

      {feedbackMessage && (
        <div className="alert alert-info py-2 px-3 small mb-3" role="status">
          {feedbackMessage}
        </div>
      )}

      {isNamedApprover && isApprovalStage ? (
        <ApproverDecisionBar
          assuranceSet={assuranceSet}
          openFindingsCount={openFindingsCount}
          confirmDialogZIndex={1065}
          onModalOpenChange={setIsBarModalOpen}
          onDecisionSubmitted={(decision) => {
            const msg = `Assurance set ${assuranceSet.id} updated to ${decision}.`;
            setFeedbackMessage(msg);
            onDecisionSubmitted?.(msg);
          }}
        />
      ) : assuranceSet.approverDecision && assuranceSet.approverDecision !== 'Pending' ? (
        <div className="map-drawer-inset small">
          <div className="fw-semibold text-dark">
            Set Decision: {getStatusDisplayLabel(assuranceSet.approverDecision)}
          </div>
          {assuranceSet.assignedApprover && (
            <div className="text-secondary mt-1">Approver: {assuranceSet.assignedApprover}</div>
          )}
          {assuranceSet.approverNotes && (
            <div className="text-secondary mt-1">{assuranceSet.approverNotes}</div>
          )}
        </div>
      ) : (
        <div className="map-drawer-inset text-secondary small">
          Set-level approval decisions unlock once this assurance set reaches the Approval stage and is assigned to you.
        </div>
      )}
    </div>
  );

  return (
    <>
      <Drawer
        title={requirement.title}
        meta={[requirement.id, requirement.category, assuranceSet.vesselName || assuranceSet.title]
          .filter(Boolean)
          .join(' · ')}
        size={linkedDoc ? 'xl' : 'lg'}
        headerAside={<StatusBadge value={statusDisplayValue} />}
        paused={Boolean(pendingReqAction) || isBarModalOpen}
        onClose={onClose}
        footer={
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        }
      >
        <div data-testid="approver-decision-drawer">
          {linkedDoc ? (
            <div className="row g-4">
              <div className="col-md-5 col-lg-5 d-flex flex-column gap-3">
                <DocumentCertificatePreview document={linkedDoc} compact maxHeight="530px" />
              </div>
              <div className="col-md-7 col-lg-7">
                <div className="map-drawer-stack">
                  {verificationCard}
                  {decisionCard}
                </div>
              </div>
            </div>
          ) : (
            <div className="map-drawer-stack">
              <div className="map-drawer-inset d-flex align-items-center gap-2 text-secondary small">
                <FileText size={16} />
                <span>No document attached to this requirement yet.</span>
              </div>
              {verificationCard}
              {decisionCard}
            </div>
          )}
        </div>
      </Drawer>

      <ConfirmDialog
        isOpen={Boolean(pendingReqAction)}
        title={
          pendingReqAction === 'Correction Requested'
            ? 'Return Task for Correction'
            : 'Reject Task'
        }
        message={
          pendingReqAction === 'Correction Requested'
            ? `Specify what needs correction on "${requirement.title}". The submitter will be notified to revise this task.`
            : `Provide a formal reason for rejecting "${requirement.title}".`
        }
        confirmLabel={
          pendingReqAction === 'Correction Requested'
            ? 'Return for Correction'
            : 'Reject Task'
        }
        tone={pendingReqAction === 'Rejected' ? 'danger' : 'default'}
        zIndex={1065}
        reasonLabel="Reason"
        reasonPlaceholder={
          pendingReqAction === 'Correction Requested'
            ? 'Describe the required document correction...'
            : 'State the reason for rejection...'
        }
        onConfirm={(reason) => {
          if (!pendingReqAction) return;
          denyRequirementByApprover(
            assuranceSet.id,
            requirement.id,
            pendingReqAction,
            reason ?? '',
          );
          const msg = `Task "${requirement.title}" updated to ${pendingReqAction}.`;
          setFeedbackMessage(msg);
          onDecisionSubmitted?.(msg);
          setPendingReqAction(null);
        }}
        onCancel={() => setPendingReqAction(null)}
      />
    </>
  );
};
