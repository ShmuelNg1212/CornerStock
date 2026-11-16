"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setPrice } from "@/app/actions";
import { buttonClass, inputClass } from "@/components/ui/field";

export function PriceForm({ modelId, current }: { modelId: string; current: number | null }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(current === null ? "" : String(Number(current)));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${buttonClass.link} mt-1`}>
        {current === null ? "Set a price" : "Change the price"}
      </button>
    );
  }
  return (
    <form
      className="mt-3 animate-enter rounded-xl border border-input bg-background p-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await setPrice(modelId, value);
          if (result.ok) {
            setOpen(false);
            toast.success("Price saved");
          }
          setError(result.ok ? null : result.error);
        });
      }}
    >
      <label className="block text-sm font-medium" htmlFor="price">
        Selling price in pesos
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          id="price"
          inputMode="decimal"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="No price"
          className={`${inputClass} tabular`}
          aria-invalid={error ? true : undefined}
        />
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      {error && <p role="alert" className="mt-1.5 text-sm font-medium text-destructive">{error}</p>}
      <p className="mt-1.5 text-sm text-muted-foreground">Leave the field empty to remove the price.</p>
    </form>
  );
}
