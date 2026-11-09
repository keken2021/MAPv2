export type DashboardRole =
  | 'Administrator as client'
  | 'Submitter'
  | 'Verifier'
  | 'Inspector'
  | 'Approver';

export type KpiTone = 'neutral' | 'bad' | 'warn' | 'ok';

export interface DashboardKpiTile {
  id: string;
  label: string;
  value: number | string;
  tone?: KpiTone;
  linkText?: string;
  onClick?: () => void;
  filterKey?: string;
  filterValue?: string;
}

export interface DashboardReadinessBar {
  submission?: boolean;
  verification?: boolean;
  inspection?: boolean;
}

export interface DashboardActionItem {
  id: string;
  title: string;
  subtitle?: string;
  tag?: string;
  tagTone?: KpiTone;
  buttonLabel: string;
  onAction?: () => void;
  readinessBar?: DashboardReadinessBar;
}

export interface DashboardActivityItem {
  id: string;
  text: string;
  timeAgo: string;
  sentence?: string;
  relativeTime?: string;
  timestampUtc?: string;
}

export interface DashboardConfig {
  roleTitle: string;
  subtitle?: string;
  tiles: DashboardKpiTile[];
  performanceTiles?: DashboardKpiTile[];
  actionItems: DashboardActionItem[];
  activityItems: DashboardActivityItem[];
  seeAllText?: string;
  onSeeAll?: () => void;
  emptyActionMessage?: string;
}
