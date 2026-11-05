/*
  file summary: shared tab bar with section, filter, and toggle variants.
  responsibilities: renders keyed tabs with optional count, tone, icon, and hidden; manages active styling and a11y attrs.
  role in system: CountTabs wraps the filter variant; detail screens migrate onto section/toggle later.
*/

import React, { type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export type TabsVariant = 'section' | 'filter' | 'toggle';
export type TabsSize = 'sm' | 'md';

export interface TabItem {
  key: string;
  label: string;
  count?: number;
  tone?: 'default' | 'warn';
  icon?: LucideIcon;
  hidden?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  variant?: TabsVariant;
  size?: TabsSize;
  className?: string;
  'aria-label'?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  active,
  onChange,
  variant = 'filter',
  size = 'md',
  className = '',
  'aria-label': ariaLabel = 'Tabs',
}) => {
  const visibleTabs = tabs.filter((tab) => !tab.hidden);
  const isToggle = variant === 'toggle';
  const isSection = variant === 'section';
  const isFilter = variant === 'filter';

  const rootClass = [
    'map-tabs',
    `map-tabs--${variant}`,
    `map-tabs--${size}`,
    isFilter || isToggle ? 'map-count-tabs' : '',
    isToggle ? 'map-tabs-toggle-group' : '',
    'd-flex',
    'flex-wrap',
    'align-items-center',
    isSection ? '' : 'gap-2',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={rootClass}
      role={isToggle ? 'group' : 'tablist'}
      aria-label={ariaLabel}
      data-variant={variant}
    >
      {visibleTabs.map((tab) => {
        const isActive = active === tab.key;
        const hasCount = typeof tab.count === 'number';
        const isWarn = tab.tone === 'warn';
        const Icon = tab.icon;

        const buttonClass = [
          isSection ? 'map-tabs-section-tab' : 'map-count-tab',
          'btn',
          'btn-sm',
          !isSection ? 'font-mono-code' : '',
          isActive ? 'is-active' : '',
        ]
          .filter(Boolean)
          .join(' ');

        const labelParts: ReactNode[] = [];
        if (Icon) {
          labelParts.push(<Icon key="icon" size={14} className="map-tabs-tab-icon" aria-hidden="true" />);
        }
        labelParts.push(
          <span key="label" className={isSection ? 'map-tabs-section-label' : 'map-count-tab-label'}>
            {tab.label}
          </span>,
        );
        if (hasCount) {
          labelParts.push(
            <span
              key="count"
              className={`${isSection ? 'map-tabs-section-count' : 'map-count-tab-count'} ms-1 ${isWarn ? 'is-warn map-count-tab-warn' : ''}`}
            >
              ({tab.count})
            </span>,
          );
        }

        return (
          <button
            key={tab.key}
            type="button"
            role={isToggle ? 'button' : 'tab'}
            aria-selected={isToggle ? undefined : isActive}
            aria-pressed={isToggle ? isActive : undefined}
            className={buttonClass}
            onClick={() => onChange(tab.key)}
          >
            <span className="d-inline-flex align-items-center gap-1">{labelParts}</span>
          </button>
        );
      })}
    </div>
  );
};
