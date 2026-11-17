"use client";

import { ArrowRightLeft, Ban, BookOpen, History, PackagePlus, Pencil, Tag, Undo2 } from "lucide-react";
import { m } from "motion/react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { buttonClass } from "@/components/ui/field";
import {
  ACTIVITY_FILTERS,
  ACTIVITY_LABEL,
  activityChanges,
  activityDetail,
  type ActivityRow,
  type ActivityType,
  dayHeading,
  shopDay,
} from "@/lib/activity";
import { spring, stagger } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Page = { rows: ActivityRow[]; more: boolean };

// A type always shows an icon and a label, not color alone.
const TYPE_STYLE: Record<ActivityType, { icon: typeof Tag; className: string }> = {
  receive: { icon: PackagePlus, className: "bg-ok-surface text-ok" },
  sell: { icon: Tag, className: "bg-primary text-primary-foreground" },
  reverse_sale: { icon: Undo2, className: "bg-warn-surface text-warn" },
  transfer: { icon: ArrowRightLeft, className: "bg-changed-surface text-changed" },
  adjust: { icon: Pencil, className: "bg-secondary text-secondary-foreground" },
  remove: { icon: Ban, className: "bg-danger-surface text-destructive" },
  model_edit: { icon: BookOpen, className: "bg-secondary text-secondary-foreground" },
};

const time = new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });
const rowKey = (row: ActivityRow) => `${row.src}:${row.id}`;

