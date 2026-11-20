"use client";

import { Download } from "lucide-react";
import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { LowMark } from "@/components/stock/low-mark";
import { buttonClass, Field, inputClass } from "@/components/ui/field";
import { orderQuantity, reorderRowKey, type ReorderWorksheet } from "@/lib/reorder-worksheet";
import { salesReportPeriodLabel } from "@/lib/sales-report";

const countFormat = new Intl.NumberFormat("en-PH");
const lineLayout = "grid grid-cols-2 gap-x-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.85fr)]";
type Draft = { worksheet: ReorderWorksheet; entries: Record<string, string>; basedOn: ReorderWorksheet };

function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function ReorderForm({ initial }: { initial: ReorderWorksheet }) {
  const [location, setLocation] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const activeDownload = useRef<AbortController | null>(null);

  // Next can keep this page mounted when it hides it during navigation.
  useLayoutEffect(() => () => {
    activeDownload.current?.abort();
    activeDownload.current = null;
    setDraft(null);
    setFeedback(null);
    setDownloading(false);
  }, []);

  const draftValues = Object.values(draft?.entries ?? {});
  // Keep the stock counts the owner reviewed while there are unsaved entries.
  const worksheet = draft && (draftValues.length > 0 || draft.basedOn === initial) ? draft.worksheet : initial;
  const currentLocation = worksheet.locations.some(({ id }) => id === location) ? location : "";
  const rows = worksheet.rows.filter((row) => !currentLocation || row.location_id === currentLocation);
  const selected = worksheet.rows.flatMap((row) => {
    const quantity = draft?.entries[reorderRowKey(row)] ?? "";
    return orderQuantity(quantity) ? [{
      model_id: row.model_id, location_id: row.location_id,
      in_stock: row.in_stock, min_in_stock: row.min_in_stock, quantity,
    }] : [];
  });
  const invalid = draftValues.some((value) => orderQuantity(value) === null);

  async function download(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeDownload.current || !selected.length) return;
    if (invalid) {
      setLocation("");
      setFeedback({ error: true, text: "Check the highlighted order quantities." });
      return;
    }

    const controller = new AbortController();
    activeDownload.current = controller;
    setDownloading(true);
    setFeedback(null);
    try {
      const response = await fetch("/activity/reorder/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selected),
        signal: controller.signal,
      });
      if (response.redirected) {
        setFeedback({ error: true, text: "Sign in as the owner to download the worksheet." });
        return;
      }
      if (!response.ok) {
        const result = await response.json() as { error?: string; worksheet?: ReorderWorksheet };
        if (response.status === 409 && result.worksheet) {
          const updated = result.worksheet;
          setLocation("");
          setDraft((previous) => {
            const entries = Object.fromEntries(updated.rows.flatMap((row) => {
              const key = reorderRowKey(row);
              const value = previous?.entries[key];
              return value ? [[key, value]] : [];
            }));
            return { worksheet: updated, entries, basedOn: initial };
          });
        }
        setFeedback({ error: true, text: result.error ?? "The worksheet could not be downloaded. Try again." });
        return;
      }
      const filename = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "cornerstock-reorder.xlsx";
      saveFile(await response.blob(), filename);
      setFeedback({ error: false, text: "Excel file downloaded." });
    } catch {
      if (!controller.signal.aborted) {
        setFeedback({ error: true, text: "The worksheet could not be downloaded. Try again." });
      }
    } finally {
      if (activeDownload.current === controller) {
        activeDownload.current = null;
        setDownloading(false);
      }
    }
  }

  return (
    <form onSubmit={download} noValidate>
      <p className="mt-1 text-sm text-muted-foreground">
        Sales from {salesReportPeriodLabel(worksheet.start, worksheet.end)} · Manila time
      </p>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <Field label="Location" className="w-full min-w-0 sm:max-w-64">
          <select className={inputClass} value={currentLocation} onChange={(event) => setLocation(event.target.value)}>
            <option value="">All locations</option>
            {worksheet.locations.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
          </select>
        </Field>
        <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto">
          <p role="status" className="text-sm tabular-nums text-muted-foreground">
            {countFormat.format(selected.length)} {selected.length === 1 ? "line" : "lines"} to export
          </p>
          <button className={buttonClass.action} type="submit" disabled={downloading || !selected.length}>
            <Download className="size-4" aria-hidden="true" />
            {downloading ? "Preparing file…" : "Download Excel"}
          </button>
        </div>
      </div>
      {feedback && (
        <p role={feedback.error ? "alert" : "status"} className={`mt-3 rounded-lg px-3 py-2 text-sm ${feedback.error ? "bg-danger-surface text-destructive" : "bg-ok-surface text-ok"}`}>
          {feedback.text}
        </p>
      )}
      {worksheet.rows.length > 0 && (
        <p className="my-3 text-sm text-muted-foreground">
          Download includes entered quantities from every location. Leaving or reloading clears your entries.
        </p>
      )}
      {rows.length === 0 ? (
        <p className="my-4 rounded-(--radius-card) border border-border px-4 py-6 text-center text-muted-foreground">
          {currentLocation ? "No stock below minimum at this location." : "No stock below minimum at any active location."}
        </p>
      ) : (
        <>
          <div className={`${lineLayout} hidden px-4 pb-2 text-sm font-medium text-muted-foreground sm:grid`} aria-hidden="true">
            <span>Model and weight</span><span>Stock at location</span><span>Balls sold</span><span>Order quantity</span>
          </div>
          <ul aria-label="Low-stock order lines" className="divide-y divide-border rounded-(--radius-card) border border-border bg-card">
            {rows.map((row) => {
              const key = reorderRowKey(row);
              const value = draft?.entries[key] ?? "";
              const invalidQuantity = orderQuantity(value) === null;
              const label = `Order quantity for ${row.model_name}, ${row.weight_lb} lb, at ${row.location_name}`;
              return (
                <li key={key} className={`${lineLayout} items-start gap-y-3 p-4`}>
                  <div className="col-span-2 min-w-0 [overflow-wrap:anywhere] sm:col-span-1">
                    <p className="font-semibold">{row.model_name}</p>
                    <p className="text-sm text-muted-foreground">{row.brand && `${row.brand} · `}{row.weight_lb} lb</p>
                    <p className="text-sm tabular-nums text-muted-foreground">UPC {row.upc}</p>
                  </div>
                  <div className="min-w-0 [overflow-wrap:anywhere]">
                    <p className="text-sm text-muted-foreground">{row.location_name}</p>
                    <p className="mb-1 font-semibold tabular-nums">{countFormat.format(row.in_stock)} in stock</p>
                    <LowMark status={row.in_stock === 0 ? "out" : "low"} minimum={row.min_in_stock} />
                  </div>
                  <p className="min-w-0 text-sm [overflow-wrap:anywhere]">
                    <span className="block font-semibold tabular-nums">{countFormat.format(row.units)}</span>
                    <span className="text-muted-foreground sm:sr-only">Balls sold</span>
                  </p>
                  <div className="col-span-2 grid min-w-0 grid-cols-2 items-center gap-x-3 border-t border-border pt-2 sm:col-span-1 sm:block sm:border-0 sm:pt-0">
                    <label htmlFor={key} className="text-sm font-medium sm:sr-only">Order quantity</label>
                    <input
                      className={`${inputClass} min-w-0 tabular-nums`}
                      id={key}
                      inputMode="numeric"
                      value={value}
                      disabled={downloading}
                      aria-label={label}
                      aria-describedby={`${key}-hint`}
                      aria-invalid={invalidQuantity}
                      onChange={(event) => {
                        const quantity = event.target.value;
                        setDraft((previous) => {
                          const entries = { ...previous?.entries };
                          if (quantity) entries[key] = quantity;
                          else delete entries[key];
                          return Object.keys(entries).length ? { worksheet, entries, basedOn: initial } : null;
                        });
                      }}
                    />
                    <p id={`${key}-hint`} className={`col-span-2 mt-1 text-sm ${invalidQuantity ? "text-destructive" : "text-muted-foreground"}`}>
                      {invalidQuantity ? "Use a whole number of up to 15 digits." : `Gap to minimum: ${row.min_in_stock - row.in_stock}`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </form>
  );
}
