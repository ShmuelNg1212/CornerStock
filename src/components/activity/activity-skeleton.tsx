import { Skeleton } from "@/components/ui/skeleton";

/** The activity page while it loads: in the shape of the filters and the rows. */
export function ActivityListSkeleton() {
  return (
    <div role="status" aria-label="Loading the activity" className="mx-auto max-w-3xl lg:mx-0">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="mt-3 h-4 w-72 max-w-full" />
      <div className="mt-5 flex gap-1.5 overflow-hidden">
        {[0, 1, 2, 3, 4].map((pill) => (
          <Skeleton key={pill} className="h-11 w-20 shrink-0 rounded-full lg:h-10" />
        ))}
      </div>
      <Skeleton className="mt-6 h-4 w-16" />
      <div className="mt-2 divide-y divide-border rounded-(--radius-card) bg-card shadow-(--shadow-card)">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="flex gap-3 p-4">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="mt-2 h-4 w-48" />
              <Skeleton className="mt-2 h-4 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
