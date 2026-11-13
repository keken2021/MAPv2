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
 * Who can receive an assurance set request on a project: active Client Admins (`C Admin`) of the
 * project's other organizations, in Organizations card order. The sender, the sender's organization
 * and anyone outside the project are left out.
 */
export function getAssuranceSetRequestRecipients(
  users: UserProfile[],
  project: Pick<Project, 'contractParties' | 'invitedOrganizations'>,
  senderOrganization: string,
  senderUserId?: string,
): UserProfile[] {
  const seen = new Set<string>();
  return getOtherPartyOrganizations(project, senderOrganization).flatMap((organization) =>
    users.filter((user) => {
      const matches =
        user.status === 'Active' &&
        user.id !== senderUserId &&
        !seen.has(user.id) &&
        sameOrganization(user.organization, organization) &&
        user.roles.includes('C Admin');
      if (matches) seen.add(user.id);
      return matches;
    }),
  );
}

/** The parties of an assurance set request: the sender's organization requests, the recipient's organization builds the set. */
export function getRequestDirection(
  senderOrganization: string,
  recipient: Pick<UserProfile, 'organization'>,
): { requestingParty: string; respondingParty: string } {
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
