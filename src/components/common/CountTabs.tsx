import React from 'react';

export interface CountTab {
  key: string;
  label: string;
  count?: number;
  tone?: 'default' | 'warn';
}

export interface CountTabsProps {
  tabs: CountTab[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
  'aria-label'?: string;
}

export const CountTabs: React.FC<CountTabsProps> = ({
  tabs,
  active,
  onChange,
  className = '',
  'aria-label': ariaLabel = 'Category tabs',
}) => {
  return (
    <div
      className={`map-count-tabs d-flex flex-wrap align-items-center gap-2 ${className}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        const hasCount = typeof tab.count === 'number';
        const isWarn = tab.tone === 'warn';

        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`map-count-tab btn btn-sm font-mono-code ${isActive ? 'is-active' : ''}`}
            onClick={() => onChange(tab.key)}
          >
            <span className="map-count-tab-label">{tab.label}</span>
            {hasCount && (
              <span
                className={`map-count-tab-count ms-1 ${isWarn ? 'is-warn map-count-tab-warn' : ''}`}
              >
                ({tab.count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

