/*
  file summary: footer bar shown under every paginated table.
  responsibilities: shows the row range, the rows-per-page choice, and previous and next page buttons; hidden for tables that fit on one smallest page.
  role in system: rendered directly after a table by table components and views; styles live in App.css under .map-table-pagination.
*/

import React, { useId } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PAGE_SIZE_OPTIONS, shouldShowPagination } from '../../utils/paginationHelpers';
import { PaginationControls, usePagination } from '../../utils/usePagination';

export const TablePagination: React.FC<PaginationControls> = ({
  page,
  totalPages,
  total,
  rangeStart,
  rangeEnd,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) => {
  const sizeSelectId = useId();

  if (!shouldShowPagination(total)) return null;

  return (
    <nav className="map-table-pagination" aria-label="Table pagination">
      <div className="map-table-pagination-range" aria-live="polite">
        Showing {rangeStart}-{rangeEnd} of {total}
      </div>
      <div className="map-table-pagination-controls">
        <label className="map-table-pagination-size" htmlFor={sizeSelectId}>
          Rows per page
        </label>
        <select
          id={sizeSelectId}
          className="form-select form-select-sm map-table-pagination-select"
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="map-table-pagination-btn"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          title="Previous page"
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="map-table-pagination-page">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className="map-table-pagination-btn"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          title="Next page"
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
};

interface PaginatedProps<T> {
  items: readonly T[];
  resetKeys?: readonly (string | number | boolean | null | undefined)[];
  children: (pageItems: T[], footer: React.ReactNode) => React.ReactNode;
}

/**
  what: paginates a table whose rows are only known inside a conditional part of a view, where the hook cannot be called directly.
  how: owns the pagination state and hands the current page of rows and the ready footer bar to its render function.
  with what file: src/components/common/TablePagination.tsx used by ApproverDashboardView.tsx.
*/
export const Paginated = <T,>({ items, resetKeys, children }: PaginatedProps<T>) => {
  const pagination = usePagination(items, resetKeys);
  return <>{children(pagination.pageItems, <TablePagination {...pagination.controls} />)}</>;
};
