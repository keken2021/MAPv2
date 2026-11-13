import type { SuggestedAssuranceAsset } from '../types/notification';
import type { Project, ProjectAssetLink } from '../types/project';
import type { UserProfile } from '../types/user';
import { sameOrganization } from './rbacHelpers';
import { syncInvitedOrganizationsToParties } from './projectHelpers';

export type RequestDirection = 'ask' | 'invite';

/** Organizations on the project's Organizations card, other than the sender's, in card order. */
function getOtherPartyOrganizations(
  project: Pick<Project, 'contractParties' | 'invitedOrganizations'>,
  senderOrganization: string,
): string[] {
  const syncedProject = syncInvitedOrganizationsToParties(project as Project);
  const seen = new Set<string>();
  const list: string[] = [];

  const add = (organization: string | undefined) => {
    const trimmed = organization?.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key) || sameOrganization(trimmed, senderOrganization)) return;
    seen.add(key);
    list.push(trimmed);
  };

  for (const party of syncedProject.contractParties ?? []) {
    add(party.organization);
  }

  return list;
}

/**
 * Who can receive an assurance set request on a project:
 * - 'ask' returns active Submitters of the other parties (they build the set, sender reviews).
 * - 'invite' returns active Administrators of the other parties (sender builds the set for them).
 * The sender, the sender's organization and anyone outside the project are left out.
 * A user who holds both roles appears in both lists.
 */
export function getAssuranceSetRequestRecipients(
  users: UserProfile[],
  project: Pick<Project, 'contractParties' | 'invitedOrganizations'>,
  senderOrganization: string,
  senderUserId?: string,
  direction: RequestDirection = 'ask',
): UserProfile[] {
  const matchesRole = (user: UserProfile) =>
    direction === 'invite'
      ? user.roles.includes('Administrator') || user.roles.includes('C Admin')
      : user.roles.includes('Submitter');

  return getOtherPartyOrganizations(project, senderOrganization).flatMap((organization) => {
    const matchingUsers = users.filter(
      (user) =>
        user.status === 'Active' &&
        user.id !== senderUserId &&
        !sameOrganization(user.organization, senderOrganization) &&
        sameOrganization(user.organization, organization) &&
        matchesRole(user),
    );
    const seen = new Set<string>();
    const uniqueUsers: UserProfile[] = [];
    for (const u of matchingUsers) {
      if (!seen.has(u.id)) {
        seen.add(u.id);
        uniqueUsers.push(u);
      }
    }
    return uniqueUsers;
  });
}

/**
 * The direction of an assurance set request:
 * - An explicit direction wins:
 *   - 'ask': sender requests; recipient organization responds.
 *   - 'invite': recipient organization requests; sender responds.
 * - Fallback when no direction is passed:
 *   - Recipient is an Administrator / C Admin: recipient's organization requests; sender responds.
 *   - Otherwise: sender requests; recipient's organization responds.
 */
export function getRequestDirection(
  senderOrganization: string,
  recipient: Pick<UserProfile, 'organization' | 'roles'>,
  direction?: RequestDirection,
): { requestingParty: string; respondingParty: string } {
  if (direction === 'ask') {
    return {
      requestingParty: senderOrganization.trim(),
      respondingParty: recipient.organization.trim(),
    };
  }
  if (direction === 'invite') {
    return {
      requestingParty: recipient.organization.trim(),
      respondingParty: senderOrganization.trim(),
    };
  }
  const isAdministrator =
    recipient.roles.includes('Administrator') || recipient.roles.includes('C Admin');
  if (isAdministrator) {
    return {
      requestingParty: recipient.organization.trim(),
      respondingParty: senderOrganization.trim(),
    };
  }
  return {
    requestingParty: senderOrganization.trim(),
    respondingParty: recipient.organization.trim(),
  };
}

/** Roster objects on the project that the recipient's organization provides, one per asset. */
export function getRequestRosterObjects(
  project: Pick<Project, 'assetLinks'>,
  recipientOrganization?: string,
): ProjectAssetLink[] {
  if (!recipientOrganization?.trim()) return [];
  const seen = new Set<string>();
  return (project.assetLinks ?? []).filter((link) => {
    const key = `${link.assetType}:${link.assetId}`;
    if (seen.has(key) || !sameOrganization(link.providerOrganization, recipientOrganization)) return false;
    seen.add(key);
    return true;
  });
}

/** The request payload form of a roster object. */
export function toSuggestedAsset(link: ProjectAssetLink): SuggestedAssuranceAsset {
  return { assetId: link.assetId, assetType: link.assetType, assetName: link.assetName };
}
