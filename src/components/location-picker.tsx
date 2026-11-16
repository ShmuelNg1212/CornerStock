"use client";

import { Check, MapPin } from "lucide-react";
import { useTransition } from "react";
import { setLocation } from "@/app/actions";
import type { Location } from "@/lib/types";
import { cn } from "@/lib/utils";

/** The locations as a list of large buttons, for a sheet or the account screen. */
export function LocationPicker({ locations, selected, onDone }: { locations: Location[]; selected: string; onDone?: () => void }) {
  const [pending, startTransition] = useTransition();
  const options = [...locations.map((l) => ({ id: l.id, name: l.name })), ...(locations.length > 1 ? [{ id: "all", name: "All locations" }] : [])];
  return (
    <ul className="space-y-1.5" aria-busy={pending}>
      {options.map((option) => {
        const current = option.id === selected;
        return (
          <li key={option.id}>
            <button
              type="button"
              disabled={pending}
              aria-pressed={current}
              onClick={() =>
                startTransition(async () => {
                  if (!current) await setLocation(option.id);
                  onDone?.();
                })
              }
              className={cn(
                "flex min-h-13 w-full items-center gap-3 rounded-xl px-4 text-left text-base font-medium outline-none transition-[background-color,transform] duration-(--dur-fast) focus-visible:ring-3 focus-visible:ring-ring/40 active:scale-[0.98] disabled:opacity-70",
                current ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
              )}
            >
              <MapPin className={cn("size-5 shrink-0", current ? "text-gold" : "text-muted-foreground")} aria-hidden="true" />
              <span className="min-w-0 flex-1 break-words">{option.name}</span>
              {current && <Check className="size-5 shrink-0" aria-hidden="true" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
