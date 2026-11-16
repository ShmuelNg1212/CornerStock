import { cn } from "@/lib/utils";

/** A placeholder in the shape of the content that loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse-soft rounded-md bg-secondary", className)} />;
}

/** The stock list while it loads: rows in the shape of the model rows. */
export function StockListSkeleton() {
  return (
    <div role="status" aria-label="Loading the stock">
      <Skeleton className="h-14 w-full rounded-xl" />
      <Skeleton className="mt-5 h-5 w-48" />
      <div className="mt-4 space-y-2">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-2 h-4 w-28" />
            <div className="mt-3 flex gap-2">
              <Skeleton className="h-11 w-16" />
              <Skeleton className="h-11 w-16" />
              <Skeleton className="h-11 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A detail screen while it loads. */
export function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading the details">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-8 w-56" />
      <Skeleton className="mt-3 h-7 w-20" />
      <div className="mt-6 space-y-3">
        {[0, 1, 2].map((row) => (
          <div key={row} className="border-t border-border pt-3">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="mt-2 h-4 w-60" />
          </div>
        ))}
      </div>
    </div>
  );
}
