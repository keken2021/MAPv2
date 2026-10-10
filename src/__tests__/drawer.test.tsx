/*
  file summary: tests for the shared drawer shell.
  responsibilities: checks the dialog role and label, closing on escape and on a backdrop click, focus moving in and back out, the optional footer, and that only the top layer answers escape.
  role in system: guards Drawer.tsx in src/components/drawers and useOverlayBehavior.ts in src/utils.
*/

import React, { useState } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Drawer } from '../components/drawers/Drawer';

afterEach(cleanup);

const Harness: React.FC<{ onClose?: () => void; footer?: React.ReactNode; paused?: boolean }> = ({
  onClose,
  footer,
  paused,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open
      </button>
      {isOpen && (
        <Drawer
          title="Audit Trail"
          meta="12 events"
          footer={footer}
          paused={paused}
          onClose={() => {
            onClose?.();
            setIsOpen(false);
          }}
        >
          <input aria-label="Search" />
        </Drawer>
      )}
    </>
  );
};

const openDrawer = () => {
  const opener = screen.getByRole('button', { name: 'Open' });
  opener.focus();
  fireEvent.click(opener);
  return opener;
};

describe('Drawer shell', () => {
  it('is a labelled modal dialog', () => {
    render(<Harness />);
    openDrawer();
    const dialog = screen.getByRole('dialog', { name: 'Audit Trail' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveClass('map-drawer', 'map-drawer-sm');
    expect(screen.getByText('12 events')).toBeInTheDocument();
  });

  it('closes on escape', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    openDrawer();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on a backdrop click and on the close button', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    openDrawer();
    fireEvent.click(screen.getByTestId('drawer-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);

    openDrawer();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('moves focus to the close button and returns it to the opener', () => {
    render(<Harness />);
    const opener = openDrawer();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(opener).toHaveFocus();
  });

  it('keeps tab inside the drawer', () => {
    render(<Harness />);
    openDrawer();
    const closeButton = screen.getByRole('button', { name: 'Close' });
    const search = screen.getByLabelText('Search');

    search.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(search).toHaveFocus();
  });

  it('renders the footer only when one is given', () => {
    const { unmount } = render(<Harness />);
    openDrawer();
    expect(document.querySelector('.map-drawer-footer')).toBeNull();
    unmount();

    render(<Harness footer={<button type="button">Save</button>} />);
    openDrawer();
    expect(screen.getByRole('button', { name: 'Save' }).closest('.map-drawer-footer')).not.toBeNull();
  });

  it('leaves escape to a modal that covers it', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} paused />);
    openDrawer();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes only the top drawer when two are open', () => {
    const onCloseFirst = vi.fn();
    const onCloseSecond = vi.fn();
    render(
      <>
        <Drawer title="Returned Documents" onClose={onCloseFirst}>
          first
        </Drawer>
        <Drawer title="Document Review" size="xl" onClose={onCloseSecond}>
          second
        </Drawer>
      </>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCloseSecond).toHaveBeenCalledTimes(1);
    expect(onCloseFirst).not.toHaveBeenCalled();
  });
});
