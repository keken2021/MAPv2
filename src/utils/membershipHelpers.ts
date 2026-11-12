import type { UserProfile } from '../types/user';
import { sameOrganization } from './organizationMatch';

export type EmailMembershipCheck =
  | { kind: 'free' }
  | { kind: 'same-organization'; user: UserProfile }
  | { kind: 'other-organization'; person: UserProfile };

/**
 * What an email means for a user record in `organization` (ADR 0037). An email already used in this
 * organization is taken. An email used only in other organizations belongs to a person who can be
 * added here as a member. Records of the edited person are ignored.
 */
export function checkEmailForMembership(
  users: UserProfile[],
  email: string,
  organization: string,
  editing?: Pick<UserProfile, 'id' | 'personId'> | null,
): EmailMembershipCheck {
  const wanted = email.trim().toLowerCase();
  const sameEmail = users.filter(
    (u) =>
      u.email.trim().toLowerCase() === wanted &&
      u.id !== editing?.id &&
      !(editing?.personId && u.personId === editing.personId),
  );
  const inThisOrganization = sameEmail.find((u) => sameOrganization(u.organization, organization));
  if (inThisOrganization) return { kind: 'same-organization', user: inThisOrganization };
  return sameEmail[0] ? { kind: 'other-organization', person: sameEmail[0] } : { kind: 'free' };
}

/** The person id to share between an existing record and a new membership; reuses the existing one. */
export function personIdFor(person: Pick<UserProfile, 'id' | 'personId'>): string {
  return person.personId || `PER-${person.id}`;
}
