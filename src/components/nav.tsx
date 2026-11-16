"use client";

import { Camera, LayoutList, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** The main navigation. `rail` is the column on large screens; `tabs` is the bar at the bottom of a phone. */
export function Nav({ owner, variant, base = "" }: { owner: boolean; variant: "rail" | "tabs"; base?: string }) {
  const path = usePathname().slice(base.length) || "/";
  const items = [
    { href: "/", label: "Stock", icon: LayoutList, current: path === "/" || path.startsWith("/models") || path.startsWith("/balls") },
    { href: "/scan", label: variant === "rail" ? "Scan labels" : "Scan", icon: Camera, current: path.startsWith("/scan") },
    ...(owner ? [{ href: "/settings", label: "Settings", icon: Settings, current: path.startsWith("/settings") }] : []),
  ];

  if (variant === "rail") {
    return (
      <nav aria-label="Main">
        <ul className="space-y-1">
          {items.map(({ href, label, icon: Icon, current }) => (
            <li key={href}>
              <Link
                href={`${base}${href}`}
                aria-current={current ? "page" : undefined}
                className="flex h-11 items-center gap-3 rounded-lg px-3 font-medium text-rail-muted outline-none transition-colors duration-(--dur-fast) hover:bg-white/8 hover:text-white focus-visible:ring-3 focus-visible:ring-white/40 aria-[current=page]:bg-white/12 aria-[current=page]:text-white"
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label="Main" style={{ viewTransitionName: "shell-tabs" }} className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="mx-auto flex max-w-3xl">
        {items.map(({ href, label, icon: Icon, current }) => (
          <li key={href} className="flex-1">
            <Link
              href={`${base}${href}`}
              aria-current={current ? "page" : undefined}
              className="group flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground outline-none focus-visible:bg-muted aria-[current=page]:text-foreground"
            >
              <span className="grid h-7 w-14 place-items-center rounded-full transition-colors duration-(--dur) group-aria-[current=page]:bg-secondary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
