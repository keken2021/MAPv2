/*
  file summary: pagination state hook for tables.
  responsibilities: holds the page and page size, returns the rows of the current page and the props for the footer bar.
  role in system: called by every table component and view; pairs with TablePagination.tsx.
*/

import { useState } from 'react';
import { DEFAULT_PAGE_SIZE, paginate } from './paginationHelpers';

export interface PaginationControls {
  page: number;
  totalPages: number;
  total: number;
  rangeStart: number;
  rangeEnd: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

type ResetKeyPart = string | number | boolean | null | undefined;

/**
  what: paginates a list; inputs are the filtered and sorted rows and the values that should send the table back to page 1 (search text, filters, sort).
  how: remembers the page together with the reset values it was chosen under, so a change in any of them shows page 1 on the same render.
  with what file: src/utils/usePagination.ts used with src/components/common/TablePagination.tsx.
*/
export function usePagination<T>(
  items: readonly T[],
  resetKeys: readonly ResetKeyPart[] = [],
): { pageItems: T[]; controls: PaginationControls } {
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pageState, setPageState] = useState({ page: 1, key: '' });

  const key = `${resetKeys.join('\u0001')}\u0001${pageSize}`;
  const requestedPage = pageState.key === key ? pageState.page : 1;
  const slice = paginate(items, requestedPage, pageSize);

  return {
    pageItems: slice.pageItems,
    controls: {
      page: slice.page,
      totalPages: slice.totalPages,
      total: slice.total,
      rangeStart: slice.rangeStart,
      rangeEnd: slice.rangeEnd,
      pageSize,
      onPageChange: (page) => setPageState({ page, key }),
      onPageSizeChange: setPageSize,
    },
  };
}
