import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize: number;
}

// M27, ISSUES.md — one shared pagination UI so the fix doesn't fragment
// into a different page-number/ellipsis implementation per list (the
// review's own note: 6+ ad hoc `.slice(0, N)` conventions already coexist
// in this codebase). Wraps ui/pagination.tsx, shadcn's primitive that
// existed in the repo but was never actually imported anywhere.
export function PaginationControls({ page, totalPages, onPageChange, totalItems, pageSize }: PaginationControlsProps) {
  if (totalPages <= 1) return null;

  const firstItem = (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, totalItems);

  // Always show first, last, current, and one neighbour on each side;
  // collapse the rest behind an ellipsis. Keeps the control compact even
  // at dozens of pages (a 362-row list at 25/page is already 15 pages).
  const pageNumbers = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  const sorted = [...pageNumbers].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
      <p className="text-xs text-muted-foreground">
        Showing {firstItem}–{lastItem} of {totalItems}
      </p>
      <Pagination className="mx-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              aria-disabled={page === 1}
              className={page === 1 ? "pointer-events-none opacity-50" : undefined}
              onClick={(e) => {
                e.preventDefault();
                if (page > 1) onPageChange(page - 1);
              }}
            />
          </PaginationItem>
          {sorted.map((p, i) => {
            const prev = sorted[i - 1];
            const gap = prev !== undefined && p - prev > 1;
            return (
              <PaginationItem key={p} className="flex items-center gap-1">
                {gap && <PaginationEllipsis />}
                <PaginationLink
                  href="#"
                  isActive={p === page}
                  onClick={(e) => {
                    e.preventDefault();
                    onPageChange(p);
                  }}
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            );
          })}
          <PaginationItem>
            <PaginationNext
              href="#"
              aria-disabled={page === totalPages}
              className={page === totalPages ? "pointer-events-none opacity-50" : undefined}
              onClick={(e) => {
                e.preventDefault();
                if (page < totalPages) onPageChange(page + 1);
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
