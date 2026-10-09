/*
  file summary: unit tests for the page maths behind every paginated table.
  responsibilities: verifies page slices, row ranges, page clamping, page size changes, and when the footer bar is shown.
  role in system: executed during vitest test runs.
*/

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  paginate,
  shouldShowPagination,
} from '../utils/paginationHelpers';

const rows = (count: number) => Array.from({ length: count }, (_, index) => `ROW-${index + 1}`);

describe('table pagination', () => {
  it('offers 10, 25 and 50 rows per page and starts at 10', () => {
    expect(PAGE_SIZE_OPTIONS).toEqual([10, 25, 50]);
    expect(DEFAULT_PAGE_SIZE).toBe(10);
  });

  it('returns the first, a middle and a short last page with their row ranges', () => {
    const list = rows(34);

    const first = paginate(list, 1, 10);
    expect(first.pageItems).toEqual(list.slice(0, 10));
    expect(first).toMatchObject({ page: 1, totalPages: 4, total: 34, rangeStart: 1, rangeEnd: 10 });

    const middle = paginate(list, 2, 10);
    expect(middle.pageItems[0]).toBe('ROW-11');
    expect(middle).toMatchObject({ page: 2, rangeStart: 11, rangeEnd: 20 });

    const last = paginate(list, 4, 10);
    expect(last.pageItems).toEqual(['ROW-31', 'ROW-32', 'ROW-33', 'ROW-34']);
    expect(last).toMatchObject({ page: 4, rangeStart: 31, rangeEnd: 34 });
  });

  it('falls back to the last page that exists when rows disappear', () => {
    /* the user was on page 4 of 34 rows; a delete or filter leaves 12 */
    const shrunk = paginate(rows(12), 4, 10);
    expect(shrunk).toMatchObject({ page: 2, totalPages: 2, rangeStart: 11, rangeEnd: 12 });
    expect(shrunk.pageItems).toEqual(['ROW-11', 'ROW-12']);
  });

  it('treats a page below 1 or a non-number as the first page', () => {
    expect(paginate(rows(30), 0, 10).page).toBe(1);
    expect(paginate(rows(30), -3, 10).page).toBe(1);
    expect(paginate(rows(30), Number.NaN, 10).page).toBe(1);
  });

  it('reports one empty page for an empty list', () => {
    expect(paginate([], 1, 10)).toEqual({
      pageItems: [],
      page: 1,
      totalPages: 1,
      total: 0,
      rangeStart: 0,
      rangeEnd: 0,
    });
  });

  it('changes the page count with the page size', () => {
    const list = rows(60);
    expect(paginate(list, 1, 10).totalPages).toBe(6);
    expect(paginate(list, 1, 25).totalPages).toBe(3);
    expect(paginate(list, 3, 25)).toMatchObject({ rangeStart: 51, rangeEnd: 60 });
    expect(paginate(list, 1, 50).totalPages).toBe(2);
    /* an exact multiple does not add an empty page */
    expect(paginate(rows(50), 1, 25).totalPages).toBe(2);
  });

  it('never drops or repeats a row across pages', () => {
    const list = rows(57);
    const seen: string[] = [];
    const { totalPages } = paginate(list, 1, 25);
    for (let page = 1; page <= totalPages; page += 1) {
      seen.push(...paginate(list, page, 25).pageItems);
    }
    expect(seen).toEqual(list);
  });

  it('shows the footer bar only when a table has more rows than the smallest page', () => {
    expect(shouldShowPagination(0)).toBe(false);
    expect(shouldShowPagination(10)).toBe(false);
    expect(shouldShowPagination(11)).toBe(true);
  });
});
