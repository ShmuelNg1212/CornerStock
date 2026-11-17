import { ChevronRight, ClipboardList } from "lucide-react";
import Link from "next/link";
import type { CountRecord } from "@/lib/count/session";
import { when } from "@/lib/format";

/** The finished counts, newest first. A row opens the result. */
export function CountHistory({ counts, base = "" }: { counts: CountRecord[]; base?: string }) {
  return (
    <section aria-labelledby="count-history" className="mt-8">
      <h2 id="count-history" className="font-heading text-lg font-semibold">
        Past counts
      </h2>
      {counts.length === 0 ? (
        <p className="mt-2 rounded-(--radius-card) border border-dashed border-input px-5 py-6 text-center text-muted-foreground">
          <ClipboardList className="mx-auto mb-2 size-8 opacity-70" aria-hidden="true" />
          No finished count yet.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-border overflow-hidden rounded-(--radius-card) bg-card shadow-(--shadow-card)">
          {counts.map((count) => (
            <li key={count.id}>
              <Link
                href={`${base}/count/${count.id}`}
                className="flex items-center gap-3 px-4 py-3 outline-none transition-colors duration-(--dur-fast) hover:bg-muted focus-visible:bg-muted"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{count.location}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {when(count.finished_at)}
                    {count.finished_by && ` · ${count.finished_by}`}
                  </p>
                  <p className="tabular mt-0.5 text-sm">
                    {count.found} found · <span className={count.missing ? "font-semibold text-destructive" : ""}>{count.missing} missing</span> ·{" "}
                    <span className={count.unexpected ? "font-semibold text-warn" : ""}>{count.unexpected} unexpected</span>
                  </p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
