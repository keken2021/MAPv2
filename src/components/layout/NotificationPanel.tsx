/*
  file summary: header notification dropdown for assurance set requests.
  responsibilities: shows pending notifications for the active user and routes to create-assurance wizard.
  role in system: rendered in HeaderBanner.
*/

import React, { useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import { getProjectOrganizationForPersona } from '../../utils/projectHelpers';

export const NotificationPanel: React.FC = () => {
  const {
    notifications,
    users,
    activePersona,
    setReturnToProjectId,
    setLockedProjectId,
    setPendingAssuranceRequestNotificationId,
    setCurrentHashView,
  } = useMapStore();
  const [open, setOpen] = useState(false);

  const currentUser = useMemo(
    () => {
      const org = getProjectOrganizationForPersona(activePersona, users);
      return (
        users.find(
          (u) =>
            u.status === 'Active' &&
            u.roles.includes(activePersona) &&
            u.organization === org,
        ) || users.find((u) => u.status === 'Active' && u.roles.includes(activePersona))
      );
    },
    [users, activePersona],
  );

  const myNotifications = useMemo(
    () =>
      notifications.filter(
        (n) =>
          n.status === 'pending' &&
          currentUser &&
          n.recipientUserId === currentUser.id,
      ),
    [notifications, currentUser],
  );

  const handleCreateAssuranceSet = (notificationId: string, projectId: string) => {
    setReturnToProjectId(projectId);
    setLockedProjectId(projectId);
    setPendingAssuranceRequestNotificationId(notificationId);
    setCurrentHashView('create-assurance-set');
    setOpen(false);
  };

  if (!currentUser) return null;

  return (
    <div className="position-relative">
      <button
        type="button"
        className="btn btn-sm btn-outline-light position-relative d-inline-flex align-items-center justify-content-center"
        style={{ width: '36px', height: '36px' }}
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        <Bell size={18} />
        {myNotifications.length > 0 && (
          <span
            className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
            style={{ fontSize: '0.65rem' }}
          >
            {myNotifications.length}
          </span>
        )}
      </button>
      {open && (
        <div
          className="position-absolute end-0 mt-2 bg-white border rounded shadow-lg"
          style={{ width: '320px', zIndex: 1100 }}
        >
          <div className="px-3 py-2 border-bottom fw-semibold small">Notifications</div>
          {myNotifications.length === 0 ? (
            <div className="p-3 text-muted small">No pending notifications.</div>
          ) : (
            <ul className="list-unstyled mb-0" style={{ maxHeight: '280px', overflowY: 'auto' }}>
              {myNotifications.map((n) => (
                <li key={n.id} className="p-3 border-bottom small">
                  <div className="fw-semibold text-dark">Assurance set requested</div>
                  <div className="text-muted">
                    {n.senderName} · {n.projectName}
                  </div>
                  {n.suggestedScope && (
                    <div className="text-muted">Suggested: {n.suggestedScope}</div>
                  )}
                  {n.message && <div className="fst-italic mt-1">{n.message}</div>}
                  <button
                    type="button"
                    className="btn btn-sm btn-primary mt-2"
                    onClick={() => handleCreateAssuranceSet(n.id, n.projectId)}
                  >
                    Create Assurance Set
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
