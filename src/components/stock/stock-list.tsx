"use client";

import { ArrowDownToLine, ChevronDown, Layers, MapPin, Search, Tag, X } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { searchSerials, type SerialMatch } from "@/app/actions";
import { useAccount } from "@/components/account-context";
import { LocationPicker } from "@/components/location-picker";
import { StatusBadge } from "@/components/status-badge";
import { buttonClass, SectionTitle } from "@/components/ui/field";
import { RollingNumber } from "@/components/ui/rolling-number";
import { Sheet } from "@/components/ui/sheet";
import { spring, stagger } from "@/lib/motion";
import { changedModels, snapshot, type CountSnapshot } from "@/lib/stock/changes";
import { applyFilters, brandCounts, filterGroups, parseFilters, stockTotal, weightCounts, type StockFilters, type StockGroup } from "@/lib/stock/group";
import { cn } from "@/lib/utils";
import { BallGlyph } from "./ball-glyph";

const balls = (n: number) => `${n} ${n === 1 ? "ball" : "balls"}`;
const FORWARD = ["nav-forward"];

type Props = {
  groups: StockGroup[];
  /** The name of the selected location, or "all locations". */
  place: string;
  locationNames: Record<string, string>;
  /** Balls received and sold today at the selected location. */
  today?: { received: number; sold: number };
  base?: string;
  /** The preview route gives fixed serial number results. */
  fixtureSerials?: SerialMatch[];
};

/**
 * The stock home. One search field leads it, with the weight and brand pills under it.
 * The model cards filter during typing. Serial numbers come from the server after a short pause.
 */
