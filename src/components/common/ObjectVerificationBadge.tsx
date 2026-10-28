/*
  file summary: status badge for an assurance object's verification.
  responsibilities: shows one of the four statuses, whether the check reads as internal or external, and who verified it and when.
  role in system: used by the object list, the verifier queue and the approver screen.
*/

import React from 'react';
import { ObjectVerification } from '../../types/assurance';
import { formatMaritimeDateTime } from '../../utils/formatters';

export const ObjectVerificationBadge: React.FC<{ verification: ObjectVerification | null }> = ({ verification }) => {
  if (!verification) return null;
  const tone =
    verification.status === 'Tested externally'
      ? 'bg-primary'
      : verification.status === 'Submitted and tested'
        ? 'bg-info text-dark'
        : verification.status === 'Used and tested by several entities over time'
          ? 'bg-dark'
          : 'bg-secondary';
  const channel =
    verification.channel === 'internal' ? 'Internal' : verification.channel === 'external' ? 'External' : null;
  const when = verification.verifiedAt ? formatMaritimeDateTime(verification.verifiedAt) : '';
  return (
    <div className="mt-1">
      <span className={`badge ${tone}`}>{verification.status}</span>
      {(channel || verification.verifiedBy || when) && (
        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
          {[channel, verification.verifiedBy, when].filter(Boolean).join(' · ')}
        </div>
      )}
    </div>
  );
};
