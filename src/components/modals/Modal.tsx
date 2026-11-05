import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useOverlayBehavior } from '../../utils/useOverlayBehavior';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export const MODAL_SIZE_WIDTHS: Record<ModalSize, number> = {
  sm: 480,
  md: 640,
  lg: 880,
  xl: 1140,
};

export interface ModalProps {
  isOpen?: boolean;
  onClose: () => void;
  title: React.ReactNode;
  /** optional 12px meta line under title */
  meta?: React.ReactNode;
  /** optional content at right of header, before close button */
  headerAside?: React.ReactNode;
  /** sm 480px, md 640px, lg 880px, xl 1140px */
  size?: ModalSize;
  /** whether clicking backdrop or pressing Escape closes the modal; default true */
  dismissible?: boolean;
  /** optional footer: Cancel left, primary right */
  footer?: React.ReactNode;
  /** element that takes focus when modal opens */
  initialFocusRef?: React.RefObject<HTMLElement>;
  /** true while another overlay opened from this modal covers it */
  paused?: boolean;
  /** custom z-index base (default 1060 for dialog, 1055 for backdrop) */
  zIndex?: number;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen = true,
  onClose,
  title,
  meta,
  headerAside,
  size = 'md',
  dismissible = true,
  footer,
  initialFocusRef,
  paused = false,
  zIndex = 1060,
  className = '',
  bodyClassName = '',
  children,
}) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useOverlayBehavior(panelRef, dismissible ? onClose : () => {}, {
    active: isOpen,
    paused,
    initialFocusRef: initialFocusRef ?? closeButtonRef,
  });

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const backdropZIndex = zIndex - 5;
  const modalZIndex = zIndex;

  const width = MODAL_SIZE_WIDTHS[size] ?? 640;

  return createPortal(
    <>
      <div
        className="map-modal-backdrop"
        style={{ zIndex: backdropZIndex }}
        onClick={() => {
          if (dismissible) onClose();
        }}
        data-testid="modal-backdrop"
      />
      <div
        className="map-modal-container position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
        style={{ zIndex: modalZIndex, pointerEvents: 'none' }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          data-testid="modal-panel"
          data-size={size}
          className={`map-modal-dialog bg-white shadow-lg border rounded-3 d-flex flex-column ${className}`.trim()}
          style={{
            width: `min(92vw, ${width}px)`,
            maxWidth: '100%',
            maxHeight: '90vh',
            pointerEvents: 'auto',
          }}
        >
          {/* Header: white with bottom border, padding 16px 24px */}
          <div className="d-flex align-items-center justify-content-between bg-white border-bottom px-4 py-3 rounded-top-3 flex-shrink-0">
            <div className="d-flex flex-column gap-0.5 min-w-0 pe-2">
              <h2 id={titleId} className="fs-6 fw-semibold text-dark m-0 text-truncate">
                {title}
              </h2>
              {meta && (
                <div className="text-secondary" style={{ fontSize: '12px' }}>
                  {meta}
                </div>
              )}
            </div>
            <div className="d-flex align-items-center gap-2 flex-shrink-0">
              {headerAside}
              <button
                ref={closeButtonRef}
                type="button"
                className="btn btn-sm btn-link text-secondary p-0 d-inline-flex align-items-center justify-content-center rounded-2"
                style={{ width: '32px', height: '32px', textDecoration: 'none' }}
                onClick={onClose}
                aria-label="Close"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Body: scrolling, padding 24px */}
          <div
            className={`p-4 overflow-y-auto bg-white flex-grow-1 ${bodyClassName}`.trim()}
            style={{ maxHeight: 'calc(90vh - 120px)' }}
          >
            {children}
          </div>

          {/* Footer: optional, white with top border, padding 12px 24px */}
          {footer && (
            <div className="d-flex align-items-center justify-content-between bg-white border-top px-4 py-3 rounded-bottom-3 flex-shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
};
