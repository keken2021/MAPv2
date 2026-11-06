import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CameraCaptureModal } from '../components/modals/CameraCaptureModal';

vi.mock('../utils/useCamera', () => ({
  useCamera: () => ({
    cameraStream: null,
    capturedPhotoDataUrl: null,
    videoRef: { current: null },
    canvasRef: { current: null },
    startStream: vi.fn().mockResolvedValue(undefined),
    stopStream: vi.fn(),
    takeCameraSnapshot: vi.fn(),
    retake: vi.fn(),
  }),
}));

vi.mock('../utils/useOverlayBehavior', () => ({
  useOverlayBehavior: vi.fn(),
}));

describe('CameraCaptureModal', () => {
  const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    onCapture: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<CameraCaptureModal {...baseProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders Take Photo heading when open', () => {
    render(<CameraCaptureModal {...baseProps} />);
    const headings = screen.getAllByText('Take Photo');
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });

  it('renders Cancel button in live view', () => {
    render(<CameraCaptureModal {...baseProps} />);
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('renders Take Photo button in live view', () => {
    render(<CameraCaptureModal {...baseProps} />);
    const buttons = screen.getAllByText('Take Photo');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('does not render Use Camera button when onUseCameraInput is not provided', () => {
    render(<CameraCaptureModal {...baseProps} />);
    expect(screen.queryByText('Use Camera')).toBeNull();
  });

  it('renders Use Camera button when onUseCameraInput is provided', () => {
    render(<CameraCaptureModal {...baseProps} onUseCameraInput={vi.fn()} />);
    expect(screen.getByText('Use Camera')).toBeTruthy();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<CameraCaptureModal {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when X button is clicked', () => {
    const onClose = vi.fn();
    render(<CameraCaptureModal {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('applies custom zIndex', () => {
    render(<CameraCaptureModal {...baseProps} zIndex={1070} />);
    const backdrop = document.querySelector('.map-modal-backdrop') as HTMLElement;
    expect(backdrop?.style.zIndex).toBe('1070');
  });

  it('calls onUseCameraInput and onClose when Use Camera is clicked', () => {
    const onClose = vi.fn();
    const onUseCameraInput = vi.fn();
    render(<CameraCaptureModal {...baseProps} onClose={onClose} onUseCameraInput={onUseCameraInput} />);
    fireEvent.click(screen.getByText('Use Camera'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onUseCameraInput).toHaveBeenCalledTimes(1);
  });
});
