"use client";

import Link from "next/link";
import { useRef, useState, ViewTransition } from "react";
import { buttonClass, Field, inputClass } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { existingBallNotice, type ExistingBall } from "@/lib/label/batch";
import type { LabelErrors, LabelField, RawLabel } from "@/lib/label/rules";
import { MODEL_FIELDS, SERIAL_FIELD, VALUE_FIELDS, type FieldSpec } from "./scan-types";

/** The details of one ball before the save. First the values from the barcodes, then the values that staff type. */
export function ScanConfirm({
  fields,
  errors,
  unread,
  knownModel,
  editModel,
  existingBall,
  message,
  saving,
  selling = false,
  preview,
  canRetake,
  fromBatch,
  locationSelect,
  onField,
  onShowModel,
  onSave,
  onSell = () => {},
  onRetake,
  onCancel,
  base = "",
}: {
  fields: RawLabel;
  errors: LabelErrors;
  unread: LabelField[];
  knownModel: boolean;
  editModel: boolean;
  existingBall: ExistingBall | null;
  message: string | null;
  saving: boolean;
  selling?: boolean;
  preview: string | null;
  canRetake: boolean;
  fromBatch: boolean;
  locationSelect: React.ReactNode;
  onField: (field: LabelField, value: string) => void;
  onShowModel: () => void;
  /** Resolves to false when a field has an error. */
  onSave: () => Promise<boolean>;
  /** Marks the recorded ball as sold. The scan shows it only when that ball is in stock. */
  onSell?: (reference: string) => void;
  onRetake: () => void;
  onCancel: () => void;
  base?: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [reference, setReference] = useState("");
  const notice = existingBall ? existingBallNotice(existingBall) : null;
  // A scan of a ball that is in stock is most often a sale. The main button then sells it.
  const sells = notice?.canSell ?? false;
  const busy = saving || selling;

  const input = ({ field, label, hint, mode, mono }: FieldSpec) => (
    <Field
      key={field}
      label={label}
      error={errors[field]}
      hint={unread.includes(field) && !fields[field] ? "Not found in the photo. Type it from the label." : hint}
    >
      <input
        value={fields[field] ?? ""}
        onChange={(event) => onField(field, event.target.value)}
        inputMode={mode}
        autoCapitalize={mono ? "characters" : undefined}
        autoCorrect="off"
        spellCheck={false}
        aria-invalid={errors[field] ? true : undefined}
        className={`${inputClass} tabular ${mono ? "font-mono" : ""}`}
      />
    </Field>
  );

  const legend = "font-heading mb-3 w-full border-b border-border pb-2 text-lg font-semibold";

  return (
    <form
      ref={form}
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        if (sells) return onSell(reference);
        if (!(await onSave())) form.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
      }}
      noValidate
      className="lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,36rem)] lg:items-start lg:gap-x-10"
    >
      <div className="lg:sticky lg:top-7">
        <h1 className="text-2xl font-bold">Check the details</h1>
        <p className="mt-1 text-muted-foreground">
          {sells
            ? "This ball is already in stock. Mark it as sold, or correct the serial number to add a new ball."
            : knownModel
              ? "Type the weights and the pin distance from the label, then save." : "Type the details from the label, then save."}
        </p>

        {preview && (
          <ViewTransition name="label-photo" share="label-morph" default="none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="The label photo" className="mt-4 max-h-72 rounded-xl border border-border lg:max-h-none lg:w-full" />
          </ViewTransition>
        )}

        {message && (
          <Notice tone="error" className="mt-4">
            {message}
          </Notice>
        )}
        {existingBall && notice && (
          <Notice tone="warn" className="mt-4">
            {notice.text}{" "}
            <Link href={`${base}/balls/${existingBall.id}`} className="underline underline-offset-4">
              View that ball
            </Link>
            . If the serial number was misread, correct it below.
          </Notice>
        )}
        {sells && (
          <div className="mt-4">
            <Field label="Receipt number (optional)">
              <input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={80} className={inputClass} />
            </Field>
          </div>
        )}
      </div>

      <div className="mt-6 lg:mt-0">
        <fieldset>
          <legend className={legend}>This ball</legend>
          <div className="space-y-3.5">
            {input(SERIAL_FIELD)}
            {editModel ? (
              input(MODEL_FIELDS[0])
            ) : (
              <div className="flex items-start justify-between gap-3 rounded-lg bg-secondary px-3.5 py-3">
                <div className="min-w-0">
                  <p className="font-semibold break-words">
                    {fields.model_name} · {fields.nominal_weight_lb} lb
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {[fields.brand, fields.color, "Known model, from the catalog"].filter(Boolean).join(" · ")}
                  </p>
                  <p className="tabular font-mono text-sm text-muted-foreground">UPC {fields.upc}</p>
                </div>
                <button type="button" onClick={onShowModel} className={`${buttonClass.link} -my-1.5 shrink-0`}>
                  Show all
                </button>
              </div>
            )}
          </div>
        </fieldset>

        <fieldset className="mt-7">
          <legend className={legend}>
            Values on the label <span className="font-sans text-sm font-normal text-muted-foreground">· optional</span>
          </legend>
          <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">{VALUE_FIELDS.map(input)}</div>
        </fieldset>

        {editModel && (
          <fieldset className="mt-7">
            <legend className={legend}>Model</legend>
            {knownModel && <p className="mb-3 text-sm text-muted-foreground">This UPC is in the catalog. A save keeps the catalog details of the model.</p>}
            <div className="space-y-3.5">{input(MODEL_FIELDS[1])}</div>
            <div className="mt-3.5 grid grid-cols-2 gap-x-3 gap-y-3.5">{MODEL_FIELDS.slice(2).map(input)}</div>
          </fieldset>
        )}

        <div className="mt-7">
          <Field label="Location">{locationSelect}</Field>
        </div>

        <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-4 mt-6 flex gap-2 border-t border-border bg-background px-4 py-3 lg:bottom-0 lg:mx-0 lg:px-0">
          <button type="submit" disabled={busy} className={`${buttonClass.action} flex-1`}>
            {sells ? (selling ? "Saving…" : "Mark as sold") : saving ? "Saving…" : "Save to stock"}
          </button>
          {canRetake && (
            <button type="button" onClick={onRetake} disabled={busy} className={buttonClass.quiet}>
              Retake
            </button>
          )}
          <button type="button" onClick={onCancel} disabled={busy} className={buttonClass.quiet}>
            {fromBatch ? "Back" : "Cancel"}
          </button>
        </div>
      </div>
    </form>
  );
}
