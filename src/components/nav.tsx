"use client";

import { Camera, LayoutList, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Nav({ owner }: { owner: boolean }) {
  const path = usePathname();
  const items = [
    { href: "/", label: "Stock", icon: LayoutList, current: path === "/" || path.startsWith("/models") || path.startsWith("/balls") },
    { href: "/scan", label: "Scan", icon: Camera, current: path.startsWith("/scan") },
    ...(owner ? [{ href: "/settings", label: "Settings", icon: Settings, current: path.startsWith("/settings") }] : []),
  ];
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] sm:static sm:border-0 sm:bg-transparent sm:pb-0"
    >
      <ul className="mx-auto flex max-w-3xl sm:gap-1">
        {items.map(({ href, label, icon: Icon, current }) => (
          <li key={href} className="flex-1 sm:flex-none">
            <Link
              href={href}
              aria-current={current ? "page" : undefined}
              className="flex h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium text-muted-foreground aria-[current=page]:text-foreground sm:h-10 sm:flex-row sm:gap-2 sm:rounded-lg sm:px-3 sm:text-sm sm:text-white/75 sm:hover:bg-white/10 sm:aria-[current=page]:bg-white/15 sm:aria-[current=page]:text-white"
            >
              <Icon className="size-5 sm:size-4" aria-hidden="true" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
