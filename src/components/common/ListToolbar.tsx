import React from 'react';
import { SearchInput } from './SearchInput';
import { FilterButton } from './FilterButton';
import { ExportMenu } from './ExportMenu';

export interface ListToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  onFilterClick?: () => void;
  activeFilterCount?: number;
  filterLabel?: string;
  onExportCsv?: () => void;
  onExportPdf?: () => void;
  exportDisabled?: boolean;
  primaryAction?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export const ListToolbar: React.FC<ListToolbarProps> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  onFilterClick,
  activeFilterCount = 0,
  filterLabel = 'Filters',
  onExportCsv,
  onExportPdf,
  exportDisabled = false,
  primaryAction,
  children,
  className = '',
}) => {
  return (
    <div
      className={`map-list-toolbar d-flex flex-wrap align-items-center justify-content-between gap-3 p-3 bg-white border-bottom ${className}`}
    >
      <div className="d-flex flex-wrap align-items-center gap-2 flex-grow-1">
        <SearchInput
          value={searchValue}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          wrapperClassName="flex-grow-1"
          wrapperStyle={{ maxWidth: '360px', minWidth: '220px' }}
        />

        {onFilterClick && (
          <FilterButton
            onClick={onFilterClick}
            activeCount={activeFilterCount}
            label={filterLabel}
          />
        )}

        <ExportMenu
          onExportCsv={onExportCsv}
          onExportPdf={onExportPdf}
          disabled={exportDisabled}
          ariaLabel="Export options"
        />

        {children}
      </div>

      {primaryAction && (
        <div className="d-flex align-items-center gap-2">
          {primaryAction}
        </div>
      )}
    </div>
  );
};
