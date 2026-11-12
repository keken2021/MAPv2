import type { UserProfile } from '../types/user';

type Upload = { uploadedBy?: string; uploadedByUserId?: string };
type Viewer = Pick<UserProfile, 'id' | 'name'> & { personId?: string };

/**
 * True when the viewer's current membership made the upload (ADR 0037). A stored user id decides.
 * Older uploads with only a name count as the viewer's when the viewer has one membership.
 */
export function isOwnUpload(upload: Upload, viewer?: Viewer | null): boolean {
  if (!viewer) return false;
  if (upload.uploadedByUserId) return upload.uploadedByUserId === viewer.id;
  const by = upload.uploadedBy?.trim();
  if (!by) return false;
  if (by === viewer.id) return true;
  return !viewer.personId && Boolean(viewer.name) && by === viewer.name;
}
