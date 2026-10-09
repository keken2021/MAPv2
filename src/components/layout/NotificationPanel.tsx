/*
  file summary: header bell with an unread count and a dropdown of the latest notifications.
  responsibilities: shows the signed-in user's unread count, lists the five most recent notifications with their row action, and links to the full notifications page.
  role in system: rendered in HeaderBanner.
*/

import React, { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import {
  NOTIFICATION_EMPTY_INBOX_TEXT,
  NOTIFICATION_PANEL_LIMIT,
} from '../../store/notificationMockData';
import { formatMaritimeDateTime } from '../../utils/formatters';
import { useNotificationInbox } from '../../utils/useNotificationInbox';

/* dropdown width and the gap it keeps from the viewport and header edges, in px */
const NOTIFICATION_PANEL_WIDTH = 360;
const NOTIFICATION_PANEL_GUTTER = 16;

/**
  what: renders the header bell button and its dropdown; takes no props.
  how: reads the inbox from useNotificationInbox, keeps the newest five, and closes on outside click, escape, or persona change.
  with what file: src/components/layout/NotificationPanel.tsx loaded by HeaderBanner.tsx; uses useNotificationInbox.ts and notificationMockData.ts.
*/
export const NotificationPanel: React.FC = () => {
  const { activePersona, setCurrentHashView } = useMapStore();
  const { sessionUser, inbox, unreadCount, getAction, runAction } = useNotificationInbox();
  const [open, setOpen] = useState(false);
  const [alignStart, setAlignStart] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  /* opens the dropdown toward whichever side keeps it inside the header, so the sidebar never covers it */
  const handleToggle = () => {
    if (!open && containerRef.current) {
      const bell = containerRef.current.getBoundingClientRect();
      const header = containerRef.current.closest('header')?.getBoundingClientRect();
      const panelWidth = Math.min(NOTIFICATION_PANEL_WIDTH, window.innerWidth - NOTIFICATION_PANEL_GUTTER * 2);
      setAlignStart(bell.right - panelWidth < (header?.left ?? 0) + NOTIFICATION_PANEL_GUTTER);
    }
    setOpen((v) => !v);
  };

  /* close when the pointer goes elsewhere or escape is pressed */
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  /* a different persona has a different inbox */
  useEffect(() => {
    setOpen(false);
  }, [activePersona]);

  if (!sessionUser) return null;

  const latest = inbox.slice(0, NOTIFICATION_PANEL_LIMIT);

  return (
    <div className="position-relative" ref={containerRef}>
      <button
        type="button"
        className="btn btn-sm btn-outline-light map-notif-bell position-relative d-inline-flex align-items-center justify-content-center"
        onClick={handleToggle}
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Bell size={20} color="Blue" />
        {unreadCount > 0 && (
          <span
            className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger map-notif-count"
            aria-hidden="true"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div
          className={`map-notif-panel position-absolute ${alignStart ? 'start-0' : 'end-0'} mt-2 bg-white border`}
          style={{ width: `min(${NOTIFICATION_PANEL_WIDTH}px, calc(100vw - ${NOTIFICATION_PANEL_GUTTER * 2}px))` }}
        >
          <div className="px-3 py-2 border-bottom d-flex align-items-center justify-content-between">
            <span className="fw-semibold small text-dark">Latest</span>
            <span className="small text-muted map-notif-numeric">{unreadCount} unread</span>
          </div>
          {latest.length === 0 ? (
            <div className="p-3 text-muted small">{NOTIFICATION_EMPTY_INBOX_TEXT}</div>
          ) : (
            <ul className="list-unstyled mb-0 map-notif-panel-list">
              {latest.map((n) => {
                const action = getAction(n);
                const isUnread = n.status === 'unread';
                return (
                  <li key={n.id} className="px-3 py-2 border-bottom small">
                    <div className="d-flex align-items-start gap-2">
                      <span
                        className={`map-notif-dot flex-shrink-0 ${isUnread ? 'is-unread' : ''}`}
                        aria-hidden="true"
                      />
                      <div className="flex-grow-1" style={{ minWidth: 0 }}>
                        <div className={`text-dark ${isUnread ? 'fw-semibold' : ''}`}>
                          {isUnread && <span className="visually-hidden">Unread: </span>}
                          {n.subject}
                        </div>
                        <div className="text-muted">
                          {n.senderName}
                          {n.projectName ? ` · ${n.projectName}` : ''}
                        </div>
                        <div className="d-flex align-items-center justify-content-between gap-2 mt-1">
                          <span className="font-mono-code text-muted map-notif-numeric" style={{ fontSize: '0.72rem' }}>
                            {formatMaritimeDateTime(n.createdAt)}
                          </span>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary flex-shrink-0"
                            disabled={Boolean(action.disabledReason)}
                            title={action.disabledReason}
                            onClick={() => {
                              runAction(n);
                              setOpen(false);
                            }}
                          >
                            {action.label}
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="p-2 text-end">
            <button
              type="button"
              className="btn btn-sm btn-link text-decoration-none fw-medium"
              onClick={() => {
                setCurrentHashView('notifications');
                setOpen(false);
              }}
            >
              View all
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
