import React from 'react';
import { LucideIcon, Inbox } from 'lucide-react';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  className?: string;
}

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div
      className={`d-flex flex-column align-items-center justify-content-center text-center py-4 px-3 ${className}`}
      data-testid="empty-state"
    >
      <Icon
        size={32}
        className="text-secondary mb-2"
        style={{ color: '#64748b' }}
        aria-hidden="true"
        data-testid="empty-state-icon"
      />
      <div className="fw-semibold text-dark mb-1">{title}</div>
      {description && <div className="text-muted small mb-0">{description}</div>}
      {action && (
        <button
          type="button"
          className={action.className || 'btn btn-sm btn-outline-primary mt-2'}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
