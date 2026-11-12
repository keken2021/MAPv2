import React from 'react';
import type { UserProfile } from '../../types/user';

interface RequestRecipientSelectProps {
  recipients: UserProfile[];
  value: string;
  onChange: (userId: string) => void;
  onEditOrganizations?: () => void;
  canEditOrganizations?: boolean;
}

/** Required recipient field of an assurance set request: Submitters (or Administrators if none) of the project's other parties. */
export const RequestRecipientSelect: React.FC<RequestRecipientSelectProps> = ({
  recipients,
  value,
  onChange,
  onEditOrganizations,
  canEditOrganizations,
}) => (
  <div className="mb-3">
    <div className="d-flex align-items-center justify-content-between mb-1">
      <label className="form-label small fw-semibold mb-0" htmlFor="request-recipient">
        Recipient <span className="text-danger">*</span>
      </label>
      {canEditOrganizations && onEditOrganizations && (
        <button
          type="button"
          className="btn btn-link btn-sm p-0 text-decoration-none small"
          onClick={onEditOrganizations}
          data-testid="btn-edit-participating-orgs-from-modal"
        >
          Edit participating organizations
        </button>
      )}
    </div>
    <select
      id="request-recipient"
      className="form-select form-select-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-testid="select-request-recipient"
    >
      <option value="">Select recipient</option>
      {recipients.map((u) => {
        const roleLabel = u.roles.includes('Submitter') ? 'Submitter' : 'Administrator';
        return (
          <option key={u.id} value={u.id}>
            {u.name} — {u.organization} — {roleLabel}
          </option>
        );
      })}
    </select>
    {recipients.length === 0 && (
      <div className="text-muted small mt-1">No submitters in this project's other parties.</div>
    )}
  </div>
);
