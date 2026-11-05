import React from 'react';
import { Tabs, type TabItem } from './Tabs';

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
  const filterTabs: TabItem[] = tabs.map((tab) => ({
    key: tab.key,
    label: tab.label,
    count: tab.count,
    tone: tab.tone,
  }));

  return (
    <Tabs
      tabs={filterTabs}
      active={active}
      onChange={onChange}
      variant="filter"
      className={className}
      aria-label={ariaLabel}
    />
  );
};
