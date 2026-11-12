import React from 'react';
import type { UserProfile } from '../../types/user';

interface ExistingPersonMembershipNoticeProps {
  person: Pick<UserProfile, 'name' | 'organization'>;
  organization: string;
  onConfirm: () => void;
}

/** Shown when the email entered belongs to a person in another organization: offers to add them here as a member. */
export const ExistingPersonMembershipNotice: React.FC<ExistingPersonMembershipNoticeProps> = ({
  person,
  organization,
  onConfirm,
}) => (
  <div className="alert alert-info py-2 small mb-0" role="status" data-testid="existing-person-membership">
    <div className="mb-2">
      <strong>{person.name}</strong> already works for {person.organization}. Add them as a member of{' '}
      <strong>{organization}</strong> with the roles chosen here? Their work for {person.organization} stays separate.
    </div>
    <button type="button" className="btn btn-sm btn-primary" onClick={onConfirm}>
      Add as member
    </button>
  </div>
);
