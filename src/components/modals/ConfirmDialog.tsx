import React, { useId, useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

export interface ConfirmDialogProps {
  isOpen?: boolean;
  title: React.ReactNode;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  /** If provided, renders a required reason textarea and passes the text to onConfirm */
  reasonLabel?: string;
  reasonPlaceholder?: string;
  initialReason?: string;
  isSubmitting?: boolean;
  dismissible?: boolean;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
  zIndex?: number;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen = true,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  reasonLabel,
  reasonPlaceholder,
  initialReason = '',
  isSubmitting = false,
  dismissible = true,
  onConfirm,
  onCancel,
  zIndex,
}) => {
  const reasonInputId = useId();
  const [reason, setReason] = useState<string>(initialReason);

  // Reset reason when dialog opens or initialReason changes
  useEffect(() => {
    if (isOpen) {
      setReason(initialReason);
    }
  }, [isOpen, initialReason]);

  const hasReasonRequirement = Boolean(reasonLabel);
  const isReasonFilled = reason.trim().length > 0;
  const isConfirmDisabled = isSubmitting || (hasReasonRequirement && !isReasonFilled);

  const handleConfirm = () => {
    if (isConfirmDisabled) return;
    onConfirm(hasReasonRequirement ? reason.trim() : undefined);
  };

  const footer = (
    <>
      <button
        type="button"
        className="btn btn-sm btn-outline-secondary"
        onClick={onCancel}
        disabled={isSubmitting}
        data-testid="confirm-dialog-cancel"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        className={`btn btn-sm ${tone === 'danger' ? 'btn-danger text-white' : 'btn-primary'}`}
        onClick={handleConfirm}
        disabled={isConfirmDisabled}
        data-testid="confirm-dialog-confirm"
      >
        {isSubmitting ? 'Please wait...' : confirmLabel}
      </button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="sm"
      dismissible={dismissible}
      zIndex={zIndex}
      footer={footer}
    >
      <div className="d-flex flex-column gap-3">
        <div className="d-flex gap-3 align-items-start">
          {tone === 'danger' && (
            <div
              className="rounded-circle bg-danger-subtle text-danger d-inline-flex align-items-center justify-content-center flex-shrink-0"
              style={{ width: '36px', height: '36px' }}
              aria-hidden="true"
              data-testid="confirm-dialog-danger-icon"
            >
              <AlertTriangle size={20} />
            </div>
          )}
          <div className="text-secondary small flex-grow-1" style={{ fontSize: '13px', lineHeight: '1.5' }}>
            {message}
          </div>
        </div>

        {hasReasonRequirement && (
          <div>
            <label htmlFor={reasonInputId} className="form-label small fw-semibold text-secondary mb-1">
              {reasonLabel} <span className="text-danger">*</span>
            </label>
            <textarea
              id={reasonInputId}
              className="form-control form-control-sm"
              rows={3}
              placeholder={reasonPlaceholder}
              value={reason}
              disabled={isSubmitting}
              onChange={(e) => setReason(e.target.value)}
              data-testid="confirm-dialog-reason"
            />
          </div>
        )}
      </div>
    </Modal>
  );
};

