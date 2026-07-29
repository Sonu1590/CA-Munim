import { Skeleton } from "@/components/ui/skeleton";

interface CardListSkeletonProps {
  count?: number;
}

// M29, ISSUES.md — matches the rounded bordered "card" shape reused across
// mobile list screens and the Kanban board's columns.
export function CardListSkeleton({ count = 5 }: CardListSkeletonProps) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="border border-border rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}
