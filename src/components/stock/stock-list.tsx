"use client";

import { Camera, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { searchSerials, type SerialMatch } from "@/app/actions";
import { StatusBadge } from "@/components/status-badge";
import { buttonClass, SectionTitle } from "@/components/ui/field";
import { changedModels, snapshot, type CountSnapshot } from "@/lib/stock/changes";
import { filterGroups, stockTotal, type StockGroup } from "@/lib/stock/group";
import { cn } from "@/lib/utils";

const balls = (n: number) => `${n} ${n === 1 ? "ball" : "balls"}`;
const FORWARD = ["nav-forward"];

type Props = {
  groups: StockGroup[];
  /** The name of the selected location, or "all locations". */
  place: string;
  locationNames: Record<string, string>;
  base?: string;
  /** The preview route gives fixed serial number results. */
  fixtureSerials?: SerialMatch[];
};

/**
 * The stock list. One search field leads it.
 * The model rows filter during typing. Serial numbers come from the server after a short pause.
 */
export function StockList({ groups, place, locationNames, base = "", fixtureSerials }: Props) {
  const params = useSearchParams();
  const [query, setQuery] = useState(() => (params.get("q") ?? "").slice(0, 60));
  const [serials, setSerials] = useState<SerialMatch[]>([]);
  const [serialFor, setSerialFor] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const path = usePathname().slice(base.length) || "/";
  const selectedModel = path.startsWith("/models/") ? path.slice("/models/".length) : null;

  const text = query.trim();
  const list = useMemo(() => filterGroups(groups, text), [groups, text]);

  // Keep the search in the address, so a reload or a shared link shows the same list.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (text) url.searchParams.set("q", text);
    else url.searchParams.delete("q");
    window.history.replaceState(window.history.state, "", url);
  }, [text, path]);

  // Serial numbers: ask the server 200 ms after the last key.
  useEffect(() => {
    if (fixtureSerials || text.length < 3) return;
    let stale = false;
    const timer = setTimeout(async () => {
      try {
        const found = await searchSerials(text);
        if (stale) return;
        setSerials(found);
        setSerialFor(text);
      } catch {
        // The model rows still work with no connection. The next key tries again.
      }
    }, 200);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [text, fixtureSerials, groups]);
  const serialMatches = text.length < 3 ? [] : (fixtureSerials ?? (serialFor === text ? serials : []));

  // Mark the counts that changed since the last load, for example from another device.
  const counts = useMemo(() => snapshot(groups), [groups]);
  const before = useRef<CountSnapshot | null>(null);
  const [marks, setMarks] = useState<Record<string, number>>({});
  useEffect(() => {
    const changed = changedModels(before.current, counts);
    before.current = counts;
    if (Object.keys(changed).length) setMarks((current) => ({ ...current, ...changed }));
  }, [counts]);
  const clearMarks = (ids: string[]) =>
    setMarks((current) => {
      if (!ids.some((id) => id in current)) return current;
      const next = { ...current };
      for (const id of ids) delete next[id];
      return next;
    });

  const total = stockTotal(groups);
  const shown = stockTotal(list);

  return (
    <div className="pb-20 lg:pb-0">
      <h1 className="sr-only">Stock</h1>
      <div role="search" className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-6 -translate-y-1/2 text-foreground" aria-hidden="true" />
        <input
          ref={input}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value.slice(0, 60))}
          placeholder="Model or serial number"
          aria-label="Search a model or a serial number"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          className="font-heading h-14 w-full rounded-xl border-2 border-primary bg-card pr-14 pl-13 text-xl font-semibold text-foreground outline-none transition-shadow duration-(--dur-fast) placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:text-muted-foreground focus-visible:ring-4 focus-visible:ring-ring/20 lg:h-16 lg:text-2xl [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              input.current?.focus();
            }}
            aria-label="Clear the search"
            className="absolute top-1/2 right-2 grid size-11 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground outline-none transition-colors duration-(--dur-fast) hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        )}
      </div>

      <p role="status" className="tabular mt-4 text-muted-foreground">
        {text ? (
          <>
            <b className="font-heading text-lg font-bold text-foreground">{list.length}</b> {list.length === 1 ? "model matches" : "models match"} ·{" "}
            {balls(shown)} in {place}
          </>
        ) : (
          <>
            <b className="font-heading text-lg font-bold text-foreground">{total}</b> {total === 1 ? "ball" : "balls"} · {groups.length}{" "}
            {groups.length === 1 ? "model" : "models"} in {place}
          </>
        )}
      </p>

      {list.length > 0 && (
        <ul className="mt-3 space-y-2">
          {list.map((group) => {
            const ids = group.weights.map((w) => w.modelId);
            const delta = ids.reduce((sum, id) => sum + (marks[id] ?? 0), 0);
            const changed = ids.some((id) => id in marks);
            const selected = ids.includes(selectedModel ?? "");
            return (
              <li
                key={group.key}
                onPointerDown={changed ? () => clearMarks(ids) : undefined}
                className={cn(
                  "rounded-xl border bg-card p-4 transition-colors duration-(--dur-slow) sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-x-5",
                  changed ? "border-gold bg-changed-surface" : "border-border",
                  selected && "border-primary outline-1 outline-primary",
                )}
              >
                <div className="flex items-start justify-between gap-3 sm:block">
                  <div className="min-w-0">
                    <h2 className="text-lg leading-snug font-semibold break-words">{group.name}</h2>
                    <p className="truncate text-sm text-muted-foreground">{[group.brand, group.color].filter(Boolean).join(" · ") || "No brand recorded"}</p>
                    {changed && <ChangedMark delta={delta} onSeen={() => clearMarks(ids)} />}
                  </div>
                  <p className="tabular shrink-0 text-right text-sm text-muted-foreground sm:hidden">
                    <span key={group.total} className={cn("font-heading block text-2xl leading-none font-bold text-foreground", changed && "animate-tick")}>
                      {group.total}
                    </span>
                    in stock
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-4 sm:mt-0">
                  <ul className="flex flex-wrap gap-1.5 sm:justify-end" aria-label={`Weights of ${group.name}`}>
                    {group.weights.map((entry) => {
                      const current = entry.modelId === selectedModel;
                      return (
                        <li key={entry.modelId}>
                          <Link
                            href={`${base}/models/${entry.modelId}`}
                            transitionTypes={FORWARD}
                            aria-current={current ? "true" : undefined}
                            aria-label={`${entry.weight} pounds, ${entry.count} in stock`}
                            className="tabular flex h-12 min-w-15 flex-col items-center justify-center rounded-lg border border-input bg-card px-2.5 leading-tight outline-none transition-[background-color,border-color,transform] duration-(--dur-fast) hover:border-primary hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/40 active:scale-[0.96] aria-[current=true]:border-primary aria-[current=true]:bg-primary aria-[current=true]:text-primary-foreground"
                          >
                            <span className="font-heading text-base font-bold">
                              {entry.weight}
                              <span className="ml-0.5 text-xs font-medium">lb</span>
                            </span>
                            <span
                              key={entry.count}
                              className={cn("text-xs font-medium", current ? "text-gold" : "text-muted-foreground", entry.modelId in marks && "animate-tick")}
                            >
                              ×{entry.count}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="tabular hidden w-12 shrink-0 text-right sm:block" aria-label={`${group.total} in stock`}>
                    <span key={group.total} className={cn("font-heading block text-2xl leading-none font-bold", changed && "animate-tick")}>
                      {group.total}
                    </span>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {serialMatches.length > 0 && (
        <section className="mt-6" aria-labelledby="serial-matches">
          <SectionTitle id="serial-matches">Serial numbers</SectionTitle>
          <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {serialMatches.map((ball) => (
              <li key={ball.id}>
                <Link
                  href={`${base}/balls/${ball.id}`}
                  transitionTypes={FORWARD}
                  className="flex items-center gap-3 px-4 py-3 outline-none transition-colors duration-(--dur-fast) hover:bg-muted focus-visible:bg-muted"
                >
                  <div className="min-w-0 flex-1">
                    <p className="tabular truncate font-mono font-semibold">{ball.serial}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {ball.model_name} · {ball.weight} lb · {locationNames[ball.location_id] ?? "Closed location"}
                    </p>
                  </div>
                  <StatusBadge status={ball.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {list.length === 0 && serialMatches.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-input px-6 py-10 text-center">
          {text ? (
            <>
              <p className="font-semibold break-words">Nothing in stock matches “{text}”</p>
              <p className="mt-1 text-muted-foreground">Check the spelling, or select another location. A serial number needs 3 characters or more.</p>
              <button type="button" onClick={() => setQuery("")} className={`${buttonClass.quiet} mt-5`}>
                Clear the search
              </button>
            </>
          ) : (
            <>
              <p className="font-semibold">No balls in stock in {place} yet</p>
              <p className="mt-1 text-muted-foreground">Scan the label on a ball box to add the first one.</p>
              <Link href={`${base}/scan`} className={`${buttonClass.action} mt-5`}>
                <Camera className="size-5" aria-hidden="true" />
                Scan label
              </Link>
            </>
          )}
        </div>
      )}

      {/* On a phone the scan action stays at the thumb. */}
      <Link
        href={`${base}/scan`}
        className={`${buttonClass.action} fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 h-14 rounded-full pr-6 pl-5 shadow-[0_6px_16px_-4px_rgb(23_42_58/0.35)] lg:hidden`}
      >
        <Camera className="size-5" aria-hidden="true" />
        Scan label
      </Link>
    </div>
  );
}

/** Shows that a count changed. It goes away 8 seconds after the row is on screen, or on a touch of the row. */
function ChangedMark({ delta, onSeen }: { delta: number; onSeen: () => void }) {
  const mark = useRef<HTMLParagraphElement>(null);
  const seen = useRef(onSeen);
  useEffect(() => {
    seen.current = onSeen;
  });
  useEffect(() => {
    const element = mark.current;
    if (!element) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let visible = false;
    const schedule = () => {
      clearTimeout(timer);
      if (visible && document.visibilityState === "visible") timer = setTimeout(() => seen.current(), 8000);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      schedule();
    });
    observer.observe(element);
    document.addEventListener("visibilitychange", schedule);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", schedule);
    };
  }, []);
  const amount = `${delta > 0 ? "+" : "−"}${Math.abs(delta)}`;
  return (
    <p ref={mark} className="tabular mt-1.5 inline-flex animate-mark items-center gap-1.5 text-sm font-semibold text-changed">
      <span className="size-2 rounded-full bg-gold" aria-hidden="true" />
      {delta === 0 ? "Changed just now" : `${amount} just now`}
    </p>
  );
}
