import React, { useMemo } from 'react';
import type { UserProfile } from '../../types/user';

interface RequestRecipientSelectProps {
  recipients: UserProfile[];
  value: string;
  onChange: (userId: string) => void;
  onEditOrganizations?: () => void;
  canEditOrganizations?: boolean;
}

/** Required recipient field of an assurance set request: Administrators and Submitters grouped by organization. */
export const RequestRecipientSelect: React.FC<RequestRecipientSelectProps> = ({
  recipients,
  value,
  onChange,
  onEditOrganizations,
  canEditOrganizations,
}) => {
  const groupedRecipients = useMemo(() => {
    const map = new Map<string, UserProfile[]>();
    for (const r of recipients) {
      const org = r.organization?.trim() || 'Other';
      if (!map.has(org)) {
        map.set(org, []);
      }
      map.get(org)!.push(r);
    }
    return Array.from(map.entries());
  }, [recipients]);

  return (
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
        {groupedRecipients.map(([org, orgRecipients]) => (
          <optgroup key={org} label={org}>
            {orgRecipients.map((u) => {
              const isAdmin = u.roles.includes('Administrator');
              const roleTag = isAdmin
                ? 'Administrator · Requesting party'
                : 'Submitter · Responding party';
              return (
                <option key={u.id} value={u.id}>
                  {u.name} — {u.organization} — {roleTag}
                </option>
              );
            })}
          </optgroup>
        ))}
      </select>
      {recipients.length === 0 && (
        <div className="text-muted small mt-1">No submitters in this project's other parties.</div>
      )}
    </div>
  );
};
