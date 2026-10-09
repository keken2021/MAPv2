/*
  file summary: notifications page listing every notification addressed to the signed-in user.
  responsibilities: tabs for all, unread and actioned, project or sender search, category filter, mark all read, a detail modal per row, and a row action that opens the assigned record or task.
  role in system: main view for the #/notifications route, loaded lazily by App.tsx.
*/

import React, { useCallback, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, CheckCheck, Inbox } from 'lucide-react';
import { useMapStore } from '../store/useMapStore';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_STATUS_META,
  NOTIFICATION_TABS,
} from '../store/notificationMockData';
import { AppNotification, NotificationCategory, NotificationTab } from '../types/notification';
import { FilterModal } from '../components/common/FilterModal';
import { FilterButton } from '../components/common/FilterButton';
import { ActiveFilterChips, FilterChip } from '../components/common/ActiveFilterChips';
import { NotificationDetailModal } from '../components/drawers/NotificationDetailModal';
import { formatMaritimeDateTime } from '../utils/formatters';
import {
  filterNotificationsByTab,
  getNotificationCategory,
  matchesNotificationSearch,
} from '../utils/notificationHelpers';
import { useNotificationInbox } from '../utils/useNotificationInbox';

const COLUMN_COUNT = 6;

/**
  what: renders the notifications page; takes no props.
  how: reads the session user's inbox from useNotificationInbox, applies tab, search, category and time sort in memory, opens NotificationDetailModal for the selected row, and delegates the row action to the hook.
  with what file: src/views/NotificationsView.tsx loaded by App.tsx; uses useNotificationInbox.ts, notificationHelpers.ts, notificationMockData.ts and NotificationDetailModal.tsx.
*/
export const NotificationsView: React.FC = () => {
  const { markAllNotificationsRead, markNotificationRead } = useMapStore();
  const { sessionUser, inbox, unreadCount, getAction, runAction } = useNotificationInbox();

  const [activeTab, setActiveTab] = useState<NotificationTab>('all');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | NotificationCategory>('ALL');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const tabCounts = useMemo(
    () =>
      NOTIFICATION_TABS.reduce(
        (counts, tab) => ({ ...counts, [tab.key]: filterNotificationsByTab(inbox, tab.key).length }),
        {} as Record<NotificationTab, number>,
      ),
    [inbox],
  );

  const tabItems = useMemo(() => filterNotificationsByTab(inbox, activeTab), [inbox, activeTab]);

  const visibleItems = useMemo(() => {
    const filtered = tabItems.filter(
      (n) =>
        matchesNotificationSearch(n, search) &&
        (categoryFilter === 'ALL' || getNotificationCategory(n) === categoryFilter),
    );
    /* the inbox arrives newest first */
    return sortDirection === 'desc' ? filtered : [...filtered].reverse();
  }, [tabItems, search, categoryFilter, sortDirection]);

  const activeTabMeta = NOTIFICATION_TABS.find((tab) => tab.key === activeTab) || NOTIFICATION_TABS[0];
  const hasRefinement = search.trim() !== '' || categoryFilter !== 'ALL';
  const activeFilterCount = categoryFilter !== 'ALL' ? 1 : 0;

  const activeChips: FilterChip[] =
    categoryFilter !== 'ALL'
      ? [{ id: 'category', label: 'Category', value: categoryFilter, onRemove: () => setCategoryFilter('ALL') }]
      : [];

  const handleMarkAllRead = () => {
    if (!sessionUser || unreadCount === 0) return;
    const count = unreadCount;
    markAllNotificationsRead(sessionUser.id);
    setConfirmation(`${count} ${count === 1 ? 'notification' : 'notifications'} marked as read.`);
    setTimeout(() => setConfirmation(null), 3500);
  };

  /* looked up live so the modal reflects status changes made while it is open */
  const selectedNotification = selectedId ? inbox.find((n) => n.id === selectedId) || null : null;

  const handleOpenDetail = (notification: AppNotification) => {
    setSelectedId(notification.id);
    /* opening the detail counts as reading the notification */
    markNotificationRead(notification.id);
  };

  const handleCloseDetail = useCallback(() => setSelectedId(null), []);

  const handleRunFromDetail = (notification: AppNotification) => {
    setSelectedId(null);
    runAction(notification);
  };

  const handleClearRefinement = () => {
    setSearch('');
    setCategoryFilter('ALL');
  };

  if (!sessionUser) {
    return (
      <div className="alert alert-warning mb-0">
        No user profile is linked to this role, so there is no inbox to show. Switch role from the sidebar menu.
      </div>
    );
  }

  return (
    <div className="d-flex flex-column gap-3">
      {confirmation && (
        <div className="alert alert-success py-2 mb-0" role="status">
          {confirmation}
        </div>
      )}

      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
        <div className="nav nav-pills bg-light p-1 rounded-3 border" role="tablist" aria-label="Notification status">
          {NOTIFICATION_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              className={`nav-link btn-sm font-mono-code px-3 py-1.5 ${
                activeTab === tab.key ? 'active bg-primary text-white fw-semibold' : 'text-secondary'
              }`}
              style={{ fontSize: '0.8rem' }}
              onClick={() => {
                setActiveTab(tab.key);
                setSelectedId(null);
              }}
            >
              {tab.label} ({tabCounts[tab.key]})
            </button>
          ))}
        </div>

        <button
          type="button"
          className="btn btn-sm btn-primary d-inline-flex align-items-center gap-2"
          onClick={handleMarkAllRead}
          disabled={unreadCount === 0}
          title={unreadCount === 0 ? 'Nothing is unread.' : undefined}
        >
          <CheckCheck size={18} />
          <span>Mark all read</span>
        </button>
      </div>

      <div className="card map-card-custom">
        <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-3 p-3">
          <div className="d-flex flex-wrap align-items-center gap-2 flex-grow-1">
            <input
              type="search"
              className="form-control form-control-sm bg-white text-dark border-secondary"
              placeholder="Search project or sender"
              aria-label="Search project or sender"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 'min(280px, 100%)' }}
            />
            <FilterButton onClick={() => setIsFilterModalOpen(true)} activeCount={activeFilterCount} />
          </div>
          <div className="text-secondary small map-notif-numeric">
            Showing <strong className="text-dark">{visibleItems.length}</strong> of {tabItems.length}
          </div>
        </div>

        {activeChips.length > 0 && (
          <div className="px-3 py-2 bg-light border-bottom">
            <ActiveFilterChips chips={activeChips} onClearAll={() => setCategoryFilter('ALL')} />
          </div>
        )}

        <div className="table-responsive">
          <table className="table map-table-custom align-middle mb-0">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Project</th>
                <th>Sender</th>
                <th aria-sort={sortDirection === 'desc' ? 'descending' : 'ascending'} style={{ whiteSpace: 'nowrap' }}>
                  <button
                    type="button"
                    className="map-notif-sort"
                    onClick={() => setSortDirection((d) => (d === 'desc' ? 'asc' : 'desc'))}
                    title={sortDirection === 'desc' ? 'Newest first' : 'Oldest first'}
                  >
                    Time
                    {sortDirection === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                  </button>
                </th>
                <th>Status</th>
                <th className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.length === 0 ? (
                <tr>
                  <td colSpan={COLUMN_COUNT} className="text-center py-5">
                    <Inbox size={32} className="text-muted mb-2" aria-hidden="true" />
                    {hasRefinement && tabItems.length > 0 ? (
                      <>
                        <div className="text-muted mb-2">No notifications match this search or filter.</div>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={handleClearRefinement}
                        >
                          Clear search
                        </button>
                      </>
                    ) : (
                      <div className="text-muted">{activeTabMeta.emptyText}</div>
                    )}
                  </td>
                </tr>
              ) : (
                visibleItems.map((n) => {
                  const action = getAction(n);
                  const statusMeta = NOTIFICATION_STATUS_META[n.status];
                  const isUnread = n.status === 'unread';
                  return (
                    <tr
                      key={n.id}
                      className="map-notif-row"
                      onClick={() => handleOpenDetail(n)}
                    >
                      <td>
                        <button
                          type="button"
                          className={`map-notif-subject-link text-dark ${isUnread ? 'fw-semibold' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(n);
                          }}
                          aria-haspopup="dialog"
                        >
                          {n.subject}
                        </button>
                      </td>
                      <td>
                        {n.projectName ? (
                          <>
                            <div className="text-dark">{n.projectName}</div>
                            <div className="font-mono-code small text-muted text-nowrap">{n.projectId}</div>
                          </>
                        ) : (
                          <span className="text-muted">No project</span>
                        )}
                      </td>
                      <td className="text-nowrap">{n.senderName}</td>
                      <td className="font-mono-code small text-nowrap map-notif-numeric">
                        {formatMaritimeDateTime(n.createdAt)}
                      </td>
                      <td>
                        <span
                          className="badge rounded-pill map-notif-status"
                          style={{ backgroundColor: statusMeta.background, color: statusMeta.text }}
                        >
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary text-nowrap"
                          onClick={(e) => {
                            e.stopPropagation();
                            runAction(n);
                          }}
                          disabled={Boolean(action.disabledReason)}
                          title={action.disabledReason}
                        >
                          {action.label}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <NotificationDetailModal
        notification={selectedNotification}
        action={selectedNotification ? getAction(selectedNotification) : null}
        onClose={handleCloseDetail}
        onRunAction={handleRunFromDetail}
      />

      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onReset={() => setCategoryFilter('ALL')}
        title="Notification Filters"
        subtitle="Filter by the kind of request or workflow update"
        activeCount={activeFilterCount}
      >
        <div className="card p-3 bg-white border rounded">
          <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="notification-category-filter">
            Category
          </label>
          <select
            id="notification-category-filter"
            className="form-select form-select-sm bg-white text-dark border-secondary"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'ALL' | NotificationCategory)}
          >
            <option value="ALL">All Categories</option>
            {NOTIFICATION_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
      </FilterModal>
    </div>
  );
};

export default NotificationsView;
