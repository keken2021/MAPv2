import React from 'react';
import type { UserProfile } from '../../types/user';
import { getRequestDirection } from '../../utils/assuranceRequestHelpers';

interface RequestPartiesBannerProps {
  senderOrganization: string;
  recipient?: UserProfile;
}

/**
 * Directional party banner for the Request Assurance Set modal.
 * Before a recipient pick, displays only the sender's organization.
 * Once a recipient is chosen, indicates the Requesting party and Responding party,
 * dynamically flipping when an Administrator recipient is selected.
 */
export const RequestPartiesBanner: React.FC<RequestPartiesBannerProps> = ({
  senderOrganization,
  recipient,
}) => {
  if (!recipient) {
    return (
      <div className="mb-3 p-2 bg-light rounded border small" data-testid="requesting-party-banner">
        <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Your organization</div>
        <div className="fw-semibold text-dark">{senderOrganization}</div>
      </div>
    );
  }

  const { requestingParty, respondingParty } = getRequestDirection(
    senderOrganization,
    recipient,
  );

  return (
    <div className="mb-3 p-2 bg-light rounded border small" data-testid="requesting-party-banner">
      <div className="d-flex align-items-center flex-wrap gap-2">
        <div>
          <span className="text-secondary">Requesting party: </span>
          <span className="fw-semibold text-dark">{requestingParty}</span>
        </div>
        <span className="text-muted">→</span>
        <div>
          <span className="text-secondary">Responding party: </span>
          <span className="fw-semibold text-dark">{respondingParty}</span>
        </div>
      </div>
    </div>
  );
};
