import type { SuggestedAssuranceAsset } from '../types/notification';
import type { Project, ProjectAssetLink } from '../types/project';
import type { UserProfile } from '../types/user';
import { sameOrganization } from './rbacHelpers';
import { syncInvitedOrganizationsToParties } from './projectHelpers';

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
 * Who can receive an assurance set request on a project: active Administrators AND Submitters of
 * each other party on the project (including invited organizations). The sender, the sender's
 * organization and anyone outside the project are left out. A user who holds both roles appears
 * once, as Administrator. Only organizations with an active Submitter or Administrator are listed.
 */
export function getAssuranceSetRequestRecipients(
  users: UserProfile[],
  project: Pick<Project, 'contractParties' | 'invitedOrganizations'>,
  senderOrganization: string,
  senderUserId?: string,
): UserProfile[] {
  return getOtherPartyOrganizations(project, senderOrganization).flatMap((organization) => {
    const matchingUsers = users.filter(
      (user) =>
        user.status === 'Active' &&
        user.id !== senderUserId &&
        !sameOrganization(user.organization, senderOrganization) &&
        sameOrganization(user.organization, organization) &&
        (user.roles.includes('Administrator') || user.roles.includes('Submitter')),
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
 * The direction of an assurance set request based on the recipient's role:
 * - Recipient is an Administrator: recipient's organization is the Requesting party; sender's organization is the Responding party.
 * - Recipient is a Submitter: sender's organization is the Requesting party; recipient's organization is the Responding party.
 * A user who holds both roles is treated as Administrator.
 */
export function getRequestDirection(
  senderOrganization: string,
  recipient: Pick<UserProfile, 'organization' | 'roles'>,
): { requestingParty: string; respondingParty: string } {
  const isAdministrator = recipient.roles.includes('Administrator');
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
