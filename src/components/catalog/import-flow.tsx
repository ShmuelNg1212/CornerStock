"use client";

import { Check, FileSpreadsheet, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  commitImport,
  loadImportFile,
  previewImportSheet,
} from "@/app/(app)/catalog/actions";
import { buttonClass, Field, inputClass } from "@/components/ui/field";
import {
  CATALOG_FIELDS,
  STOCK_FIELDS,
  type ColumnMapping,
  type ImportSheet,
} from "@/lib/catalog/fields";
import type { Confirmation } from "@/lib/catalog/confirmation";
import type { ImportReview } from "@/lib/catalog/review";
import type { Location } from "@/lib/types";

const labels: Record<string, string> = {
  name: "Model name",
  gross_weight_oz: "Gross weight (oz)",
  pin_min: "Pin minimum (in)",
  pin_max: "Pin maximum (in)",
  location_id: "Location",
  upc: "UPC",
  model_name: "Model name",
  nominal_weight_lb: "Weight (lb)",
  brand: "Brand",
  color: "Color",
  fragrance: "Fragrance",
  coverstock: "Coverstock",
  weight_block: "Weight block",
  finish: "Finish",
  rg: "RG",
  diff: "Differential",
  mass_bias: "Mass bias",
  product_code: "Product code",
  selling_price: "Selling price (₱)",
  serial: "Serial number",
  gross_weight: "Gross weight",
  top_weight: "Top weight",
  pin_distance: "Pin distance",
  boxed_on: "Boxed date",
  location: "Location",
};
const counts: [keyof ImportReview["summary"], string][] = [
  ["models_added", "models to add"],
  ["models_updated", "models to update"],
  ["balls_added", "balls to receive"],
  ["balls_updated", "balls to correct or move"],
  ["unchanged", "unchanged entries"],
];
const cleanHeader = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
function suggested(
  sheet: ImportSheet,
  kind: "catalog" | "stock",
): ColumnMapping {
  return Object.fromEntries(
    (kind === "catalog" ? CATALOG_FIELDS : STOCK_FIELDS).flatMap((field) => {
      const index = sheet.headers.findIndex(
        (header) => cleanHeader(header) === field,
      );
      return index < 0 ? [] : [[field, index]];
    }),
  );
}

