import React from 'react';
import { DashboardConfig, DashboardKpiTile, DashboardActionItem, DashboardActivityItem } from '../../types/dashboard';

export interface SharedDashboardFrameProps {
  config: DashboardConfig;
  className?: string;
}

const getTileToneClass = (tone?: string) => {
  switch (tone) {
    case 'bad':
      return 'map-dashboard-tile-value--bad';
    case 'warn':
      return 'map-dashboard-tile-value--warn';
    case 'ok':
      return 'map-dashboard-tile-value--ok';
    default:
      return 'map-dashboard-tile-value--neutral';
  }
};

const getTagToneClass = (tone?: string) => {
  switch (tone) {
    case 'bad':
      return 'map-status-badge--danger';
    case 'warn':
      return 'map-status-badge--warning';
    case 'ok':
      return 'map-status-badge--success';
    default:
      return 'map-status-badge--neutral';
  }
};

export const SharedDashboardFrame: React.FC<SharedDashboardFrameProps> = ({ config, className = '' }) => {
  const visibleActionItems = (config.actionItems || []).slice(0, 5);
  const visibleActivityItems = (config.activityItems || []).slice(0, 5);

  return (
    <div
      data-testid="shared-dashboard-frame"
      className={`map-dashboard-frame ${className}`}
    >
      {/* 4-Tile KPI Strip */}
      <div
        data-testid="kpi-strip"
        className="map-dashboard-tiles"
      >
        {(config.tiles || []).map((tile: DashboardKpiTile) => (
          <div
            key={tile.id}
            data-testid={`kpi-tile-${tile.id}`}
            onClick={tile.onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                tile.onClick?.();
              }
            }}
            className="map-dashboard-tile"
          >
            <div>
              <div className={`map-dashboard-tile-value ${getTileToneClass(tile.tone)}`}>
                {tile.value}
              </div>
              <div className="map-dashboard-tile-label">{tile.label}</div>
            </div>
            <div className="map-dashboard-tile-link">
              <span>{tile.linkText || 'View →'}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Row: Needs your action (about 2/3) + Recent activity (about 1/3) */}
      <div className="map-dashboard-main">
        {/* Needs your action */}
        <section
          data-testid="needs-your-action-section"
          className="map-dashboard-section"
        >
          <div className="map-dashboard-section-header">
            <span className="map-dashboard-section-title">Needs your action</span>
            {(config.seeAllText || (config.actionItems && config.actionItems.length > 0)) && (
              <button
                type="button"
                data-testid="see-all-action-link"
                onClick={config.onSeeAll}
                className="map-dashboard-see-all"
              >
                {config.seeAllText || `See all ${config.actionItems.length}`}
              </button>
            )}
          </div>

          {visibleActionItems.length === 0 ? (
            <div
              data-testid="empty-action-state"
              className="map-dashboard-empty-action"
            >
              {config.emptyActionMessage || 'Nothing needs you today'}
            </div>
          ) : (
            <div>
              {visibleActionItems.map((item: DashboardActionItem) => (
                <div
                  key={item.id}
                  data-testid="action-item-row"
                  className="map-dashboard-action-row"
                >
                  {item.tag && (
                    <span
                      className={`map-status-badge map-dashboard-tag ${getTagToneClass(
                        item.tagTone,
                      )}`}
                    >
                      {item.tag}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="map-dashboard-action-title">{item.title}</div>
                    {item.subtitle && (
                      <div className="map-dashboard-action-subtitle">{item.subtitle}</div>
                    )}
                    {item.readinessBar && (
                      <div
                        data-testid="readiness-bar"
                        className="map-dashboard-readiness-bar"
                        aria-label="Readiness status"
                      >
                        <i
                          className={`map-dashboard-readiness-seg ${
                            item.readinessBar.submission ? 'is-active' : ''
                          }`}
                          title="Submission"
                        />
                        <i
                          className={`map-dashboard-readiness-seg ${
                            item.readinessBar.verification ? 'is-active' : ''
                          }`}
                          title="Verification"
                        />
                        <i
                          className={`map-dashboard-readiness-seg ${
                            item.readinessBar.inspection ? 'is-active' : ''
                          }`}
                          title="Inspection"
                        />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={item.onAction}
                    className="map-dashboard-action-btn"
                  >
                    {item.buttonLabel}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent activity */}
        <section
          data-testid="recent-activity-section"
          className="map-dashboard-section"
        >
          <div className="map-dashboard-section-header">
            <span className="map-dashboard-section-title">Recent activity</span>
          </div>
          {visibleActivityItems.length === 0 ? (
            <div
              data-testid="empty-activity-state"
              className="map-dashboard-empty-activity"
            >
              No recent activity
            </div>
          ) : (
            <div>
              {visibleActivityItems.map((act: DashboardActivityItem) => (
                <div
                  key={act.id}
                  data-testid="activity-item-row"
                  className="map-dashboard-activity-row"
                >
                  <div>{act.text}</div>
                  <span className="map-dashboard-activity-time">{act.timeAgo}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
