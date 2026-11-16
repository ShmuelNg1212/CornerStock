import { cn } from "@/lib/utils";

/** A placeholder in the shape of the content that loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse-soft rounded-md bg-secondary", className)} />;
}

/** The stock home while it loads: in the shape of the tiles, the search, and the model cards. */
export function StockListSkeleton() {
  return (
    <div role="status" aria-label="Loading the stock">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-2 h-8 w-36" />
      <div className="mt-3 grid grid-cols-4 gap-2 sm:gap-2.5">
        {[0, 1, 2, 3].map((tile) => (
          <Skeleton key={tile} className="h-24 rounded-(--radius-card)" />
        ))}
      </div>
      <Skeleton className="mt-3 h-14 w-full rounded-2xl" />
      <div className="mt-2.5 flex gap-1.5">
        {[0, 1, 2, 3, 4].map((pill) => (
          <Skeleton key={pill} className="h-12 w-16 rounded-full lg:h-10" />
        ))}
      </div>
      <div className="mt-4 space-y-2.5">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="rounded-(--radius-card) bg-card p-3.5 shadow-(--shadow-card)">
            <div className="flex gap-3">
              <Skeleton className="size-13 rounded-2xl" />
              <div className="flex-1">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="mt-2 h-4 w-28" />
              </div>
            </div>
            <div className="mt-3 flex gap-1.5">
              <Skeleton className="h-12 w-15 rounded-xl" />
              <Skeleton className="h-12 w-15 rounded-xl" />
              <Skeleton className="h-12 w-15 rounded-xl" />
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
