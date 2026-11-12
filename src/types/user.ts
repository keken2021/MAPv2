/* 
  file summary: user profile and organization member interface definitions for user management.
  responsibilities: defines attributes for internal organization users and third-party external stakeholders.
  role in system: consumed by UserManagementView, AddUserModal, and useMapStore.
*/

import { UserRolePersona } from './audit';
import { RoleName } from './permissions';

export type UserType = 'Organization' | 'Third-Party';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  /** BRD personas and any admin-created custom roles */
  roles: RoleName[];
  userType: UserType;
  organization: string;
  departmentOrScope: string;
  status: 'Active' | 'Pending Invitation' | 'Inactive';
  lastActive: string;
  /**
   * Links the records of one person who is a member of several organizations (ADR 0037).
   * Each record is one membership, with its own organization and roles. A record without it is its own person.
   */
  personId?: string;
  /* persona or role that created or invited this user profile */
  createdBy?: string;
  invitedBy?: string;
}

export type { RoleName, UserRolePersona };
