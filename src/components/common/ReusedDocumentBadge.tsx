/* 
  file summary: badge component displaying 'Reused from vault' for requirements fulfilled by existing valid documents on file.
  responsibilities: renders a clean semantic badge indicating that an assurance requirement was auto-attached and reused from vault evidence.
  role in system: consumed by AssuranceDetailView requirement rows, task rows, and assurance reviews.
*/

import React from 'react';

export interface ReusedDocumentBadgeProps {
  reusedDocument?: boolean;
  className?: string;
}

export const ReusedDocumentBadge: React.FC<ReusedDocumentBadgeProps> = ({
  reusedDocument = true,
  className = '',
}) => {
  if (!reusedDocument) return null;

  return (
    <span
      className={`badge bg-light text-secondary border font-sans-body d-inline-flex align-items-center ${className}`.trim()}
      style={{ fontSize: '0.7rem', fontWeight: 500 }}
      data-testid="reused-document-badge"
      title="Reused from vault"
    >
      Reused from vault
    </span>
  );
};

export default ReusedDocumentBadge;
