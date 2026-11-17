"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setMinimum } from "@/app/actions";
import { buttonClass, inputClass } from "@/components/ui/field";

/** The owner sets the low-stock minimum. It applies to each location. */
export function MinimumForm({ modelId, current }: { modelId: string; current: number | null }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(current === null ? "" : String(current));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${buttonClass.link} mt-1`}>
        {current ? "Change the low-stock minimum" : "Set a low-stock minimum"}
      </button>
    );
  }
  return (
    <form
      className="mt-3 animate-enter rounded-xl border border-input bg-background p-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await setMinimum(modelId, value);
          if (result.ok) {
            setOpen(false);
            toast.success("Minimum saved");
          }
          setError(result.ok ? null : result.error);
        });
      }}
    >
      <label className="block text-sm font-medium" htmlFor="minimum">
        Keep in stock, in each location
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          id="minimum"
          inputMode="numeric"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="No minimum"
          className={`${inputClass} tabular`}
          aria-invalid={error ? true : undefined}
          aria-describedby="minimum-help"
        />
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      {error && <p role="alert" className="mt-1.5 text-sm font-medium text-destructive">{error}</p>}
      <p id="minimum-help" className="mt-1.5 text-sm text-muted-foreground">
        A location with fewer balls shows as low stock. Leave the field empty for no alert.
      </p>
    </form>
  );
}
