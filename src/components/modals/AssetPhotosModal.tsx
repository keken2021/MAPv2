import React from 'react';
import { X } from 'lucide-react';

interface AssetPhotosModalProps {
  isOpen: boolean;
  onClose: () => void;
  view: 'manage' | 'add';
  title: string;
  subtitle: React.ReactNode;
  icon: React.ReactNode;
  headerVariant?: 'light' | 'dark';
  footer?: React.ReactNode;
  scrollable?: boolean;
  zIndex?: number;
  children: React.ReactNode;
}

export const AssetPhotosModal: React.FC<AssetPhotosModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  headerVariant = 'light',
  footer,
  scrollable = false,
  zIndex = 1060,
  children,
}) => {
  if (!isOpen) return null;

  const isDark = headerVariant === 'dark';

  return (
    <div
      className="modal show d-block map-modal-backdrop"
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      style={{ zIndex }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`modal-dialog modal-lg modal-dialog-centered${scrollable ? ' modal-dialog-scrollable' : ''}`}>
        <div className={`modal-content border shadow-lg${isDark ? ' overflow-hidden' : ' bg-white text-dark'}`}>
          <div
            className={`modal-header d-flex align-items-center justify-content-between p-3${isDark ? ' border-0' : ' border-bottom bg-light'}`}
            style={isDark ? { backgroundColor: '#0B1B2B', color: '#FFFFFF' } : undefined}
          >
            <div className="d-flex align-items-center gap-2">
              <div className="p-2 bg-primary-subtle text-primary rounded-3">
                {icon}
              </div>
              <div>
                <h5
                  className={`modal-title fw-bold m-0${isDark ? ' text-white' : ' text-dark'}`}
                  style={{ fontSize: '1.05rem' }}
                >
                  {title}
                </h5>
                <div
                  className={`small font-mono-code${isDark ? '' : ' text-secondary'}`}
                  style={isDark ? { color: '#94A3B8' } : undefined}
                >
                  {subtitle}
                </div>
              </div>
            </div>
            {isDark ? (
              <button
                type="button"
                className="btn btn-sm text-white p-2 border-0 bg-transparent opacity-75 hover-opacity-100"
                onClick={onClose}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            ) : (
              <button
                type="button"
                className="btn-close"
                onClick={onClose}
                aria-label="Close"
              />
            )}
          </div>

          <div
            className="modal-body p-4"
            style={isDark ? { backgroundColor: '#F8FAFC' } : undefined}
          >
            {children}
          </div>

          {footer && (
            <div className="modal-footer border-top bg-light d-flex justify-content-end p-3">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
