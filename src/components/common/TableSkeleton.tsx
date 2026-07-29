import { Skeleton } from "@/components/ui/skeleton";

interface TableSkeletonProps {
  columns: number;
  rows?: number;
}

// M29, ISSUES.md — reused by any page whose real content (once loaded) is a
// data table (Clients, Billing). Plain semantic <table> markup rather than
// the shadcn Table primitives, since it fully replaces the real table while
// loading rather than nesting inside it — no need to match whichever table
// implementation the page swaps in once data arrives.
export function TableSkeleton({ columns, rows = 8 }: TableSkeletonProps) {
  return (
    <div className="overflow-x-auto rounded-md border" aria-hidden="true">
      <table className="w-full text-sm">
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r} className="border-b border-border/50 last:border-0">
              {Array.from({ length: columns }, (_, c) => (
                <td key={c} className="p-3">
                  <Skeleton className="h-4 w-full" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