export function StockList({ groups, place, locationNames, today, base = "", fixtureSerials }: Props) {
  const params = useSearchParams();
  const [query, setQuery] = useState(() => (params.get("q") ?? "").slice(0, 60));
  const [filters, setFilters] = useState<StockFilters>(() => parseFilters({ w: params.get("w"), b: params.get("b") }, groups));
  const [serials, setSerials] = useState<SerialMatch[]>([]);
  const [serialFor, setSerialFor] = useState("");
  const [sheet, setSheet] = useState<"brand" | "location" | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const path = usePathname().slice(base.length) || "/";
  const selectedModel = path.startsWith("/models/") ? path.slice("/models/".length) : null;

  const text = query.trim();
  // A filter for a weight or a brand that is no longer in stock does not apply.
  const active = useMemo(() => parseFilters({ w: filters.weight?.toString() ?? null, b: filters.brand }, groups), [filters, groups]);
  const byText = useMemo(() => filterGroups(groups, text), [groups, text]);
  const list = useMemo(() => applyFilters(byText, active), [byText, active]);
  // The pills count what the other filters leave, so each pill tells what a tap shows.
  const weightPills = useMemo(() => weightCounts(applyFilters(byText, { weight: null, brand: active.brand })), [byText, active.brand]);
  const brands = useMemo(() => brandCounts(applyFilters(byText, { weight: active.weight, brand: null })), [byText, active.weight]);

  // Keep the search and the filters in the address, so a reload or a shared link shows the same list.
  useEffect(() => {
    const url = new URL(window.location.href);
    const set = (key: string, value: string | null) => (value ? url.searchParams.set(key, value) : url.searchParams.delete(key));
    set("q", text);
    set("w", active.weight?.toString() ?? null);
    set("b", active.brand);
    window.history.replaceState(window.history.state, "", url);
  }, [text, active, path]);

  // Large screens: "/" goes to the search from anywhere outside a field.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable], dialog")) return;
      event.preventDefault();
      input.current?.focus();
      input.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
        // The model cards still work with no connection. The next key tries again.
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
  const filtered = Boolean(text || active.weight !== null || active.brand);
  const clearAll = () => {
    setQuery("");
    setFilters({ weight: null, brand: null });
  };

  return (
    <div className="pb-4 lg:pb-0">
      <h1 className="sr-only">Stock</h1>
      <Greeting />

      <Tiles total={total} models={groups.length} today={today} />

      {/* The search and the pills stay in view during a scroll. */}
      <div className="sticky top-[calc(env(safe-area-inset-top)+3rem)] z-10 -mx-4 bg-background/95 px-4 pt-3 pb-2 backdrop-blur-md lg:top-0 lg:-mx-8 lg:px-8 lg:pt-4">
        <div role="search" className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-6 -translate-y-1/2 text-foreground" aria-hidden="true" />
          <input
            ref={input}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value.slice(0, 60))}
            onKeyDown={(event) => {
              if (event.key === "Escape" && query) {
                event.preventDefault();
                setQuery("");
              }
            }}
            placeholder="Model or serial number"
            aria-label="Search a model or a serial number"
            aria-keyshortcuts="/"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            className="font-heading h-14 w-full rounded-2xl border-2 border-primary bg-card pr-14 pl-13 text-xl font-semibold text-foreground shadow-(--shadow-card) outline-none transition-shadow duration-(--dur-fast) placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:text-muted-foreground focus-visible:ring-4 focus-visible:ring-ring/20 lg:h-15 lg:text-2xl [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                input.current?.focus();
              }}
              aria-label="Clear the search"
              className="absolute top-1/2 right-2 grid size-11 -translate-y-1/2 place-items-center rounded-xl text-muted-foreground outline-none transition-colors duration-(--dur-fast) hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute top-1/2 right-4 hidden h-7 min-w-7 -translate-y-1/2 place-items-center rounded-md border border-input bg-background px-1.5 font-sans text-sm text-muted-foreground lg:grid" aria-hidden="true">
              /
            </kbd>
          )}
        </div>

        <Pills
          weights={weightPills}
          active={active}
          onWeight={(weight) => setFilters((current) => ({ ...current, weight }))}
          onBrand={() => setSheet("brand")}
          onClearBrand={() => setFilters((current) => ({ ...current, brand: null }))}
        />
      </div>

      <p role="status" className="tabular mt-2 flex flex-wrap items-center gap-x-1.5 text-muted-foreground">
        {filtered ? (
          <>
            <b className="font-heading text-lg font-bold text-foreground">{list.length}</b> {list.length === 1 ? "model matches" : "models match"} · {balls(shown)} in
          </>
        ) : (
          <>
            <b className="font-heading text-lg font-bold text-foreground">{total}</b> {total === 1 ? "ball" : "balls"} · {groups.length}{" "}
            {groups.length === 1 ? "model" : "models"} in
          </>
        )}
        <PlaceChip place={place} onOpen={() => setSheet("location")} />
      </p>

      {list.length > 0 && (
        <ul className="relative mt-3 space-y-2.5">
          <AnimatePresence mode="popLayout" initial={false}>
            {list.map((group, index) => (
              <ModelCard
                key={group.key}
                group={group}
                index={index}
                base={base}
                marks={marks}
                selectedModel={selectedModel}
                onSeen={clearMarks}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}

      {serialMatches.length > 0 && (
        <section className="mt-6" aria-labelledby="serial-matches">
          <SectionTitle id="serial-matches">Serial numbers</SectionTitle>
          <ul className="mt-2 divide-y divide-border overflow-hidden rounded-(--radius-card) bg-card shadow-(--shadow-card)">
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
        <m.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring.snappy}
          className="mt-6 rounded-(--radius-card) border border-dashed border-input px-6 py-10 text-center"
        >
          {filtered ? (
            <>
              <p className="font-semibold break-words">{text ? `Nothing in stock matches “${text}”` : "Nothing in stock matches these filters"}</p>
              <p className="mt-1 text-muted-foreground">Check the spelling, or select another weight or location. A serial number needs 3 characters or more.</p>
              <button type="button" onClick={clearAll} className={`${buttonClass.quiet} mt-5`}>
                Clear the search and filters
              </button>
            </>
          ) : (
            <>
              <BallGlyph color={null} className="mx-auto size-12 opacity-80" />
              <p className="mt-3 font-semibold">No balls in stock in {place} yet</p>
              <p className="mt-1 text-muted-foreground">Scan the label on a ball box to add the first one. The Scan button is at the bottom.</p>
            </>
          )}
        </m.div>
      )}

      <Sheet open={sheet === "brand"} onClose={() => setSheet(null)} label="Brand">
        <h2 className="text-lg font-semibold">Brand</h2>
        <ul className="mt-3 space-y-1.5">
          {[{ brand: null, count: stockTotal(applyFilters(byText, { weight: active.weight, brand: null })) }, ...brands].map(({ brand, count }) => {
            const current = brand === active.brand;
            return (
              <li key={brand ?? "all"}>
                <button
                  type="button"
                  aria-pressed={current}
                  onClick={() => {
                    setFilters((value) => ({ ...value, brand }));
                    setSheet(null);
                  }}
                  className={cn(
                    "flex min-h-13 w-full items-center gap-3 rounded-xl px-4 text-left text-base font-medium outline-none transition-[background-color,transform] duration-(--dur-fast) focus-visible:ring-3 focus-visible:ring-ring/40 active:scale-[0.98]",
                    current ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                  )}
                >
                  <span className="min-w-0 flex-1 break-words">{brand ?? "All brands"}</span>
                  <span className={cn("tabular text-sm", current ? "text-gold" : "text-muted-foreground")}>{balls(count)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>
      <LocationSheet open={sheet === "location"} onClose={() => setSheet(null)} />
    </div>
  );
}

/** "Good morning" in Manila time, and the name of the staff member. */
function Greeting() {
  const account = useAccount();
  if (!account) return null;
  const hour = (new Date().getUTCHours() + 8) % 24;
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = account.name.trim().split(/\s+/)[0] || "there";
  return (
    <div className="mb-3">
      <p className="text-xs font-medium tracking-wide sm:text-sm text-muted-foreground uppercase" suppressHydrationWarning>
        {part}
      </p>
      <p className="font-heading text-2xl leading-tight font-bold break-words sm:text-[1.75rem]">{first}</p>
    </div>
  );
}

/** Four numbers above the list. The first is the stock total, on navy. */
function Tiles({ total, models, today }: { total: number; models: number; today?: { received: number; sold: number } }) {
  const tiles = [
    { label: "In stock", value: total, icon: <BallGlyph color="Orange" className="size-5 sm:size-6" />, hero: true },
    { label: models === 1 ? "Model" : "Models", value: models, icon: <Layers className="size-4.5 text-foreground" aria-hidden="true" />, tint: "bg-secondary" },
    ...(today
      ? [
          { label: "In today", value: today.received, icon: <ArrowDownToLine className="size-4.5 text-ok" aria-hidden="true" />, tint: "bg-ok-surface" },
          { label: "Sold today", value: today.sold, icon: <Tag className="size-4.5 text-warn" aria-hidden="true" />, tint: "bg-warn-surface" },
        ]
      : []),
  ];
  return (
    <ul className="grid grid-cols-4 gap-2 sm:gap-2.5" aria-label="Summary">
      {tiles.map((tile) => (
        <li
          key={tile.label}
          className={cn(
            "flex min-w-0 flex-col justify-between rounded-2xl p-2.5 shadow-(--shadow-card) sm:rounded-(--radius-card) sm:p-3.5",
            tile.hero ? "bg-primary text-primary-foreground" : "bg-card",
          )}
        >
          <span className={cn("grid size-7 place-items-center rounded-full sm:size-9", tile.hero ? "bg-background" : tile.tint)}>{tile.icon}</span>
          <span className="mt-1.5 block sm:mt-2">
            <RollingNumber value={tile.value} className="font-heading text-2xl font-bold sm:text-[1.75rem]" />
            <span className={cn("mt-0.5 block text-xs leading-tight sm:text-sm", tile.hero ? "text-rail-muted" : "text-muted-foreground")}>{tile.label}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The row of pills under the search: All, each weight in stock, and the brand. */
function Pills({
  weights,
  active,
  onWeight,
  onBrand,
  onClearBrand,
}: {
  weights: { weight: number; count: number }[];
  active: StockFilters;
  onWeight: (weight: number | null) => void;
  onBrand: () => void;
  onClearBrand: () => void;
}) {
  const pill =
    "relative flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium outline-none transition-[color,transform] duration-(--dur-fast) focus-visible:ring-3 focus-visible:ring-ring/40 active:scale-[0.96]";
  const options = [{ weight: null as number | null, label: "All", count: null as number | null }, ...weights.map((w) => ({ weight: w.weight, label: `${w.weight} lb`, count: w.count }))];
  return (
    <div className="-mx-4 mt-2.5 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filter by weight and brand">
      {options.map((option) => {
        const current = option.weight === active.weight;
        return (
          <button
            key={option.label}
            type="button"
            aria-pressed={current}
            onClick={() => onWeight(option.weight)}
            className={cn(pill, current ? "text-primary-foreground" : "bg-card text-foreground ring-1 ring-border hover:bg-muted")}
          >
            {/* The navy pill slides to the chosen weight. The cause is the tap. */}
            {current && <m.span layoutId="weight-pill" transition={spring.tab} className="absolute inset-0 rounded-full bg-primary" />}
            <span className="relative font-heading font-bold">{option.label}</span>
            {option.count !== null && <span className={cn("tabular relative text-xs", current ? "text-gold" : "text-muted-foreground")}>{option.count}</span>}
          </button>
        );
      })}
      <span className="mx-0.5 w-px shrink-0 self-stretch bg-border" aria-hidden="true" />
      {active.brand ? (
        <span className={cn(pill, "bg-primary pr-1 text-primary-foreground")}>
          <button type="button" onClick={onBrand} className="font-heading rounded-full font-bold outline-none focus-visible:ring-3 focus-visible:ring-white/50">
            {active.brand}
          </button>
          <button
            type="button"
            onClick={onClearBrand}
            aria-label={`Show all brands, not only ${active.brand}`}
            className="grid size-8 place-items-center rounded-full outline-none hover:bg-white/12 focus-visible:ring-3 focus-visible:ring-white/50"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </span>
      ) : (
        <button type="button" onClick={onBrand} className={cn(pill, "bg-card text-foreground ring-1 ring-border hover:bg-muted")}>
          Brand
          <ChevronDown className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** The location in the summary line. On a phone it opens the location sheet. */
function PlaceChip({ place, onOpen }: { place: string; onOpen: () => void }) {
  const account = useAccount();
  if (!account || account.locations.length < 2) return <span className="font-medium text-foreground">{place}</span>;
  return (
    <>
      <span className="hidden font-medium text-foreground lg:inline">{place}</span>
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex h-9 max-w-full items-center gap-1 rounded-full bg-card px-3 font-medium text-foreground ring-1 ring-border outline-none transition-transform duration-(--dur-fast) focus-visible:ring-3 focus-visible:ring-ring/40 active:scale-[0.96] lg:hidden"
      >
        <MapPin className="size-4 shrink-0 text-gold" aria-hidden="true" />
        <span className="min-w-0 truncate">{place}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">, change the location</span>
      </button>
    </>
  );
}

function LocationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const account = useAccount();
  if (!account) return null;
  return (
    <Sheet open={open} onClose={onClose} label="Location">
      <h2 className="text-lg font-semibold">Location</h2>
      <p className="mt-0.5 mb-3 text-sm text-muted-foreground">The stock list and each scan use this location.</p>
      <LocationPicker locations={account.locations} selected={account.selected} onDone={onClose} />
    </Sheet>
  );
}

/** One model: a ball in its colors, the name, a chip for each weight, and the total. */
function ModelCard({
  group,
  index,
  base,
  marks,
  selectedModel,
  onSeen,
}: {
  group: StockGroup;
  index: number;
  base: string;
  marks: Record<string, number>;
  selectedModel: string | null;
  onSeen: (ids: string[]) => void;
}) {
  const ids = group.weights.map((w) => w.modelId);
  const delta = ids.reduce((sum, id) => sum + (marks[id] ?? 0), 0);
  const changed = ids.some((id) => id in marks);
  const selected = ids.includes(selectedModel ?? "");
  return (
    <m.li
      layout="position"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0, transition: { ...spring.layout, delay: stagger(index) } }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
      transition={spring.layout}
      onPointerDown={changed ? () => onSeen(ids) : undefined}
      data-selected={selected || undefined}
      className={cn(
        "group/card relative overflow-hidden rounded-(--radius-card) p-3.5 shadow-(--shadow-card) transition-colors duration-(--dur-slow)",
        changed ? "bg-changed-surface ring-1 ring-gold" : "bg-card",
        selected && "lg:bg-primary lg:text-primary-foreground lg:ring-0",
      )}
    >
      {/* One gold light passes across the card when another device changes it. */}
      {changed && (
        <span
          key={delta}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 animate-sweep bg-linear-to-r from-transparent via-gold/30 to-transparent"
        />
      )}
      <div className="relative flex items-start gap-3">
        <span className="grid size-13 shrink-0 place-items-center rounded-2xl bg-background lg:group-data-selected/card:bg-white/10">
          <BallGlyph color={group.color} className="size-10" />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="text-lg leading-snug font-semibold break-words">{group.name}</h2>
          <p className="truncate text-sm text-muted-foreground lg:group-data-selected/card:text-rail-muted">
            {[group.brand, group.color].filter(Boolean).join(" · ") || "No brand recorded"}
          </p>
          {changed && <ChangedMark delta={delta} onSeen={() => onSeen(ids)} />}
        </div>
        <p className="shrink-0 pt-0.5 text-right text-xs text-muted-foreground lg:group-data-selected/card:text-rail-muted" aria-label={`${group.total} in stock`}>
          <RollingNumber value={group.total} className="font-heading text-[1.75rem] font-bold text-foreground lg:group-data-selected/card:text-primary-foreground" />
          <span className="block" aria-hidden="true">
            in stock
          </span>
        </p>
      </div>
      <ul className="relative mt-3 flex flex-wrap gap-1.5" aria-label={`Weights of ${group.name}`}>
        {group.weights.map((entry) => {
          const current = entry.modelId === selectedModel;
          return (
            <li key={entry.modelId}>
              <Link
                href={`${base}/models/${entry.modelId}`}
                transitionTypes={FORWARD}
                aria-current={current ? "true" : undefined}
                aria-label={`${entry.weight} pounds, ${entry.count} in stock`}
                style={{ "--vt-name": `weight-${entry.modelId}` } as React.CSSProperties}
                className="vt-weight tabular flex h-12 min-w-15 flex-col items-center justify-center rounded-xl bg-background px-2.5 leading-tight outline-none transition-[background-color,transform] duration-(--dur-fast) [view-transition-class:weight-tag] hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/40 active:scale-[0.94] aria-[current=true]:bg-gold aria-[current=true]:text-foreground lg:group-data-selected/card:bg-white/10 lg:group-data-selected/card:hover:bg-white/20 lg:group-data-selected/card:aria-[current=true]:bg-gold"
              >
                <span className="font-heading text-base font-bold">
                  {entry.weight}
                  <span className="ml-0.5 text-xs font-medium">lb</span>
                </span>
                <span className="text-xs font-medium opacity-75">×{entry.count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </m.li>
  );
}

/** Shows that a count changed. It goes away 8 seconds after the card is on screen, or on a touch of the card. */
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
