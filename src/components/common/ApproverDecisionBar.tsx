import React, { useState } from 'react';
import { CheckCircle, RotateCcw, XCircle } from 'lucide-react';
import { AssuranceSet } from '../../types/assurance';
import { useMapStore } from '../../store/useMapStore';
import { doFindingsBlockSet } from '../../utils/readinessHelpers';
import { ConfirmDialog } from '../modals/ConfirmDialog';
import { FindingsApprovalNotice } from './FindingsApprovalNotice';

export interface ApproverDecisionBarProps {
  assuranceSet: AssuranceSet;
  openFindingsCount?: number;
  confirmDialogZIndex?: number;
  onModalOpenChange?: (isOpen: boolean) => void;
  onDecisionSubmitted?: (
    decision: 'Approved' | 'Returned for Correction' | 'Rejected',
    reason?: string,
  ) => void;
}

export const ApproverDecisionBar: React.FC<ApproverDecisionBarProps> = ({
  assuranceSet,
  openFindingsCount = 0,
  confirmDialogZIndex,
  onModalOpenChange,
  onDecisionSubmitted,
}) => {
  const setApproverDecision = useMapStore((s) => s.setApproverDecision);

  const [modalAction, setModalAction] = useState<
    'Returned for Correction' | 'Rejected' | null
  >(null);

  const isOpenFindingsBlocking = openFindingsCount > 0 && doFindingsBlockSet(assuranceSet);

  const handleApprove = () => {
    if (isOpenFindingsBlocking) return;
    const notes = 'Approved by Executive Approver';
    setApproverDecision(assuranceSet.id, 'Approved', notes);
    onDecisionSubmitted?.('Approved', notes);
  };

  const handleOpenModal = (action: 'Returned for Correction' | 'Rejected') => {
    setModalAction(action);
    onModalOpenChange?.(true);
  };

  const handleCloseModal = () => {
    setModalAction(null);
    onModalOpenChange?.(false);
  };

  return (
    <div
      className="p-3 mb-3 bg-light rounded border d-flex flex-column gap-2"
      data-testid="approver-decision-bar"
    >
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div className="d-flex align-items-center gap-2">
          <span className="fw-semibold text-slate-900 small">Approver Decision</span>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2">
          <button
            type="button"
            className="btn btn-sm btn-success text-white fw-semibold d-inline-flex align-items-center gap-1.5"
            disabled={isOpenFindingsBlocking}
            title={
              isOpenFindingsBlocking
                ? `Cannot approve: ${openFindingsCount} open finding${openFindingsCount === 1 ? '' : 's'} remain`
                : 'Approve assurance set'
            }
            onClick={handleApprove}
          >
            <CheckCircle size={15} />
            Approve
          </button>
          <button
            type="button"
            className="btn btn-sm btn-warning text-dark fw-semibold d-inline-flex align-items-center gap-1.5"
            onClick={() => handleOpenModal('Returned for Correction')}
          >
            <RotateCcw size={15} />
            Return for correction
          </button>
          <button
            type="button"
            className="btn btn-sm btn-danger text-white fw-semibold d-inline-flex align-items-center gap-1.5"
            onClick={() => handleOpenModal('Rejected')}
          >
            <XCircle size={15} />
            Reject
          </button>
        </div>
      </div>

      <FindingsApprovalNotice openFindingsCount={openFindingsCount} blocking={isOpenFindingsBlocking} />

      <ConfirmDialog
        isOpen={Boolean(modalAction)}
        title={modalAction === 'Returned for Correction' ? 'Return for Correction' : 'Reject Assurance Set'}
        message={
          modalAction === 'Returned for Correction'
            ? 'Provide a clear reason for returning this assurance set for correction. The submitter will be notified to revise documentation.'
            : 'Provide a formal reason for rejecting this assurance set. This decision will be recorded in the audit trail.'
        }
        confirmLabel={modalAction === 'Returned for Correction' ? 'Return for Correction' : 'Reject'}
        tone={modalAction === 'Rejected' ? 'danger' : 'default'}
        zIndex={confirmDialogZIndex}
        reasonLabel="Reason"
        reasonPlaceholder={
          modalAction === 'Returned for Correction'
            ? 'Specify required corrections...'
            : 'Specify rejection justification...'
        }
        onConfirm={(reason) => {
          if (!modalAction) return;
          setApproverDecision(assuranceSet.id, modalAction, reason ?? '');
          onDecisionSubmitted?.(modalAction, reason ?? '');
          handleCloseModal();
        }}
        onCancel={handleCloseModal}
      />
    </div>
  );
};

export default ApproverDecisionBar;

