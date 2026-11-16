"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateModel } from "@/app/actions";
import { MODEL_FIELDS } from "@/app/(app)/scan/scan-types";
import { buttonClass, Field, inputClass } from "@/components/ui/field";
import { MODEL_DETAIL_FIELDS, type ModelDetailErrors, type ModelDetailField, type RawModelDetails } from "@/lib/label/rules";
import type { BallModel } from "@/lib/types";

const FIELDS = MODEL_FIELDS.filter((spec) => (MODEL_DETAIL_FIELDS as readonly string[]).includes(spec.field));

function initial(model: BallModel): RawModelDetails {
  const text = (value: string | null) => value ?? "";
  const num = (value: number | null) => (value === null ? "" : String(Number(value)));
  return {
    brand: text(model.brand),
    model_name: model.name,
    color: text(model.color),
    fragrance: text(model.fragrance),
    coverstock: text(model.coverstock),
    weight_block: text(model.weight_block),
    finish: text(model.finish),
    rg: num(model.rg),
    diff: num(model.diff),
    mass_bias: num(model.mass_bias),
    product_code: text(model.product_code),
  };
}

/** Shows the model details. The owner can open a form here to change them. */
export function ModelDetailsEditor({ model, children }: { model: BallModel; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<RawModelDetails>(() => initial(model));
  const [errors, setErrors] = useState<ModelDetailErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <>
        {children}
        <button
          type="button"
          onClick={() => {
            setFields(initial(model));
            setErrors({});
            setError(null);
            setOpen(true);
          }}
          className={`${buttonClass.link} mt-2`}
        >
          Edit details
        </button>
      </>
    );
  }

  return (
    <form
      className="mt-3 animate-enter rounded-xl border border-input bg-background p-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await updateModel(model.id, fields);
          if (result.ok) {
            setOpen(false);
            toast.success("Model details saved");
            return;
          }
          setError(result.error);
          setErrors(result.fieldErrors ?? {});
        });
      }}
    >
      <p className="mb-3.5 text-sm text-muted-foreground">
        The UPC and the ball weight identify the model. You cannot change them here.
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">
        {FIELDS.map(({ field, label, mode, mono }) => (
          <Field key={field} label={label} error={errors[field as ModelDetailField]} className={field === "model_name" ? "col-span-2" : undefined}>
            <input
              value={fields[field as ModelDetailField] ?? ""}
              onChange={(event) => setFields((current) => ({ ...current, [field]: event.target.value }))}
              inputMode={mode}
              autoCapitalize={mono ? "characters" : undefined}
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={errors[field as ModelDetailField] ? true : undefined}
              className={`${inputClass} tabular ${mono ? "font-mono" : ""}`}
            />
          </Field>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Saving…" : "Save details"}
        </button>
        <button type="button" disabled={pending} onClick={() => setOpen(false)} className={buttonClass.quiet}>
          Cancel
        </button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Leave a field empty to remove its value. The model name is necessary.</p>
    </form>
  );
}