/** The store activity: every stock change and catalog edit, newest first, grouped by day. */
export function ActivityList({
  filter,
  first,
  loadOlder,
  base = "",
}: {
  filter: string | undefined;
  first: Page;
  loadOlder: (filter: string | undefined, before: unknown) => Promise<Page>;
  base?: string;
}) {
  const current = ACTIVITY_FILTERS.find((f) => f.key === filter)?.key ?? "all";
  // Older pages belong to one filter. A new filter starts from `first` again.
  const [older, setOlder] = useState<{ filter: string; pages: Page[] }>({ filter: current, pages: [] });
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const pages = older.filter === current ? older.pages : [];

  // When older pages are open, a live refresh puts new rows on top of `first` and pushes its
  // last rows out. The first page as it was at the first "Show older" stays in `pages[0]`, so
  // those rows stay in the list. Each row shows once, newest first. Movements are permanent.
  const byKey = new Map<string, ActivityRow>();
  for (const row of [first, ...pages].flatMap((page) => page.rows)) byKey.set(rowKey(row), row);
  const rows = [...byKey.values()].sort((a, b) => (a.at === b.at ? b.src - a.src || b.id - a.id : a.at < b.at ? 1 : -1));
  const more = (pages.at(-1) ?? first).more;
  // The rows of the last "Show older" arrive one after another.
  const arriving = new Map((pages.length > 1 ? pages.at(-1)!.rows : []).map((row, i) => [rowKey(row), i]));

  function showOlder() {
    const last = rows.at(-1);
    if (!last) return;
    setError(false);
    startTransition(async () => {
      try {
        const page = await loadOlder(filter, { at: last.at, src: last.src, id: last.id });
        setOlder({ filter: current, pages: [...(pages.length ? pages : [first]), page] });
      } catch {
        setError(true);
      }
    });
  }

  const days: { day: string; rows: ActivityRow[] }[] = [];
  for (const row of rows) {
    const day = shopDay(row.at);
    if (days.at(-1)?.day !== day) days.push({ day, rows: [] });
    days.at(-1)!.rows.push(row);
  }

  const pill =
    "relative flex h-11 shrink-0 items-center rounded-full px-4 text-sm font-medium outline-none transition-[color,transform] duration-(--dur-fast) focus-visible:ring-3 focus-visible:ring-ring/40 active:scale-[0.96] lg:h-10 lg:px-3.5";

  return (
    <div className="mx-auto max-w-3xl lg:mx-0">
      <h1 className="font-heading text-2xl font-bold">Activity</h1>
      <p className="mt-2 text-muted-foreground">Every ball added, sold, moved, edited, or removed, and every catalog edit.</p>

      <nav
        aria-label="Filter activity"
        className="-mx-4 mt-5 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {ACTIVITY_FILTERS.map((f) => {
          const on = f.key === current;
          return (
            <Link
              key={f.key}
              href={f.key === "all" ? `${base}/activity` : `${base}/activity?type=${f.key}`}
              replace
              scroll={false}
              aria-current={on ? "page" : undefined}
              className={cn(pill, on ? "text-primary-foreground" : "bg-card text-foreground ring-1 ring-border hover:bg-muted")}
            >
              {/* The navy pill slides to the chosen filter. The cause is the tap. */}
              {on && <m.span layoutId="activity-pill" transition={spring.tab} className="absolute inset-0 rounded-full bg-primary" />}
              <span className="relative">{f.label}</span>
            </Link>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <div className="mt-6 py-12 text-center">
          <History className="mx-auto size-9 text-muted-foreground" aria-hidden />
          <h2 className="mt-4 text-lg font-semibold">{current === "all" ? "No activity yet" : "Nothing of this type yet"}</h2>
          <p className="mt-2 text-muted-foreground">
            {current === "all" ? "Each ball you add, sell, or change shows here." : "Choose another filter or All."}
          </p>
        </div>
      ) : (
        days.map((group) => (
          <section key={group.day} className="mt-6" aria-labelledby={`day-${group.day}`}>
            <h2 id={`day-${group.day}`} suppressHydrationWarning className="mb-2 text-sm font-semibold text-muted-foreground">
              {dayHeading(group.rows[0].at)}
            </h2>
            <ul className="divide-y divide-border overflow-hidden rounded-(--radius-card) bg-card shadow-(--shadow-card)">
              {group.rows.map((row) => {
                const index = arriving.get(rowKey(row)) ?? -1;
                return (
                  <m.li
                    key={rowKey(row)}
                    initial={index >= 0 ? { opacity: 0, y: 8 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...spring.layout, delay: index >= 0 ? stagger(index) : 0 }}
                  >
                    <ActivityItem row={row} base={base} />
                  </m.li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      {(more || error) && rows.length > 0 && (
        <div className="mt-6 flex flex-col items-center gap-2">
          {error && (
            <p role="alert" className="text-sm text-destructive">
              The older activity could not be loaded. Try again.
            </p>
          )}
          <button type="button" onClick={showOlder} disabled={pending} className={buttonClass.quiet}>
            {pending ? "Loading…" : "Show older"}
          </button>
        </div>
      )}
    </div>
  );
}

function ActivityItem({ row, base }: { row: ActivityRow; base: string }) {
  const { icon: Icon, className } = TYPE_STYLE[row.type];
  const detail = activityDetail(row);
  const changes = activityChanges(row);
  const href = row.ball_id ? `${base}/balls/${row.ball_id}` : `${base}/catalog/${row.model_id}`;
  return (
    <Link
      href={href}
      className="flex gap-3 p-4 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <span className={cn("mt-0.5 grid size-9 shrink-0 place-items-center rounded-full", className)} aria-hidden="true">
        <Icon className="size-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-semibold">{ACTIVITY_LABEL[row.type]}</p>
          <time dateTime={row.at} suppressHydrationWarning className="tabular shrink-0 text-sm text-muted-foreground">
            {time.format(new Date(row.at))}
          </time>
        </div>
        <p className="mt-0.5 break-words">
          {row.model_name} · <span className="tabular whitespace-nowrap">{row.weight_lb} lb</span>
          {row.serial && <span className="ml-1.5 font-mono text-sm text-muted-foreground">#{row.serial}</span>}
        </p>
        {changes.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-sm">
            {changes.map((c) => (
              <li key={c.field} className="break-words">
                <span className="text-muted-foreground">{c.field}:</span> <span className="line-through decoration-muted-foreground/60">{c.before}</span>{" "}
                <span aria-label="changed to">→</span> <span className="font-medium">{c.after}</span>
              </li>
            ))}
          </ul>
        )}
        {detail && (
          <p className="mt-1 text-sm break-words text-muted-foreground">
            {/* Each part stays on one line, so "Ref. OR-1102" does not break at its hyphen. */}
            {detail.split(" · ").map((part, i) => (
              <span key={i}>
                {i > 0 && " · "}
                <span className="whitespace-nowrap">{part}</span>
              </span>
            ))}
          </p>
        )}
        <p className="mt-1 text-sm text-muted-foreground">By {row.actor_name ?? "Staff"}</p>
      </div>
    </Link>
  );
}
