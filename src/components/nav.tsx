"use client";

import { BookOpen, Camera, ChevronLeft, History, LayoutList, Settings, UserRound } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { BallGlyph } from "@/components/stock/ball-glyph";
import { backTarget } from "@/lib/back-target";
import { BALLS_SAVED } from "@/lib/events";
import { spring } from "@/lib/motion";

const BACK = ["nav-back"];

/** The main navigation. `rail` is the column on large screens; `tabs` is the floating bar on a phone. */
export function Nav({ owner, variant, base = "" }: { owner: boolean; variant: "rail" | "tabs"; base?: string }) {
  const path = usePathname().slice(base.length) || "/";
  const detail = path.startsWith("/models") || path.startsWith("/balls");
  const stock = path === "/" || detail;
  // A ball screen goes back to its model; a model screen goes back to the list.
  const back = useSyncExternalStore(backTarget.subscribe, backTarget.get, () => null);

  if (variant === "rail") {
    const items = [
      { href: "/", label: "Stock", icon: LayoutList, current: stock },
      { href: "/catalog", label: "Catalog", icon: BookOpen, current: path.startsWith("/catalog") },
      { href: "/activity", label: "Activity", icon: History, current: path.startsWith("/activity") },
      { href: "/scan", label: "Scan labels", icon: Camera, current: path.startsWith("/scan") },
      owner
        ? { href: "/settings", label: "Settings", icon: Settings, current: path.startsWith("/settings") }
        : { href: "/account", label: "Account", icon: UserRound, current: path.startsWith("/account") },
    ];
    return (
      <nav aria-label="Main">
        <ul className="space-y-1">
          {items.map(({ href, label, icon: Icon, current }) => (
            <li key={href}>
              <Link
                href={`${base}${href}`}
                aria-current={current ? "page" : undefined}
                className="relative flex h-11 items-center gap-3 rounded-lg px-3 font-medium text-rail-muted outline-none transition-colors duration-(--dur-fast) hover:text-white focus-visible:ring-3 focus-visible:ring-white/40 aria-[current=page]:text-white"
              >
                {/* The indicator slides to the current item: the cause is the navigation. */}
                {current && <m.span layoutId="rail-indicator" transition={spring.tab} className="absolute inset-0 rounded-lg bg-white/12" />}
                <Icon className="relative size-5 shrink-0" aria-hidden="true" />
                <span className="relative">{label}</span>
                {href === "/" && <SavedBadge className="relative ml-auto" />}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  const third = owner
    ? { href: "/settings", label: "Settings", icon: Settings, current: path.startsWith("/settings") }
    : { href: "/account", label: "Account", icon: UserRound, current: path.startsWith("/account") };
  const scanning = path.startsWith("/scan");

  return (
    <nav
      aria-label="Main"
      style={{ viewTransitionName: "shell-tabs" }}
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] z-20 mx-auto max-w-md rounded-[1.5rem] bg-card/95 shadow-(--shadow-float) ring-1 ring-border backdrop-blur-md lg:hidden"
    >
      {/* Five slots: Stock, Catalog, Scan, Activity, and Settings or Account. Each slot is at least 56 px wide at 320 px. */}
      <ul className="grid h-16 grid-cols-5 items-center px-1.5">
        <li className="flex justify-center">
          {/* In a detail screen, the Stock item becomes Back. It stays at the thumb. */}
          <TabLink
            href={detail && back ? back : `${base}/`}
            label={detail ? "Back" : "Stock"}
            current={stock && !detail}
            transitionTypes={detail ? BACK : undefined}
            icon={LayoutList}
            altIcon={ChevronLeft}
            showAlt={detail}
            badge={<SavedBadge className="absolute -top-1 -right-2" />}
          />
        </li>
        <li className="flex justify-center">
          <TabLink href={`${base}/catalog`} label="Catalog" current={path.startsWith("/catalog")} icon={BookOpen} />
        </li>
        <li className="flex justify-center">
          <Link
            href={`${base}/scan`}
            aria-current={scanning ? "page" : undefined}
            aria-label="Scan labels"
            className="group -mt-7 grid size-14 shrink-0 place-items-center rounded-full min-[360px]:size-16 bg-action text-action-foreground shadow-[0_10px_22px_-8px_rgb(185_74_37/0.7)] ring-4 ring-background outline-none transition-transform duration-(--dur-fast) focus-visible:ring-ring/50 active:scale-[0.94] aria-[current=page]:ring-gold/60"
          >
            <Camera className="size-6 transition-transform min-[360px]:size-7 duration-(--dur) group-aria-[current=page]:scale-110" aria-hidden="true" />
          </Link>
        </li>
        <li className="flex justify-center">
          <TabLink href={`${base}/activity`} label="Activity" current={path.startsWith("/activity")} icon={History} />
        </li>
        <li className="flex justify-center">
          {/* The key mounts a new tab when the role changes. A kept page (cacheComponents) must not show the old icon. */}
          <TabLink key={third.href} href={`${base}${third.href}`} label={third.label} current={third.current} icon={third.icon} />
        </li>
      </ul>
    </nav>
  );
}

function TabLink({
  href,
  label,
  current,
  icon,
  altIcon,
  showAlt = false,
  transitionTypes,
  badge,
}: {
  href: string;
  label: string;
  current: boolean;
  icon: typeof LayoutList;
  /** A second icon in the same place, for example Back in place of Stock. */
  altIcon?: typeof LayoutList;
  showAlt?: boolean;
  transitionTypes?: string[];
  badge?: React.ReactNode;
}) {
  // Both icons stay mounted in one grid cell, and only their opacity and scale change.
  // An exit animation can stop in a hidden page, and then the old icon stays in view.
  const icons = altIcon ? [{ Icon: icon, on: !showAlt }, { Icon: altIcon, on: showAlt }] : [{ Icon: icon, on: true }];
  return (
    <Link
      href={href}
      transitionTypes={transitionTypes}
      aria-current={current ? "page" : undefined}
      className="group flex h-14 w-full max-w-18 flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-medium text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40 aria-[current=page]:text-foreground"
    >
      <span className="relative grid h-8 w-12 place-items-center">
        {current && <m.span layoutId="tab-indicator" transition={spring.tab} className="absolute inset-0 rounded-xl bg-primary" />}
        {icons.map(({ Icon, on }, i) => (
          <m.span
            key={i}
            aria-hidden="true"
            className="relative col-start-1 row-start-1 grid place-items-center group-aria-[current=page]:text-primary-foreground"
            initial={false}
            animate={{ opacity: on ? 1 : 0, scale: on ? 1 : 0.6 }}
            transition={spring.snappy}
          >
            <Icon className="size-5" />
          </m.span>
        ))}
        {badge}
      </span>
      {label}
    </Link>
  );
}

/**
 * After a scan saves balls, a ball drops into the Stock item and "+N" shows for 2 seconds.
 * The cause is the save. Under reduced motion the badge shows with no movement.
 */
function SavedBadge({ className }: { className?: string }) {
  const [saved, setSaved] = useState<{ count: number; key: number } | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onSaved = (event: Event) => {
      const count = (event as CustomEvent<number>).detail;
      setSaved((current) => ({ count: (current?.count ?? 0) + count, key: Date.now() }));
      clearTimeout(timer);
      timer = setTimeout(() => setSaved(null), 2000);
    };
    window.addEventListener(BALLS_SAVED, onSaved);
    return () => {
      window.removeEventListener(BALLS_SAVED, onSaved);
      clearTimeout(timer);
    };
  }, []);
  return (
    <span className={className} role="status">
      <AnimatePresence>
        {saved && (
          <m.span
            key="badge"
            className="tabular relative flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[0.6875rem] font-bold text-foreground"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.12 } }}
            transition={spring.snappy}
          >
            <span className="sr-only">Saved: </span>+{saved.count}
            <m.span
              key={saved.key}
              aria-hidden="true"
              className="pointer-events-none absolute -top-9 left-1/2 -ml-2.5"
              initial={{ y: -18, opacity: 0, rotate: -160 }}
              animate={{ y: [-18, 26, 22, 26], opacity: [0, 1, 1, 0], rotate: 0 }}
              transition={{ duration: 0.6, times: [0, 0.55, 0.75, 1], ease: "easeOut" }}
            >
              <BallGlyph color="Orange" className="size-5" />
            </m.span>
          </m.span>
        )}
      </AnimatePresence>
    </span>
  );
}
