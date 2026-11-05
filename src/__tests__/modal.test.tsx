import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal, ModalSize, MODAL_SIZE_WIDTHS } from '../components/modals/Modal';

describe('Modal component', () => {
  it('renders with title, meta line, footer, and aria-labelledby matching heading id', () => {
    const handleClose = vi.fn();
    render(
      <Modal
        title="Confirm Operation"
        meta="Operation ID: OP-1049"
        onClose={handleClose}
        footer={<button type="button">Confirm</button>}
      >
        <p>Modal body content</p>
      </Modal>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    const titleId = dialog.getAttribute('aria-labelledby');
    expect(titleId).toBeTruthy();

    const heading = screen.getByRole('heading', { level: 2, name: 'Confirm Operation' });
    expect(heading).toHaveAttribute('id', titleId!);

    expect(screen.getByText('Operation ID: OP-1049')).toBeInTheDocument();
    expect(screen.getByText('Modal body content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  });

  it.each(['sm', 'md', 'lg', 'xl'] as ModalSize[])('renders expected width for size %s', (size) => {
    const { unmount } = render(
      <Modal title={`Modal ${size}`} size={size} onClose={vi.fn()}>
        Content
      </Modal>
    );

    const dialog = screen.getByRole('dialog');
    const expectedWidth = MODAL_SIZE_WIDTHS[size];
    expect(dialog).toHaveStyle({ width: `min(92vw, ${expectedWidth}px)` });
    expect(dialog).toHaveAttribute('data-size', size);
    unmount();
  });

  it('closes on Escape when dismissible, and ignores Escape when dismissible is false', () => {
    const handleClose = vi.fn();
    const { rerender } = render(
      <Modal title="Dismissible Modal" onClose={handleClose} dismissible={true}>
        Body
      </Modal>
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);

    handleClose.mockClear();

    rerender(
      <Modal title="Non-dismissible Modal" onClose={handleClose} dismissible={false}>
        Body
      </Modal>
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('closes on backdrop click when dismissible, and ignores click when dismissible is false', () => {
    const handleClose = vi.fn();
    const { rerender } = render(
      <Modal title="Dismissible Modal" onClose={handleClose} dismissible={true}>
        Body
      </Modal>
    );

    const backdrop = screen.getByTestId('modal-backdrop');
    fireEvent.click(backdrop);
    expect(handleClose).toHaveBeenCalledTimes(1);

    handleClose.mockClear();

    rerender(
      <Modal title="Non-dismissible Modal" onClose={handleClose} dismissible={false}>
        Body
      </Modal>
    );

    fireEvent.click(screen.getByTestId('modal-backdrop'));
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('returns focus to opener element when modal closes', () => {
    const TestOpenerWrapper = () => {
      const [isOpen, setIsOpen] = useState(false);
      return (
        <div>
          <button
            type="button"
            id="open-modal-btn"
            onClick={() => setIsOpen(true)}
          >
            Open Modal
          </button>
          {isOpen && (
            <Modal title="Test Modal" onClose={() => setIsOpen(false)}>
              <button type="button" id="inside-btn">Inside</button>
            </Modal>
          )}
        </div>
      );
    };

    render(<TestOpenerWrapper />);

    const openBtn = screen.getByRole('button', { name: 'Open Modal' });
    openBtn.focus();
    expect(document.activeElement).toBe(openBtn);

    fireEvent.click(openBtn);

    // Modal is open, focus has entered modal
    const closeBtn = screen.getByRole('button', { name: 'Close' });
    expect(document.activeElement).toBe(closeBtn);

    // Close modal via Close button
    fireEvent.click(closeBtn);

    // Modal unmounts and focus returns to opener
    expect(document.activeElement).toBe(openBtn);
  });
});
