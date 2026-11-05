import React, { useState } from 'react';

export interface WizardStep {
  id: string;
  label: string;
  /** Returns either an object mapping field name to error message, or array of error strings. Empty or null if valid. */
  check?: () => Record<string, string> | string[] | undefined | null;
}

export interface WizardProps {
  steps: WizardStep[];
  currentStepId: string;
  onStepChange: (stepId: string) => void;
  onSaveDraft?: () => void;
  saveDraftLabel?: string;
  onSubmit: () => void;
  submitLabel?: string;
  nextLabel?: string;
  backLabel?: string;
  /** Optional custom jumping logic so each wizard can preserve its specific step accessibility rules */
  canJumpTo?: (targetStepId: string) => boolean;
  /** Called whenever check fails on Next or Submit */
  onError?: (errors: Record<string, string>) => void;
  /** If provided, renders an error summary banner at the top of the step body */
  errorMessage?: string;
  isSubmitting?: boolean;
  isSavingDraft?: boolean;
  layout?: 'page' | 'modal';
  children: React.ReactNode;
  className?: string;
}

export const Wizard: React.FC<WizardProps> = ({
  steps,
  currentStepId,
  onStepChange,
  onSaveDraft,
  saveDraftLabel,
  onSubmit,
  submitLabel,
  nextLabel,
  backLabel,
  canJumpTo,
  onError,
  errorMessage,
  isSubmitting = false,
  isSavingDraft = false,
  layout = 'page',
  children,
  className = '',
}) => {
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

  const currentIndex = Math.max(0, steps.findIndex((s) => s.id === currentStepId));
  const totalSteps = steps.length;
  const progressPercent = totalSteps > 0 ? ((currentIndex + 1) / totalSteps) * 100 : 0;
  const isLastStep = currentIndex === totalSteps - 1;

  const validateCurrentStep = (): boolean => {
    const step = steps[currentIndex];
    if (!step?.check) {
      setLocalErrors({});
      return true;
    }

    const result = step.check();
    if (!result) {
      setLocalErrors({});
      return true;
    }

    let formatted: Record<string, string> = {};
    if (Array.isArray(result)) {
      if (result.length === 0) {
        setLocalErrors({});
        return true;
      }
      result.forEach((err, i) => {
        formatted[`error_${i}`] = err;
      });
    } else {
      formatted = result;
    }

    const hasErrors = Object.keys(formatted).length > 0;
    setLocalErrors(formatted);
    if (hasErrors) {
      onError?.(formatted);
      return false;
    }
    return true;
  };

  const handleStepClick = (targetStepId: string) => {
    if (targetStepId === currentStepId) return;
    const targetIdx = steps.findIndex((s) => s.id === targetStepId);
    if (targetIdx === -1) return;

    if (canJumpTo) {
      if (canJumpTo(targetStepId)) {
        setLocalErrors({});
        onStepChange(targetStepId);
      }
      return;
    }

    // Default step clicking rule when canJumpTo is omitted:
    // Can always return to past steps:
    if (targetIdx < currentIndex) {
      setLocalErrors({});
      onStepChange(targetStepId);
      return;
    }

    // Jumping forward requires checking the current step
    const valid = validateCurrentStep();
    if (valid) {
      onStepChange(targetStepId);
    }
  };

  const handleNext = () => {
    const valid = validateCurrentStep();
    if (!valid) return;

    if (currentIndex < totalSteps - 1) {
      onStepChange(steps[currentIndex + 1].id);
    }
  };

  const handleSubmit = () => {
    const valid = validateCurrentStep();
    if (!valid) return;

    onSubmit();
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setLocalErrors({});
      onStepChange(steps[currentIndex - 1].id);
    }
  };

  const activeErrorMessage =
    errorMessage || (Object.keys(localErrors).length > 0 ? Object.values(localErrors)[0] : null);

  const isModal = layout === 'modal';

  return (
    <div
      className={`map-wizard-shell d-flex flex-column gap-3 ${className}`.trim()}
      data-testid="wizard-shell"
      data-layout={layout}
    >
      {/* Numbered Stepper */}
      <div
        className={
          isModal
            ? 'bg-light border-bottom px-3 py-2.5 rounded-top-2'
            : 'card border shadow-sm rounded-3 bg-white overflow-hidden'
        }
      >
        <div className={isModal ? '' : 'bg-light px-4 py-3 border-bottom'}>
          <div
            className="d-flex align-items-center justify-content-between flex-nowrap overflow-x-auto text-nowrap gap-2"
            role="tablist"
            aria-label="Wizard Steps"
          >
            {steps.map((step, idx) => {
              const stepNum = idx + 1;
              const isCurrent = step.id === currentStepId;
              const isPast = idx < currentIndex;
              const isClickable = canJumpTo ? canJumpTo(step.id) : isPast || isCurrent;

              return (
                <button
                  key={step.id}
                  type="button"
                  className={`btn btn-link p-0 text-decoration-none d-inline-flex align-items-center gap-2 text-nowrap ${
                    isCurrent ? 'text-primary fw-bold' : isPast ? 'text-dark fw-semibold' : 'text-muted'
                  }`}
                  style={{
                    fontSize: '0.8125rem',
                    cursor: isClickable ? 'pointer' : 'default',
                  }}
                  disabled={!isClickable && !isCurrent}
                  onClick={() => handleStepClick(step.id)}
                  data-testid={`wizard-step-${step.id}`}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  <span
                    className={`d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0 ${
                      isCurrent
                        ? 'bg-primary text-white shadow-2xs'
                        : isPast
                        ? 'bg-success text-white'
                        : 'bg-white text-secondary border'
                    }`}
                    style={{ width: '22px', height: '22px', fontSize: '0.725rem', fontWeight: 700 }}
                  >
                    {stepNum}
                  </span>
                  <span>{step.label}</span>
                  {idx < steps.length - 1 && (
                    <span
                      className="text-secondary-subtle opacity-50 ms-1 select-none"
                      style={{ fontSize: '0.75rem' }}
                      aria-hidden="true"
                    >
                      &rsaquo;
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="progress mt-2.5" style={{ height: '4px' }}>
            <div
              className="progress-bar bg-primary"
              role="progressbar"
              style={{ width: `${progressPercent}%`, transition: 'width 0.3s ease' }}
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      </div>

      {/* Main Step Body */}
      <div className={isModal ? 'p-2 flex-grow-1' : 'card border shadow-sm rounded-3 bg-white p-4 flex-grow-1'}>
        {activeErrorMessage && (
          <div className="alert alert-danger py-2 px-3 small mb-3" role="alert" data-testid="wizard-error-message">
            {activeErrorMessage}
          </div>
        )}
        {children}
      </div>

      {/* Footer Navigation Bar */}
      <div
        className={
          isModal
            ? 'd-flex align-items-center justify-content-between pt-2 border-top'
            : 'card border shadow-sm rounded-3 bg-white p-3 d-flex flex-row align-items-center justify-content-between'
        }
      >
        <div>
          {currentIndex > 0 && (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={handleBack}
              disabled={isSubmitting}
              data-testid="wizard-back"
            >
              {backLabel || 'Back'}
            </button>
          )}
        </div>

        <div className="d-flex align-items-center gap-2">
          {onSaveDraft && (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={onSaveDraft}
              disabled={isSavingDraft || isSubmitting}
              data-testid="wizard-save-draft"
            >
              {isSavingDraft ? 'Saving...' : saveDraftLabel || 'Save Draft'}
            </button>
          )}

          {!isLastStep ? (
            <button
              type="button"
              className="btn btn-sm btn-primary fw-semibold"
              onClick={handleNext}
              disabled={isSubmitting}
              data-testid="wizard-next"
            >
              {nextLabel || 'Next'}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-sm btn-primary fw-semibold"
              onClick={handleSubmit}
              disabled={isSubmitting}
              data-testid="wizard-submit"
            >
              {isSubmitting ? 'Submitting...' : submitLabel || 'Submit'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
