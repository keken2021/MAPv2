/*
  file summary: modal showing the full detail of one notification.
  responsibilities: presents the subject, status, message, sender, the linked project and the record or user the notification concerns, with the notification's action as the primary button.
  role in system: opened from NotificationsView when a row is selected.
*/

import React, { useEffect, useRef } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { NOTIFICATION_STATUS_META } from '../../store/notificationMockData';
import { AppNotification } from '../../types/notification';
import { formatMaritimeDateTime } from '../../utils/formatters';
import {
  NotificationAction,
  resolveAssuranceRequestContext,
} from '../../utils/notificationHelpers';
import { getProjectClientOrganization } from '../../utils/projectHelpers';
import { formatUserRoles } from '../../utils/userRoleHelpers';

interface NotificationDetailModalProps {
  /** notification to show; the modal is closed when this is null */
  notification: AppNotification | null;
  action: NotificationAction | null;
  onClose: () => void;
  onRunAction: (notification: AppNotification) => void;
}

interface DetailField {
  label: string;
  value: React.ReactNode;
  /** secondary line under the value */
  note?: React.ReactNode;
}

interface DetailGroup {
  title: string;
  fields: DetailField[];
}

const TITLE_ID = 'notification-detail-title';
const REASON_ID = 'notification-detail-action-reason';

/**
  what: renders the notification detail modal; inputs are the selected notification, its resolved row action, and close and run handlers.
  how: resolves the project, sender, assignee, assurance set and document from the store, groups them into details and project, and closes on escape, backdrop click or either close control; focus moves to the close button on open and returns to the opener on close.
  with what file: src/components/drawers/NotificationDetailModal.tsx rendered by NotificationsView.tsx; uses notificationHelpers.ts and notificationMockData.ts.
*/
export const NotificationDetailModal: React.FC<NotificationDetailModalProps> = ({
  notification,
  action,
  onClose,
  onRunAction,
}) => {
  const { projects, users, assuranceSets, documents } = useMapStore();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isOpen = Boolean(notification);

  /* move focus into the dialog, restore it to the opener afterwards, and close on escape */
  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (opener && opener.isConnected) opener.focus();
    };
  }, [isOpen, onClose]);

  if (!notification) return null;

  const statusMeta = NOTIFICATION_STATUS_META[notification.status];
  const project = projects.find((p) => p.id === notification.projectId);
  const sender = users.find((u) => u.id === notification.senderUserId);
  const request = resolveAssuranceRequestContext(notification, projects, users);
  const assignee =
    request?.assignee || users.find((u) => u.id === notification.request?.assigneeUserId);
  const set = assuranceSets.find((s) => s.id === notification.assuranceSetId);
  const doc = documents.find((d) => d.id === notification.documentId);

  const details: DetailField[] = [
    { label: 'From', value: notification.senderName, note: sender?.organization },
  ];
  if (notification.request) {
    details.push({
      label: 'To Be Created By',
      value: assignee?.name || notification.request.assigneeName,
      note: assignee ? `${assignee.organization} · ${formatUserRoles(assignee.roles)}` : undefined,
    });
    if (notification.request.suggestedAssets && notification.request.suggestedAssets.length > 0) {
      details.push({
        label: 'Suggested Assets',
        value: notification.request.suggestedAssets
          .map((asset) => `${asset.assetName} (${asset.assetType})`)
          .join(', '),
      });
    } else if (notification.request.suggestedScopes && notification.request.suggestedScopes.length > 0) {
      details.push({
        label: 'Suggested Scope',
        value: notification.request.suggestedScopes.join(', '),
      });
    } else if (notification.request.suggestedScope) {
      details.push({ label: 'Suggested Scope', value: notification.request.suggestedScope });
    }
    if (notification.request.createdAssuranceSetId) {
      details.push({
        label: 'Created Set',
        value: <span className="font-mono-code">{notification.request.createdAssuranceSetId}</span>,
      });
    }
  }
  if (set) {
    details.push({
      label: 'Assurance Set',
      value: set.title,
      note: <span className="font-mono-code">{set.id}</span>,
    });
  }
  if (doc) {
    details.push({
      label: 'Document',
      value: doc.title,
      note: <span className="font-mono-code">{doc.id}</span>,
    });
  }
  if (notification.capaId) {
    details.push({ label: 'CAPA', value: <span className="font-mono-code">{notification.capaId}</span> });
  }
  if (notification.vesselName) details.push({ label: 'Vessel', value: notification.vesselName });

  const groups: DetailGroup[] = [{ title: 'Details', fields: details }];
  if (project) {
    groups.push({
      title: 'Project',
      fields: [
        { label: 'Name', value: project.name, note: <span className="font-mono-code">{project.id}</span> },
        { label: 'Client', value: getProjectClientOrganization(project) },
        {
          label: 'Window',
          value: (
            <span className="font-mono-code">
              {project.charterWindowStart} to {project.charterWindowEnd}
            </span>
          ),
        },
        { label: 'Type', value: project.projectType },
      ],
    });
  }

  return (
    <div
      className="modal show d-block map-modal-backdrop"
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      style={{ zIndex: 1060 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable map-notif-modal-dialog" role="document">
        <div className="modal-content map-notif-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header align-items-start gap-3">
            <div className="flex-grow-1" style={{ minWidth: 0 }}>
              <h3 id={TITLE_ID} className="map-notif-modal-title mb-1">
                {notification.subject}
              </h3>
              <div className="map-notif-modal-meta">
                <span
                  className="badge rounded-pill map-notif-status"
                  style={{ backgroundColor: statusMeta.background, color: statusMeta.text }}
                >
                  {statusMeta.label}
                </span>
                <span className="font-mono-code map-notif-numeric">
                  {formatMaritimeDateTime(notification.createdAt)}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="btn-close flex-shrink-0"
              onClick={onClose}
              aria-label="Close"
              ref={closeButtonRef}
            />
          </div>

          <div className="modal-body map-notif-modal-body">
            {notification.message && <p className="map-notif-modal-message">{notification.message}</p>}
            {groups.map((group) => (
              <section key={group.title} className="map-notif-modal-group">
                <h4 className="map-notif-modal-group-title">{group.title}</h4>
                <dl className="map-notif-detail mb-0">
                  {group.fields.map((field) => (
                    <div key={field.label}>
                      <dt>{field.label}</dt>
                      <dd>
                        {field.value}
                        {field.note && <div className="map-notif-detail-note">{field.note}</div>}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>

          <div className="modal-footer justify-content-between">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>
              Close
            </button>
            {action && (
              <div className="d-flex align-items-center gap-3">
                {action.disabledReason && (
                  <span id={REASON_ID} className="small text-muted">
                    {action.disabledReason}
                  </span>
                )}
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => onRunAction(notification)}
                  disabled={Boolean(action.disabledReason)}
                  aria-describedby={action.disabledReason ? REASON_ID : undefined}
                >
                  {action.label}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
