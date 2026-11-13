import React, { useMemo } from 'react';
import type { UserProfile } from '../../types/user';

interface RequestRecipientSelectProps {
  recipients: UserProfile[];
  value: string;
  onChange: (userId: string) => void;
  onEditOrganizations?: () => void;
  canEditOrganizations?: boolean;
}

/** Required recipient field of an assurance set request: active Client Admins of the project's other organizations, grouped by organization. */
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
      <label className="form-label small fw-semibold mb-1" htmlFor="request-recipient">
        Recipient <span className="text-danger">*</span>
      </label>
      <select
        id="request-recipient"
        className="form-select form-select-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid="select-request-recipient"
      >
        <option value="">Select a client admin</option>
        {groupedRecipients.map(([org, orgRecipients]) => (
          <optgroup key={org} label={org}>
            {orgRecipients.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {recipients.length === 0 && (
        <div className="text-muted small mt-1">No client admins in this project's other organizations.</div>
      )}
      {canEditOrganizations && onEditOrganizations && (
        <div className="text-muted small mt-1">
          Don't see the organization?{' '}
          <button
            type="button"
            className="btn btn-link btn-sm p-0 text-decoration-none small align-baseline"
            onClick={onEditOrganizations}
            data-testid="btn-edit-participating-orgs-from-modal"
          >
            Edit participating organizations
          </button>
        </div>
      )}
    </div>
  );
};
