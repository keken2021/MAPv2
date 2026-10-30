/*
  file summary: status badge for an assurance object's verification.
  responsibilities: shows one of the four statuses, whether the check reads as internal or external, and who verified it and when.
  role in system: used by the object list, the verifier queue and the approver screen.
*/

import React from 'react';
import { ObjectVerification, ObjectVerificationStatus } from '../../types/assurance';
import { formatMaritimeDateTime } from '../../utils/formatters';
import { getStatusTone, StatusBadge } from './StatusBadge';

const VERIFICATION_SHORT_LABEL: Record<ObjectVerificationStatus, string> = {
  'Uploaded, not externally verified': 'Uploaded',
  'Submitted and tested': 'Submitted',
  'Tested externally': 'External',
  'Used and tested by several entities over time': 'Proven',
};

export const ObjectVerificationBadge: React.FC<{ verification: ObjectVerification | null }> = ({ verification }) => {
  if (!verification) return null;
  const channel =
    verification.channel === 'internal' ? 'Internal' : verification.channel === 'external' ? 'External' : null;
  const when = verification.verifiedAt ? formatMaritimeDateTime(verification.verifiedAt) : '';
  return (
    <div className="mt-1">
      <span title={verification.status} className="d-inline-flex">
        <StatusBadge value={VERIFICATION_SHORT_LABEL[verification.status]} tone={getStatusTone(verification.status)} />
      </span>
      {(channel || verification.verifiedBy || when) && (
        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
          {[channel, verification.verifiedBy, when].filter(Boolean).join(' · ')}
        </div>
      )}
    </div>
  );
};
