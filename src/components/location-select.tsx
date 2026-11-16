"use client";

import { ChevronsUpDown, MapPin } from "lucide-react";
import { useTransition } from "react";
import { setLocation } from "@/app/actions";
import type { Location } from "@/lib/types";

/** Selects the location whose stock the app shows. It sits on the navy rail and the navy top bar. */
export function LocationSelect({ locations, selected, className }: { locations: Location[]; selected: string; className?: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <label className={`relative flex min-w-0 items-center ${className ?? ""}`}>
      <span className="sr-only">Location</span>
      <MapPin className="pointer-events-none absolute left-3 size-4 text-gold" aria-hidden="true" />
      <select
        value={selected}
        disabled={pending}
        onChange={(event) => startTransition(() => setLocation(event.target.value))}
        className="h-11 w-full min-w-0 appearance-none truncate rounded-lg border border-white/25 bg-white/8 pr-8 pl-9 text-base font-medium text-white outline-none transition-colors duration-(--dur-fast) hover:border-white/45 focus-visible:ring-3 focus-visible:ring-white/40 disabled:opacity-70 [&>option]:text-foreground"
      >
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name}
          </option>
        ))}
        {locations.length > 1 && <option value="all">All locations</option>}
      </select>
      <ChevronsUpDown className="pointer-events-none absolute right-2.5 size-4 text-rail-muted" aria-hidden="true" />
    </label>
  );
}
