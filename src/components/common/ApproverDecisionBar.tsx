import React, { useState } from 'react';
import { AlertCircle, CheckCircle, RotateCcw, XCircle } from 'lucide-react';
import { AssuranceSet } from '../../types/assurance';
import { useMapStore } from '../../store/useMapStore';

export interface ApproverDecisionBarProps {
  assuranceSet: AssuranceSet;
  openFindingsCount?: number;
  onDecisionSubmitted?: (
    decision: 'Approved' | 'Returned for Correction' | 'Rejected',
    reason?: string,
  ) => void;
}

export const ApproverDecisionBar: React.FC<ApproverDecisionBarProps> = ({
  assuranceSet,
  openFindingsCount = 0,
  onDecisionSubmitted,
}) => {
  const setApproverDecision = useMapStore((s) => s.setApproverDecision);

  const [modalAction, setModalAction] = useState<
    'Returned for Correction' | 'Rejected' | null
  >(null);
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState('');

  const isOpenFindingsBlocking = openFindingsCount > 0;

  const handleApprove = () => {
    if (isOpenFindingsBlocking) return;
    const notes = 'Approved by Executive Approver';
    setApproverDecision(assuranceSet.id, 'Approved', notes);
    onDecisionSubmitted?.('Approved', notes);
  };

  const handleOpenModal = (action: 'Returned for Correction' | 'Rejected') => {
    setModalAction(action);
    setReason('');
    setValidationError('');
  };

  const handleCloseModal = () => {
    setModalAction(null);
    setReason('');
    setValidationError('');
  };

  const handleSubmitModal = () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setValidationError(
        modalAction === 'Returned for Correction'
          ? 'A reason is required to return this assurance set for correction.'
          : 'A reason is required to reject this assurance set.',
      );
      return;
    }
    if (!modalAction) return;

    setApproverDecision(assuranceSet.id, modalAction, trimmed);
    onDecisionSubmitted?.(modalAction, trimmed);
    handleCloseModal();
  };

  return (
    <div
      className="p-3 mb-3 bg-light rounded border d-flex flex-column gap-2"
      data-testid="approver-decision-bar"
    >
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div className="d-flex align-items-center gap-2">
          <span className="fw-semibold text-slate-900 small">Approver Decision</span>
          <span className="badge bg-primary-subtle text-primary border border-primary-subtle font-mono-code">
            Approval Stage
          </span>
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

      {isOpenFindingsBlocking && (
        <div
          className="alert alert-warning py-1.5 px-3 mb-0 small text-danger fw-semibold d-flex align-items-center gap-1.5"
          role="alert"
        >
          <AlertCircle size={15} className="flex-shrink-0" />
          <span>
            Cannot approve: {openFindingsCount} open{' '}
            {openFindingsCount === 1 ? 'finding remains' : 'findings remain'}. Resolve findings before approval.
          </span>
        </div>
      )}

      {modalAction && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1050 }} />
          <div
            className="modal show d-block"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="approver-decision-modal-title"
            style={{ zIndex: 1055 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) handleCloseModal();
            }}
          >
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header border-bottom py-2.5 px-3">
                  <h5 id="approver-decision-modal-title" className="modal-title fs-6 fw-bold text-slate-900">
                    {modalAction === 'Returned for Correction' ? 'Return for Correction' : 'Reject Assurance Set'}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={handleCloseModal}
                  />
                </div>
                <div className="modal-body p-3">
                  <p className="text-muted small mb-3">
                    {modalAction === 'Returned for Correction'
                      ? 'Provide a clear reason for returning this assurance set for correction. The submitter will be notified to revise documentation.'
                      : 'Provide a formal reason for rejecting this assurance set. This decision will be recorded in the audit trail.'}
                  </p>
                  <div className="mb-2">
                    <label
                      htmlFor="approver-decision-reason"
                      className="form-label small fw-semibold text-secondary"
                    >
                      Reason <span className="text-danger">*</span>
                    </label>
                    <textarea
                      id="approver-decision-reason"
                      className="form-control form-control-sm"
                      rows={4}
                      placeholder={
                        modalAction === 'Returned for Correction'
                          ? 'Specify required corrections...'
                          : 'Specify rejection justification...'
                      }
                      value={reason}
                      onChange={(e) => {
                        setReason(e.target.value);
                        if (validationError && e.target.value.trim()) {
                          setValidationError('');
                        }
                      }}
                    />
                    {validationError && (
                      <div className="text-danger small mt-1">{validationError}</div>
                    )}
                  </div>
                </div>
                <div className="modal-footer border-top py-2 px-3">
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={handleCloseModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${
                      modalAction === 'Returned for Correction'
                        ? 'btn-warning text-dark'
                        : 'btn-danger text-white'
                    } fw-semibold`}
                    disabled={!reason.trim()}
                    onClick={handleSubmitModal}
                  >
                    {modalAction === 'Returned for Correction' ? 'Return for Correction' : 'Reject'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ApproverDecisionBar;