export function ImportFlow({
  locations,
  selected,
}: {
  locations: Location[];
  selected: string;
}) {
  const [kind, setKind] = useState<"catalog" | "stock">("catalog");
  const [step, setStep] = useState<"file" | "columns" | "review" | "result">(
    "file",
  );
  const [workbook, setWorkbook] = useState<{ sheets: ImportSheet[] } | null>(
    null,
  );
  const [sheetIndex, setSheetIndex] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [defaultLocationId, setLocation] = useState(
    locations.some((location) => location.id === selected) ? selected : "",
  );
  const [reason, setReason] = useState("");
  const [review, setReview] = useState<ImportReview | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [result, setResult] = useState<ImportReview["summary"] | null>(null);
  const [error, setError] = useState("");
  const [shown, setShown] = useState(30);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const sheet = workbook?.sheets[sheetIndex];
  const fields = kind === "stock" ? STOCK_FIELDS : CATALOG_FIELDS;
  const dirty = workbook !== null && step !== "result";

  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    const ask = (event: MouseEvent | SubmitEvent) => {
      const target = event.target as Element | null;
      const link = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      const signOut =
        target instanceof HTMLFormElement &&
        target.hasAttribute("data-leaves-scan");
      if (
        !signOut &&
        (!link ||
          link.hasAttribute("data-import-download") ||
          link.target === "_blank")
      )
        return;
      if (
        event instanceof MouseEvent &&
        (event.button ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey)
      )
        return;
      if (
        pending ||
        !window.confirm(
          "This import has not been confirmed. Leave and discard the review?",
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", ask, true);
    document.addEventListener("submit", ask, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", ask, true);
      document.removeEventListener("submit", ask, true);
    };
  }, [dirty, pending]);

  function runReview() {
    if (!sheet) return;
    setError("");
    startTransition(async () => {
      try {
        const response = await previewImportSheet({
          kind,
          sheet,
          mapping,
          defaultLocationId,
          reason,
        });
        if (!response.ok) {
          setError(response.error);
          return;
        }
        setReview(response.review);
        setConfirmation(response.confirmation);
        setShown(30);
        setStep("review");
      } catch {
        setError(
          "The review could not be loaded. Check your connection and try again.",
        );
      }
    });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/catalog" className={buttonClass.link}>
        ← Catalog
      </Link>
      <h1
        ref={heading}
        tabIndex={-1}
        className="font-heading mt-4 text-3xl font-bold outline-none"
      >
        {step === "result" ? "Import saved" : "Import catalog or stock"}
      </h1>
      <p className="mt-2 text-muted-foreground">
        Review every addition and change before anything is saved.
      </p>
      <ol
        aria-label="Import steps"
        className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-b border-border pb-4 text-sm"
      >
        {["file", "columns", "review", "result"].map((name, index) => (
          <li
            key={name}
            aria-current={step === name ? "step" : undefined}
            className={
              step === name
                ? "font-semibold text-foreground"
                : "text-muted-foreground"
            }
          >
            {index + 1}. {name[0].toUpperCase() + name.slice(1)}
          </li>
        ))}
      </ol>
      {error && (
        <p
          role="alert"
          className="mt-5 rounded-lg bg-destructive/10 p-4 text-destructive"
        >
          {error}
        </p>
      )}
      {pending && (
        <p role="status" className="mt-4 text-sm">
          {step === "review" ? "Saving import…" : "Reading and validating…"}
        </p>
      )}

      {step === "file" && (
        <form
          className="mt-6 space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            const file = fileRef.current?.files?.[0];
            if (!file) {
              setError("Choose a file first.");
              return;
            }
            setError("");
            startTransition(async () => {
              try {
                const form = new FormData();
                form.set("file", file);
                const response = await loadImportFile(form);
                if (!response.ok) {
                  setError(response.error);
                  return;
                }
                if (!response.workbook.sheets.length) {
                  setError("This workbook has no readable sheets.");
                  return;
                }
                setWorkbook(response.workbook);
                setSheetIndex(0);
                setMapping(suggested(response.workbook.sheets[0], kind));
                setStep("columns");
              } catch {
                setError(
                  "The file could not be read. Check your connection and try again.",
                );
              }
            });
          }}
        >
          <Field label="What are you importing?">
            <select
              value={kind}
              disabled={pending}
              onChange={(event) =>
                setKind(event.target.value as "catalog" | "stock")
              }
              className={inputClass}
            >
              <option value="catalog">Catalog models and prices</option>
              <option value="stock">Stock balls and catalog details</option>
            </select>
          </Field>
          <div className="rounded-(--radius-card) border border-dashed border-input bg-card p-5 sm:p-7">
            <FileSpreadsheet
              className="size-8 text-muted-foreground"
              aria-hidden
            />
            <Field
              label="Choose a CSV or Excel file"
              hint="Up to 5 MB and 1,000 data rows. Excel files must use .xlsx."
              className="mt-4"
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx"
                disabled={pending}
                required
                className="block min-h-12 w-full min-w-0 text-sm file:mr-3 file:min-h-12 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:font-medium file:text-primary-foreground"
              />
            </Field>
          </div>
          <div className="text-sm text-muted-foreground">
            <p>
              Use a template or map the columns in your existing file. Keep UPCs
              and serial numbers as text.
            </p>
            <p className="mt-2">
              Blank cells keep existing values. Write{" "}
              <code className="font-mono text-foreground">__CLEAR__</code> to
              remove an optional value. Dates use YYYY-MM-DD or month/day/year.
            </p>
            <div className="mt-2 flex flex-wrap gap-4">
              <a
                download
                data-import-download
                href={`/catalog/download?template=${kind}&format=csv`}
                className={buttonClass.link}
              >
                CSV template
              </a>
              <a
                download
                data-import-download
                href={`/catalog/download?template=${kind}&format=xlsx`}
                className={buttonClass.link}
              >
                Excel template
              </a>
            </div>
          </div>
          <button disabled={pending} className={buttonClass.action}>
            <Upload className="size-4" aria-hidden />
            Read file
          </button>
        </form>
      )}

      {step === "columns" && sheet && (
        <div className="mt-6">
          {workbook && workbook.sheets.length > 1 && (
            <Field label="Worksheet" className="mb-5">
              <select
                value={sheetIndex}
                disabled={pending}
                className={inputClass}
                onChange={(event) => {
                  const index = Number(event.target.value);
                  setSheetIndex(index);
                  setMapping(suggested(workbook.sheets[index], kind));
                }}
              >
                {workbook.sheets.map((item, index) => (
                  <option key={index} value={index}>
                    {item.name} ({item.rows.length} rows)
                  </option>
                ))}
              </select>
            </Field>
          )}
          <h2 className="font-heading text-xl font-semibold">
            Match your columns
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {sheet.rows.length} rows in {sheet.name}. UPC is required. Stock
            files also need serial number. New models need a name and weight.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <Field key={field} label={labels[field] ?? field}>
                <select
                  className={inputClass}
                  disabled={pending}
                  value={mapping[field] ?? ""}
                  onChange={(event) =>
                    setMapping((current) => ({
                      ...current,
                      [field]:
                        event.target.value === ""
                          ? undefined
                          : Number(event.target.value),
                    }))
                  }
                >
                  <option value="">Do not import</option>
                  {sheet.headers.map((header, index) => (
                    <option value={index} key={index}>
                      {header || `Column ${index + 1}`} —{" "}
                      {sheet.rows[0]?.cells[index]?.text?.slice(0, 28) ||
                        "empty"}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
          {kind === "stock" && (
            <div className="mt-6 space-y-4">
              <Field
                label="Default location for new balls"
                hint="Used when a new ball has no location in its row. All locations is not a destination."
              >
                <select
                  value={defaultLocationId}
                  onChange={(event) => setLocation(event.target.value)}
                  disabled={pending}
                  className={inputClass}
                >
                  <option value="">Select a location</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Reason for stock corrections"
                hint="Required when changing existing balls. The reason is recorded in stock history."
              >
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={200}
                  disabled={pending}
                  className={inputClass}
                />
              </Field>
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              className={buttonClass.action}
              onClick={runReview}
              disabled={pending}
            >
              Review import
            </button>
            <button
              type="button"
              className={buttonClass.quiet}
              onClick={() => {
                setError("");
                setStep("file");
              }}
              disabled={pending}
            >
              Choose another file
            </button>
          </div>
        </div>
      )}

      {step === "review" && review && (
        <div className="mt-6">
          <h2 className="font-heading text-xl font-semibold">
            Check the changes
          </h2>
          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
            {counts
              .filter(([key]) => kind === "stock" || !key.startsWith("balls_"))
              .map(([key, label]) => (
                <div key={key} className="flex items-baseline gap-2">
                  <dd className="tabular font-heading text-xl font-semibold">
                    {review.summary[key]}
                  </dd>
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                </div>
              ))}
          </dl>
          {review.errors.length > 0 && (
            <section
              aria-label="Import errors"
              className="mt-6 rounded-xl bg-destructive/10 p-4"
            >
              <h3 className="font-semibold text-destructive">
                Fix {review.errors.length}{" "}
                {review.errors.length === 1 ? "error" : "errors"} before saving
              </h3>
              <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto text-sm">
                {review.errors.map((item, index) => (
                  <li key={index} className="break-words">
                    Row {item.row} · {labels[item.field] ?? item.field}:{" "}
                    {item.message}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <ul className="mt-6 divide-y divide-border rounded-(--radius-card) bg-card px-4 shadow-(--shadow-card)">
            {review.changes.slice(0, shown).map((change, index) => (
              <li key={index} className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="min-w-0 font-semibold break-all">
                    {change.identity}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Row {change.row} ·{" "}
                    {change.entity === "model" ? "Model" : "Ball"} ·{" "}
                    {change.action === "add"
                      ? "Add"
                      : change.action === "update"
                        ? "Update"
                        : "Unchanged"}
                  </p>
                </div>
                {change.fields.length > 0 && (
                  <dl className="mt-3 space-y-2 text-sm">
                    {change.fields.map((field, fieldIndex) => (
                      <div
                        key={fieldIndex}
                        className="grid gap-1 sm:grid-cols-[9rem_minmax(0,1fr)]"
                      >
                        <dt className="text-muted-foreground">
                          {labels[field.field] ?? field.field}
                        </dt>
                        <dd className="break-words">
                          <span className="text-muted-foreground">
                            {field.field === "location_id"
                              ? (locations.find(
                                  (item) => item.id === field.before,
                                )?.name ??
                                  field.before) ||
                                "Empty"
                              : field.before || "Empty"}
                          </span>
                          <span aria-label="changes to" className="mx-2">
                            →
                          </span>
                          <span className="font-medium">
                            {field.field === "location_id"
                              ? (locations.find(
                                  (item) => item.id === field.after,
                                )?.name ??
                                  field.after) ||
                                "Empty"
                              : field.after || "Empty"}
                          </span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            ))}
          </ul>
          {review.changes.length > shown && (
            <button
              type="button"
              className={`${buttonClass.quiet} mt-4`}
              onClick={() => setShown((current) => current + 50)}
            >
              Show more changes ({review.changes.length - shown} remaining)
            </button>
          )}
          {kind === "stock" && reason && (
            <p className="mt-4 text-sm">
              <span className="font-semibold">Reason: </span>
              {reason}
            </p>
          )}
          <p className="mt-5 text-sm text-muted-foreground">
            The complete batch saves together. If a record changed after review,
            you will need to review it again.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              className={buttonClass.action}
              disabled={pending || !confirmation || !!review.errors.length}
              onClick={() => {
                if (!confirmation) return;
                setError("");
                startTransition(async () => {
                  try {
                    const response = await commitImport(confirmation);
                    if (response.ok) {
                      setResult(response.result);
                      setStep("result");
                      setConfirmation(null);
                    } else {
                      setError(response.error);
                      if (/review.*again|expired/i.test(response.error))
                        setConfirmation(null);
                    }
                  } catch {
                    setError(
                      "The result could not be confirmed. Check your connection and retry this same import.",
                    );
                  }
                });
              }}
            >
              Confirm import
            </button>
            <button
              type="button"
              className={buttonClass.quiet}
              disabled={pending}
              onClick={() => {
                setStep("columns");
                setError("");
                setConfirmation(null);
              }}
            >
              Back to columns
            </button>
            {!confirmation && !review.errors.length && (
              <button
                type="button"
                className={buttonClass.quiet}
                disabled={pending}
                onClick={runReview}
              >
                Review again
              </button>
            )}
          </div>
        </div>
      )}

      {step === "result" && result && (
        <div className="mt-8">
          <span className="grid size-14 place-items-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-7" aria-hidden />
          </span>
          <p role="status" className="mt-5 text-lg font-semibold">
            Your import is saved.
          </p>
          <ul className="mt-4 space-y-2 text-muted-foreground">
            {counts
              .filter(([key]) => result[key] > 0)
              .map(([key, label]) => (
                <li key={key}>
                  {result[key]}{" "}
                  {label
                    .replace("to add", "added")
                    .replace("to update", "updated")
                    .replace("to receive", "received")
                    .replace("to correct or move", "corrected or moved")}
                </li>
              ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={kind === "stock" ? "/" : "/catalog"}
              className={buttonClass.action}
            >
              {kind === "stock" ? "View stock" : "View catalog"}
            </Link>
            <button
              className={buttonClass.quiet}
              type="button"
              onClick={() => {
                setWorkbook(null);
                setReview(null);
                setResult(null);
                setError("");
                setStep("file");
              }}
            >
              Import another file
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
