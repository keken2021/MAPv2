import React from 'react';
import { useMapStore } from '../../store/useMapStore';
import { NOTIFICATION_STATUS_META } from '../../store/notificationMockData';
import { AppNotification } from '../../types/notification';
import { DOCUMENT_RENEWAL_REASON_LABELS } from '../../utils/documentRenewalHelpers';
import { formatMaritimeDate, formatMaritimeDateTime } from '../../utils/formatters';
import {
  NotificationAction,
  resolveAssuranceRequestContext,
} from '../../utils/notificationHelpers';
import { getProjectClientOrganization } from '../../utils/projectHelpers';
import { formatUserRoles } from '../../utils/userRoleHelpers';
import { Modal } from './Modal';

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

const REASON_ID = 'notification-detail-action-reason';

export const NotificationDetailModal: React.FC<NotificationDetailModalProps> = ({
  notification,
  action,
  onClose,
  onRunAction,
}) => {
  const { projects, users, assuranceSets, documents } = useMapStore();

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
  if (notification.renewalReason) {
    details.push({
      label: 'Renewal Reason',
      value: DOCUMENT_RENEWAL_REASON_LABELS[notification.renewalReason],
      note: doc ? <span className="font-mono-code">Expiry {formatMaritimeDate(doc.expiryDate)}</span> : undefined,
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

  const metaNode = (
    <div className="d-flex align-items-center gap-2">
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
  );

  const footerNode = (
    <div className="d-flex justify-content-between align-items-center w-100">
      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose} data-testid="notification-close">
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
  );

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={notification.subject}
      meta={metaNode}
      size="lg"
      footer={footerNode}
    >
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
    </Modal>
  );
};
