/* Action button to view an attached document. */
import React from 'react';
import { FileText } from 'lucide-react';

export interface ViewDocumentButtonProps {
  onClick: () => void;
  compact?: boolean;
  title?: string;
  className?: string;
}

/**
 * Action button rendering a view document button.
 * Renders a 32px icon-only button when compact, or a labelled button otherwise.
 */
export const ViewDocumentButton: React.FC<ViewDocumentButtonProps> = ({
  onClick,
  compact = false,
  title = 'View document',
  className = '',
}) => {
  if (compact) {
    return (
      <button
        type="button"
        className={`btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0 ${className}`.trim()}
        style={{ width: '32px', height: '32px' }}
        onClick={onClick}
        title={title}
        aria-label="View document"
      >
        <FileText size={16} />
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1.5 px-2.5 py-1 ${className}`.trim()}
      onClick={onClick}
      title={title}
      aria-label="View document"
    >
      <FileText size={14} />
      <span>View document</span>
    </button>
  );
};
