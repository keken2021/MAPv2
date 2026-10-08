/*
  file summary: in-app notification types for project assurance set requests.
  responsibilities: defines notification payload for request-assurance-set workflow.
  role in system: consumed by useMapStore and NotificationPanel.
*/

import { ProjectAssetType } from './project';

export type NotificationStatus = 'pending' | 'actioned' | 'dismissed';

export interface AssuranceSetRequestNotification {
  id: string;
  type: 'assurance_set_request';
  recipientUserId: string;
  senderUserId: string;
  senderName: string;
  projectId: string;
  projectName: string;
  suggestedScope?: ProjectAssetType;
  message?: string;
  status: NotificationStatus;
  createdAt: string;
  actionedAt?: string;
  createdAssuranceSetId?: string;
}
