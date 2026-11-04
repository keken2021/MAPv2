import React from 'react';
import { ArrowRight } from 'lucide-react';
import { DashboardConfig, DashboardKpiTile, DashboardActionItem, DashboardActivityItem } from '../../types/dashboard';

export interface SharedDashboardFrameProps {
  config: DashboardConfig;
  className?: string;
}

const getTileToneClass = (tone?: string) => {
  switch (tone) {
    case 'bad':
      return 'text-red-600';
    case 'warn':
      return 'text-amber-600';
    case 'ok':
      return 'text-green-600';
    default:
      return 'text-slate-800';
  }
};

const getTagToneClass = (tone?: string) => {
  switch (tone) {
    case 'bad':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'warn':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'ok':
      return 'bg-green-50 text-green-700 border-green-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

export const SharedDashboardFrame: React.FC<SharedDashboardFrameProps> = ({ config, className = '' }) => {
  const visibleActionItems = (config.actionItems || []).slice(0, 5);
  const visibleActivityItems = (config.activityItems || []).slice(0, 5);

  return (
    <div
      data-testid="shared-dashboard-frame"
      className={`bg-slate-50 border border-slate-200 rounded-lg p-3.5 mb-6 text-slate-800 ${className}`}
    >
      <style>{`
        @media (max-width: 900px) {
          .shared-db-main { grid-template-columns: 1fr !important; }
          .shared-db-tiles { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (min-width: 901px) {
          .shared-db-main { grid-template-columns: 2fr 1fr !important; }
          .shared-db-tiles { grid-template-columns: repeat(4, 1fr) !important; }
        }
      `}</style>

      {/* Role Title and Subtitle */}
      <div className="mb-3">
        <h4 className="text-[15px] font-bold text-slate-900 leading-tight m-0">{config.roleTitle}</h4>
        {config.subtitle && <p className="text-xs text-slate-500 mt-0.5 mb-0">{config.subtitle}</p>}
      </div>

      {/* 4-Tile KPI Strip */}
      <div
        data-testid="kpi-strip"
        className="shared-db-tiles grid grid-cols-2 min-[901px]:grid-cols-4 gap-2.5 mb-3"
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
            className="bg-white border border-slate-200 rounded-lg p-2.5 sm:p-3 cursor-pointer hover:border-slate-300 transition-colors flex flex-col justify-between"
          >
            <div>
              <div
                className={`text-[22px] font-bold font-mono tracking-tight leading-none ${getTileToneClass(
                  tile.tone,
                )}`}
              >
                {tile.value}
              </div>
              <div className="text-[11px] text-slate-500 font-medium mt-1 leading-tight">{tile.label}</div>
            </div>
            <div className="text-[11px] text-blue-600 font-medium flex items-center gap-0.5 mt-2 hover:underline">
              <span>{tile.linkText || 'View →'}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Row: Needs your action (about 2/3) + Recent activity (about 1/3) */}
      <div className="shared-db-main grid grid-cols-1 min-[901px]:grid-cols-[2fr_1fr] gap-3">
        {/* Needs your action */}
        <section
          data-testid="needs-your-action-section"
          className="bg-white border border-slate-200 rounded-lg p-3 sm:p-3.5 flex flex-col"
        >
          <div className="flex items-center justify-between font-semibold text-xs uppercase tracking-wider text-slate-600 mb-2">
            <span>Needs your action</span>
            {(config.seeAllText || (config.actionItems && config.actionItems.length > 0)) && (
              <button
                type="button"
                data-testid="see-all-action-link"
                onClick={config.onSeeAll}
                className="text-xs normal-case font-medium text-blue-600 hover:underline tracking-normal cursor-pointer bg-transparent border-0 p-0"
              >
                {config.seeAllText || `See all ${config.actionItems.length}`}
              </button>
            )}
          </div>

          {visibleActionItems.length === 0 ? (
            <div
              data-testid="empty-action-state"
              className="py-8 text-center text-slate-500 text-sm font-medium"
            >
              {config.emptyActionMessage || 'Nothing needs you today'}
            </div>
          ) : (
            <div className="flex flex-col">
              {visibleActionItems.map((item: DashboardActionItem) => (
                <div
                  key={item.id}
                  data-testid="action-item-row"
                  className="flex items-center gap-2.5 py-2 border-t border-slate-100 first:border-t-0"
                >
                  {item.tag && (
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded border whitespace-nowrap ${getTagToneClass(
                        item.tagTone,
                      )}`}
                    >
                      {item.tag}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-slate-800 truncate">{item.title}</div>
                    {item.subtitle && (
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">{item.subtitle}</div>
                    )}
                    {item.readinessBar && (
                      <div
                        data-testid="readiness-bar"
                        className="flex gap-0.5 mt-1"
                        aria-label="Readiness status"
                      >
                        <i
                          className={`h-1 w-8 rounded-xs ${
                            item.readinessBar.submission ? 'bg-green-600' : 'bg-slate-200'
                          }`}
                          title="Submission"
                        />
                        <i
                          className={`h-1 w-8 rounded-xs ${
                            item.readinessBar.verification ? 'bg-green-600' : 'bg-slate-200'
                          }`}
                          title="Verification"
                        />
                        <i
                          className={`h-1 w-8 rounded-xs ${
                            item.readinessBar.inspection ? 'bg-green-600' : 'bg-slate-200'
                          }`}
                          title="Inspection"
                        />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={item.onAction}
                    className="border border-blue-600 text-blue-600 hover:bg-blue-50 text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer shrink-0"
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
          className="bg-white border border-slate-200 rounded-lg p-3 sm:p-3.5 flex flex-col"
        >
          <div className="font-semibold text-xs uppercase tracking-wider text-slate-600 mb-2">
            Recent activity
          </div>
          {visibleActivityItems.length === 0 ? (
            <div
              data-testid="empty-activity-state"
              className="py-6 text-center text-slate-400 text-xs italic"
            >
              No recent activity
            </div>
          ) : (
            <div className="flex flex-col">
              {visibleActivityItems.map((act: DashboardActivityItem) => (
                <div
                  key={act.id}
                  data-testid="activity-item-row"
                  className="py-1.5 border-t border-slate-100 first:border-t-0 text-xs text-slate-700 leading-snug"
                >
                  <div>{act.text}</div>
                  <span className="text-[11px] text-slate-400 block mt-0.5">{act.timeAgo}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

