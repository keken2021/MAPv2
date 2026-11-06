import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssetPhotosModal } from '../components/modals/AssetPhotosModal';
import { Camera } from 'lucide-react';

describe('AssetPhotosModal', () => {
  const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    view: 'manage' as const,
    title: 'Manage Photos',
    subtitle: 'Test Asset · Category',
    icon: <Camera size={18} />,
    children: <div data-testid="modal-body-content">body</div>,
  };

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<AssetPhotosModal {...baseProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders title and subtitle in light variant', () => {
    render(<AssetPhotosModal {...baseProps} />);
    expect(screen.getByText('Manage Photos')).toBeTruthy();
    expect(screen.getByText('Test Asset · Category')).toBeTruthy();
  });

  it('renders children in the modal body', () => {
    render(<AssetPhotosModal {...baseProps} />);
    expect(screen.getByTestId('modal-body-content')).toBeTruthy();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<AssetPhotosModal {...baseProps} onClose={onClose} />);
    const backdrop = document.querySelector('.modal.show');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders btn-close in light variant', () => {
    render(<AssetPhotosModal {...baseProps} headerVariant="light" />);
    expect(document.querySelector('.btn-close')).toBeTruthy();
  });

  it('renders X icon button (not btn-close) in dark variant', () => {
    render(<AssetPhotosModal {...baseProps} headerVariant="dark" />);
    expect(document.querySelector('.btn-close')).toBeNull();
    expect(screen.getByLabelText('Close')).toBeTruthy();
  });

  it('applies dark header background in dark variant', () => {
    render(<AssetPhotosModal {...baseProps} headerVariant="dark" />);
    const header = document.querySelector('.modal-header') as HTMLElement;
    expect(header?.style.backgroundColor).toBe('rgb(11, 27, 43)');
  });

  it('renders footer when footer prop is provided', () => {
    render(
      <AssetPhotosModal {...baseProps} footer={<button>Save</button>} />,
    );
    expect(screen.getByText('Save')).toBeTruthy();
    expect(document.querySelector('.modal-footer')).toBeTruthy();
  });

  it('does not render footer section when footer prop is omitted', () => {
    render(<AssetPhotosModal {...baseProps} />);
    expect(document.querySelector('.modal-footer')).toBeNull();
  });

  it('adds modal-dialog-scrollable class when scrollable is true', () => {
    render(<AssetPhotosModal {...baseProps} scrollable />);
    expect(document.querySelector('.modal-dialog-scrollable')).toBeTruthy();
  });

  it('does not add modal-dialog-scrollable when scrollable is false', () => {
    render(<AssetPhotosModal {...baseProps} scrollable={false} />);
    expect(document.querySelector('.modal-dialog-scrollable')).toBeNull();
  });

  it('applies custom zIndex', () => {
    render(<AssetPhotosModal {...baseProps} zIndex={1065} />);
    const modal = document.querySelector('.modal.show') as HTMLElement;
    expect(modal?.style.zIndex).toBe('1065');
  });
});
