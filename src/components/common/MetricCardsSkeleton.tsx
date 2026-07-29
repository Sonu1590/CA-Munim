import { Skeleton } from "@/components/ui/skeleton";

interface MetricCardsSkeletonProps {
  count?: number;
}

// M29, ISSUES.md — matches MetricCards.tsx's grid + card shape.
export function MetricCardsSkeleton({ count = 4 }: MetricCardsSkeletonProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="bg-card rounded-lg p-4 card-shadow">
          <Skeleton className="h-9 w-9 rounded-lg mb-3" />
          <Skeleton className="h-7 w-12 mb-1.5" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      ))}
    </div>
  );
}
