import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from '../components/modals/ConfirmDialog';
import { ConfirmDialog as CommonConfirmDialog } from '../components/common/ConfirmDialog';

describe('ConfirmDialog component', () => {
  it('re-exports cleanly from common/ConfirmDialog', () => {
    expect(ConfirmDialog).toBe(CommonConfirmDialog);
  });

  it('renders default tone with confirm and cancel buttons, calling handlers', () => {
    const handleConfirm = vi.fn();
    const handleCancel = vi.fn();

    render(
      <ConfirmDialog
        title="Archive Inspection"
        message="Are you sure you want to archive this inspection record?"
        confirmLabel="Archive"
        cancelLabel="Keep Record"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Archive Inspection' })).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to archive this inspection record?')).toBeInTheDocument();

    // Default tone: no danger icon, primary button
    expect(screen.queryByTestId('confirm-dialog-danger-icon')).not.toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: 'Archive' });
    expect(confirmBtn).toHaveClass('btn-primary');
    expect(confirmBtn).not.toBeDisabled();

    // Cancel button
    const cancelBtn = screen.getByRole('button', { name: 'Keep Record' });
    expect(cancelBtn).toBeInTheDocument();
    fireEvent.click(cancelBtn);
    expect(handleCancel).toHaveBeenCalledTimes(1);

    // Confirm button
    fireEvent.click(confirmBtn);
    expect(handleConfirm).toHaveBeenCalledWith(undefined);
  });

  it('renders danger tone with danger icon and red confirm button', () => {
    const handleConfirm = vi.fn();
    const handleCancel = vi.fn();

    render(
      <ConfirmDialog
        title="Delete Equipment"
        message="This action is permanent and cannot be undone."
        confirmLabel="Delete permanently"
        tone="danger"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    );

    expect(screen.getByTestId('confirm-dialog-danger-icon')).toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: 'Delete permanently' });
    expect(confirmBtn).toHaveClass('btn-danger');
  });

  it('requires reason when reasonLabel is set and disables confirm until reason is provided', () => {
    const handleConfirm = vi.fn();
    const handleCancel = vi.fn();

    render(
      <ConfirmDialog
        title="Return for Correction"
        message="Specify why this assurance set is being returned."
        reasonLabel="Correction Justification"
        reasonPlaceholder="Enter reason here..."
        tone="danger"
        confirmLabel="Return set"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    );

    const confirmBtn = screen.getByRole('button', { name: 'Return set' });
    // Initially disabled because reason is empty
    expect(confirmBtn).toBeDisabled();

    const textarea = screen.getByTestId('confirm-dialog-reason');
    expect(textarea).toHaveAttribute('placeholder', 'Enter reason here...');
    expect(screen.getByText('Correction Justification')).toBeInTheDocument();

    // Typing whitespace does not enable it
    fireEvent.change(textarea, { target: { value: '    ' } });
    expect(confirmBtn).toBeDisabled();

    // Typing actual text enables it
    fireEvent.change(textarea, { target: { value: 'Documentation missing surveyor stamp' } });
    expect(confirmBtn).not.toBeDisabled();

    // Submitting passes trimmed reason
    fireEvent.click(confirmBtn);
    expect(handleConfirm).toHaveBeenCalledWith('Documentation missing surveyor stamp');
  });

  it('closes via modal close button calling onCancel', () => {
    const handleCancel = vi.fn();

    render(
      <ConfirmDialog
        title="Discard Draft"
        message="Discard unsaved changes?"
        onConfirm={vi.fn()}
        onCancel={handleCancel}
      />
    );

    const closeBtn = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeBtn);
    expect(handleCancel).toHaveBeenCalledTimes(1);
  });

  it('disables buttons when isSubmitting is true', () => {
    render(
      <ConfirmDialog
        title="Saving"
        message="Processing request..."
        confirmLabel="Submit"
        isSubmitting={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByTestId('confirm-dialog-cancel')).toBeDisabled();
    expect(screen.getByTestId('confirm-dialog-confirm')).toBeDisabled();
    expect(screen.getByTestId('confirm-dialog-confirm')).toHaveTextContent('Please wait...');
  });
});

