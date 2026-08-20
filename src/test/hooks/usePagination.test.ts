import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePagination } from "@/hooks/usePagination";

// Factory rather than a hand-typed array (repo rule): pagination must be
// exercised at firm scale, not a 3-item mock that never crosses a page edge.
function items(n: number) {
  return Array.from({ length: n }, (_, i) => `item-${i}`);
}

describe("usePagination", () => {
  it("returns a single full page when items fit within one page", () => {
    const { result } = renderHook(() => usePagination(items(10), 25));

    expect(result.current.totalPages).toBe(1);
    expect(result.current.totalItems).toBe(10);
    expect(result.current.paginated).toHaveLength(10);
    expect(result.current.page).toBe(1);
  });

  it("bounds each page to pageSize and advances through a 60-item list", () => {
    const { result } = renderHook(() => usePagination(items(60), 25));

    expect(result.current.totalPages).toBe(3);
    expect(result.current.paginated).toEqual(items(60).slice(0, 25));

    act(() => result.current.setPage(2));
    expect(result.current.page).toBe(2);
    expect(result.current.paginated).toEqual(items(60).slice(25, 50));

    act(() => result.current.setPage(3));
    // Last page has the remainder (10 items), not a full page.
    expect(result.current.paginated).toEqual(items(60).slice(50, 60));
    expect(result.current.paginated).toHaveLength(10);
  });

  it("clamps an out-of-range page down to the last valid page", () => {
    const { result } = renderHook(() => usePagination(items(60), 25));

    act(() => result.current.setPage(99));
    // currentPage is clamped to totalPages (3) for the slice.
    expect(result.current.page).toBe(3);
    expect(result.current.paginated).toEqual(items(60).slice(50, 60));
  });

  it("never yields an empty page after the list shrinks below the current page", () => {
    const { rerender, result } = renderHook(({ data }) => usePagination(data, 25), {
      initialProps: { data: items(60) },
    });

    act(() => result.current.setPage(3));
    expect(result.current.paginated).toHaveLength(10);

    // A filter shrinks the list to 10 items (1 page). The stale page-3 state
    // must re-clamp to page 1 rather than render an empty slice.
    rerender({ data: items(10) });
    expect(result.current.totalPages).toBe(1);
    expect(result.current.page).toBe(1);
    expect(result.current.paginated).toHaveLength(10);
  });

  it("reports at least one page for an empty list", () => {
    const { result } = renderHook(() => usePagination<string>([], 25));

    expect(result.current.totalPages).toBe(1);
    expect(result.current.totalItems).toBe(0);
    expect(result.current.paginated).toEqual([]);
  });

  it("honours a custom page size", () => {
    const { result } = renderHook(() => usePagination(items(100), 10));

    expect(result.current.totalPages).toBe(10);
    expect(result.current.pageSize).toBe(10);
    expect(result.current.paginated).toHaveLength(10);
  });
});
