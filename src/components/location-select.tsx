"use client";

import { MapPin } from "lucide-react";
import { useTransition } from "react";
import { setLocation } from "@/app/actions";
import type { Location } from "@/lib/types";

export function LocationSelect({ locations, selected }: { locations: Location[]; selected: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <label className="relative flex min-w-0 items-center">
      <span className="sr-only">Location</span>
      <MapPin className="pointer-events-none absolute left-2.5 size-4 text-gold" aria-hidden="true" />
      <select
        value={selected}
        disabled={pending}
        onChange={(event) => startTransition(() => setLocation(event.target.value))}
        className="h-10 w-full min-w-0 max-w-56 appearance-none truncate rounded-lg border border-white/25 bg-white/10 pr-3 pl-8 text-base font-medium text-white outline-none focus-visible:ring-3 focus-visible:ring-white/40 disabled:opacity-70 [&>option]:text-foreground"
      >
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name}
          </option>
        ))}
        {locations.length > 1 && <option value="all">All locations</option>}
      </select>
    </label>
  );
}
