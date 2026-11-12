import type { SuggestedAssuranceAsset } from '../types/notification';
import type { Project, ProjectAssetLink } from '../types/project';
import type { UserProfile } from '../types/user';
import { sameOrganization } from './rbacHelpers';

/** Organizations on the project's Organizations card, other than the sender's, in card order. */
function getOtherPartyOrganizations(
  project: Pick<Project, 'contractParties'>,
  senderOrganization: string,
): string[] {
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

  for (const party of project.contractParties ?? []) {
    add(party.organization);
  }

  return list;
}

/**
 * Who can receive an assurance set request on a project: active Submitters of the project's
 * other contract parties. If an organization has no Submitter, its active Administrator is
 * included instead. The sender and the sender's organization are left out.
 */
export function getAssuranceSetRequestRecipients(
  users: UserProfile[],
  project: Pick<Project, 'contractParties'>,
  senderOrganization: string,
  senderUserId?: string,
): UserProfile[] {
  return getOtherPartyOrganizations(project, senderOrganization).flatMap((organization) => {
    const submitters = users.filter(
      (user) =>
        user.status === 'Active' &&
        user.id !== senderUserId &&
        user.roles.includes('Submitter') &&
        sameOrganization(user.organization, organization),
    );
    if (submitters.length > 0) {
      return submitters;
    }
    const admins = users.filter(
      (user) =>
        user.status === 'Active' &&
        user.id !== senderUserId &&
        user.roles.includes('Administrator') &&
        sameOrganization(user.organization, organization),
    );
    return admins;
  });
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
