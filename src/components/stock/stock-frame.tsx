"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * The stock list and the detail of one model or ball.
 * 1024px and wider: both show, and the list stays while the detail changes.
 * Narrower: one of them shows. The detail is a full screen.
 */
export function StockFrame({ list, children, base = "" }: { list: React.ReactNode; children: React.ReactNode; base?: string }) {
  const path = usePathname().slice(base.length) || "/";
  const detail = path !== "/";
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_25rem] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_28rem]">
      <section aria-label="Stock" className={cn("min-w-0", detail && "hidden lg:block")}>
        {list}
      </section>
      <section
        aria-label="Details"
        className={cn(
          "min-w-0 lg:sticky lg:top-0 lg:-my-7 lg:-mr-8 lg:h-dvh lg:overflow-y-auto lg:border-l lg:border-border lg:bg-card lg:px-6 lg:py-7",
          !detail && "hidden lg:block",
        )}
      >
        {children}
      </section>
    </div>
  );
}
