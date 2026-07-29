import { useMemo, useState } from "react";

// M27, ISSUES.md — shared client-side pagination for the "primary browse
// page" components (Clients, Tasks, Billing, Documents, Reports) that
// render a firm-scale, unbounded list. Data is still fetched in full
// (search/filter already operates in-memory over the complete set) —
// this only bounds what gets rendered to the DOM at once, which is what
// was actually observed to strain the page (a live screenshot on the
// Clients list, 362 rows, timed out rendering unpaginated).
export function usePagination<T>(items: T[], pageSize = 25) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginated = useMemo(
    () => items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [items, currentPage, pageSize],
  );

  // `currentPage` (clamped) drives the actual slice above, so a filter
  // that shrinks the list never renders an empty page — `page` itself is
  // left unclamped in state so it doesn't need an effect, and simply gets
  // re-clamped fresh next render regardless of what it drifted to.
  return {
    page: currentPage,
    setPage,
    totalPages,
    pageSize,
    paginated,
    totalItems: items.length,
  };
}
