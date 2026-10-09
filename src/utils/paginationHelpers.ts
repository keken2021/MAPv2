/*
  file summary: page maths shared by every paginated table.
  responsibilities: slices a list into one page, clamps the page number, and reports the row range shown.
  role in system: consumed by usePagination.ts and TablePagination.tsx.
*/

export const PAGE_SIZE_OPTIONS: readonly number[] = [10, 25, 50];
export const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0];

export interface PageSlice<T> {
  pageItems: T[];
  /* page actually shown, after clamping to the pages that exist */
  page: number;
  totalPages: number;
  total: number;
  /* 1-based positions of the first and last row shown; both 0 for an empty list */
  rangeStart: number;
  rangeEnd: number;
}

/**
  what: returns the rows of one page; inputs are the full list, the requested page (1-based) and the page size.
  how: clamps the page to 1..totalPages so a page left empty by a delete or a filter falls back to the last page that exists.
  with what file: src/utils/paginationHelpers.ts used by usePagination.ts.
*/
export function paginate<T>(items: readonly T[], page: number, pageSize: number): PageSlice<T> {
  const size = Math.max(1, Math.floor(pageSize));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const start = (current - 1) * size;
  const pageItems = items.slice(start, start + size);

  return {
    pageItems,
    page: current,
    totalPages,
    total,
    rangeStart: total === 0 ? 0 : start + 1,
    rangeEnd: start + pageItems.length,
  };
}

/* the footer bar is only needed once a table has more rows than the smallest page size */
export function shouldShowPagination(total: number): boolean {
  return total > PAGE_SIZE_OPTIONS[0];
}
