import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Wizard, WizardStep } from '../components/wizards/Wizard';
import { Wizard as CommonWizard } from '../components/common/Wizard';

describe('Wizard component', () => {
  it('re-exports cleanly from common/Wizard', () => {
    expect(Wizard).toBe(CommonWizard);
  });

  const SampleWizardHarness = ({
    initialStep = 'step-details',
    step1Valid = false,
    step2Valid = true,
    step3Valid = true,
    canJumpTo,
    onSubmit = vi.fn(),
    onSaveDraft,
    onError = vi.fn(),
  }: {
    initialStep?: string;
    step1Valid?: boolean;
    step2Valid?: boolean;
    step3Valid?: boolean;
    canJumpTo?: (target: string) => boolean;
    onSubmit?: () => void;
    onSaveDraft?: () => void;
    onError?: (errors: Record<string, string>) => void;
  }) => {
    const [currentStep, setCurrentStep] = useState(initialStep);

    const steps: WizardStep[] = [
      {
        id: 'step-details',
        label: 'Project Details',
        check: () => (step1Valid ? null : { projectName: 'Project name is required' }),
      },
      {
        id: 'step-options',
        label: 'Configuration Options',
        check: () => (step2Valid ? null : ['Option selection is required']),
      },
      {
        id: 'step-review',
        label: 'Review & Submit',
        check: () => (step3Valid ? null : { terms: 'Terms must be accepted' }),
      },
    ];

    return (
      <Wizard
        steps={steps}
        currentStepId={currentStep}
        onStepChange={setCurrentStep}
        onSubmit={onSubmit}
        onSaveDraft={onSaveDraft}
        canJumpTo={canJumpTo}
        onError={onError}
        showErrorSummary={true}
      >
        <div data-testid="wizard-body">
          Current step body: {currentStep}
        </div>
      </Wizard>
    );
  };

  it('renders all three step headers with numbered badges and progress bar', () => {
    render(<SampleWizardHarness step1Valid={true} />);

    expect(screen.getByTestId('wizard-step-step-details')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-step-step-options')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-step-step-review')).toBeInTheDocument();

    expect(screen.getByText('Project Details')).toBeInTheDocument();
    expect(screen.getByText('Configuration Options')).toBeInTheDocument();
    expect(screen.getByText('Review & Submit')).toBeInTheDocument();

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
  });

  it('blocks Next when check returns field errors and invokes onError', () => {
    const handleError = vi.fn();
    render(<SampleWizardHarness step1Valid={false} onError={handleError} />);

    expect(screen.getByTestId('wizard-body')).toHaveTextContent('step-details');

    const nextBtn = screen.getByTestId('wizard-next');
    fireEvent.click(nextBtn);

    // Stays on step-details because validation failed
    expect(screen.getByTestId('wizard-body')).toHaveTextContent('step-details');
    expect(handleError).toHaveBeenCalledWith({ projectName: 'Project name is required' });
    expect(screen.getByTestId('wizard-error-message')).toHaveTextContent('Project name is required');
  });

  it('advances to next step and allows Back navigation when validation passes', () => {
    render(<SampleWizardHarness step1Valid={true} />);

    // Step 1: Next button visible, Back button not present on first step
    expect(screen.queryByTestId('wizard-back')).not.toBeInTheDocument();
    const nextBtn = screen.getByTestId('wizard-next');
    fireEvent.click(nextBtn);

    // Advanced to Step 2
    expect(screen.getByTestId('wizard-body')).toHaveTextContent('step-options');

    // Back button is now present
    const backBtn = screen.getByTestId('wizard-back');
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);

    // Returned to Step 1
    expect(screen.getByTestId('wizard-body')).toHaveTextContent('step-details');
  });

  it('obeys custom canJumpTo rules when clicking step buttons', () => {
    // Only allow jumping if target is not step-review
    const canJumpToMock = vi.fn((target: string) => target === 'step-details' || target === 'step-options');

    render(<SampleWizardHarness initialStep="step-details" canJumpTo={canJumpToMock} />);

    // Click step-review button (should be blocked)
    const reviewStepBtn = screen.getByTestId('wizard-step-step-review');
    fireEvent.click(reviewStepBtn);
    expect(screen.getByTestId('wizard-body')).toHaveTextContent('step-details');

    // Click step-options button (allowed by canJumpTo)
    const optionsStepBtn = screen.getByTestId('wizard-step-step-options');
    fireEvent.click(optionsStepBtn);
    expect(screen.getByTestId('wizard-body')).toHaveTextContent('step-options');
  });

  it('renders Submit on the final step and triggers onSubmit when valid', () => {
    const handleSubmit = vi.fn();
    render(
      <SampleWizardHarness
        initialStep="step-review"
        step3Valid={true}
        onSubmit={handleSubmit}
      />
    );

    // Next button replaced by Submit on final step
    expect(screen.queryByTestId('wizard-next')).not.toBeInTheDocument();
    const submitBtn = screen.getByTestId('wizard-submit');
    expect(submitBtn).toBeInTheDocument();

    fireEvent.click(submitBtn);
    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it('handles Save Draft button when onSaveDraft callback is passed', () => {
    const handleSaveDraft = vi.fn();
    render(<SampleWizardHarness onSaveDraft={handleSaveDraft} />);

    const draftBtn = screen.getByTestId('wizard-save-draft');
    expect(draftBtn).toBeInTheDocument();
    fireEvent.click(draftBtn);
    expect(handleSaveDraft).toHaveBeenCalledTimes(1);
  });
});
