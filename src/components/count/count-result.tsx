"use client";

import { ArrowDownToLine, Ban, Check, ChevronDown, CircleCheck, CircleHelp, LoaderCircle, MapPin, PackageSearch, Plus, Tag, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { buttonClass, inputClass } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { groupResult, kindText, modelText, type CountApi, type CountLine, type CountResult } from "@/lib/count/session";
import { when } from "@/lib/format";
import { cn } from "@/lib/utils";

const KIND_ICON = { other_location: MapPin, sold: Tag, removed: Ban, not_recorded: CircleHelp } as const;

/**
 * The result of a finished count, and one correction for each line (doc/adr/0005-stock-count-rules.md).
 * The server decides which correction the current stock allows. Owner-only corrections show as text to staff.
 */
export function CountResultView({ initial, isOwner, api, base = "" }: { initial: CountResult; isOwner: boolean; api: CountApi; base?: string }) {
  const [result, setResult] = useState(initial);
  const groups = groupResult(result.lines);
  const tiles = [
    { label: "Found", value: result.found, icon: CircleCheck, tone: "bg-ok-surface text-ok" },
    { label: "Missing", value: result.missing, icon: PackageSearch, tone: result.missing ? "bg-danger-surface text-destructive" : "bg-muted text-muted-foreground" },
    { label: "Unexpected", value: result.unexpected, icon: CircleHelp, tone: result.unexpected ? "bg-warn-surface text-warn" : "bg-muted text-muted-foreground" },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold text-balance break-words">Count of {result.location}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Finished {when(result.finished_at)}
          {result.finished_by && ` by ${result.finished_by}`}
          {result.started_by && result.started_by !== result.finished_by && ` · started by ${result.started_by}`}
        </p>
      </header>

      <dl className="grid grid-cols-3 divide-x divide-border rounded-(--radius-card) bg-card py-3 shadow-(--shadow-card)">
        {tiles.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="flex flex-col-reverse items-center gap-1 px-2 text-center">
            <dt className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <span className={cn("grid size-6 shrink-0 place-items-center rounded-full", tone)}>
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
              {label}
            </dt>
            <dd className="font-heading tabular text-3xl leading-none font-bold">{value}</dd>
          </div>
        ))}
      </dl>

      {groups.open > 0 ? (
        <Notice tone="warn">
          {groups.open} {groups.open === 1 ? "line needs" : "lines need"} a correction. Each correction changes the stock and shows in the activity log.
        </Notice>
      ) : groups.stuck > 0 ? (
        <Notice tone="warn">
          {groups.stuck} {groups.stuck === 1 ? "ball recorded as removed is" : "balls recorded as removed are"} on the shelf. The count cannot correct
          this. Tell the owner.
        </Notice>
      ) : (
        <Notice tone="ok">{result.missing + result.unexpected === 0 ? "The shelf agrees with the records." : "The stock now agrees with this count."}</Notice>
      )}

      {groups.missing.length > 0 && (
        <LineSection id="missing" title="Missing" note="In stock here in the records, but not scanned.">
          {groups.missing.map((line) => (
            <LineRow key={line.serial} line={line} result={result} isOwner={isOwner} api={api} base={base} onResult={setResult} />
          ))}
        </LineSection>
      )}

      {groups.unexpected.length > 0 && (
        <LineSection id="unexpected" title="Unexpected" note="Scanned here, but not in stock here in the records.">
          {groups.unexpected.map((line) => (
            <LineRow key={line.serial} line={line} result={result} isOwner={isOwner} api={api} base={base} onResult={setResult} />
          ))}
        </LineSection>
      )}

      {groups.found.length > 0 && (
        <details className="group rounded-(--radius-card) bg-card shadow-(--shadow-card)">
          <summary className="flex min-h-13 cursor-pointer list-none items-center gap-2 px-4 font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/40 [&::-webkit-details-marker]:hidden">
            <CircleCheck className="size-5 text-ok" aria-hidden="true" />
            Found <span className="tabular text-muted-foreground">({groups.found.length})</span>
            <ChevronDown className="ml-auto size-5 transition-transform duration-(--dur-fast) group-open:rotate-180" aria-hidden="true" />
          </summary>
          <ul className="divide-y divide-border border-t border-border">
            {groups.found.map((line) => (
              <li key={line.serial} className="px-4 py-2.5">
                <p className="tabular truncate font-mono text-sm font-semibold">{line.serial}</p>
                {modelText(line) && <p className="truncate text-sm text-muted-foreground">{modelText(line)}</p>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function LineSection({ id, title, note, children }: { id: string; title: string; note: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`count-${id}`}>
      <h2 id={`count-${id}`} className="font-heading text-lg font-semibold">
        {title}
      </h2>
      <p className="text-sm text-muted-foreground">{note}</p>
      <ul className="mt-2 divide-y divide-border overflow-hidden rounded-(--radius-card) bg-card shadow-(--shadow-card)">{children}</ul>
    </section>
  );
}

function LineRow({
  line,
  result,
  isOwner,
  api,
  base,
  onResult,
}: {
  line: CountLine;
  result: CountResult;
  isOwner: boolean;
  api: CountApi;
  base: string;
  onResult: (result: CountResult) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  // One request id for each correction. A second tap of the same correction changes nothing.
  // A line can need a second correction (put back, then move here), so a success makes a new id.
  const requestId = useRef<string | null>(null);

  const Icon = line.outcome === "missing" ? PackageSearch : KIND_ICON[line.kind!];
  const detail = line.outcome === "missing" ? "Not scanned" : kindText(line);

  async function run(withReason: string | null = null) {
    setBusy(true);
    setError(null);
    requestId.current ??= crypto.randomUUID();
    const reply = await api.correct(result.id, line.serial, requestId.current, withReason);
    setBusy(false);
    if (reply.ok) {
      requestId.current = null;
      setAsking(false);
      onResult(reply.value);
    } else setError(reply.error);
  }

  let action: React.ReactNode = null;
  if (line.corrected) {
    action = (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-surface px-2.5 py-1 text-sm font-medium text-ok">
        <Check className="size-4" aria-hidden="true" />
        Resolved
      </span>
    );
  } else if (line.action === "move") {
    action = (
      <button type="button" onClick={() => void run()} disabled={busy} className={buttonClass.small}>
        {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <ArrowDownToLine className="size-4" aria-hidden="true" />}
        Move here
      </button>
    );
  } else if (line.action === "remove") {
    action = isOwner ? (
      <button type="button" onClick={() => void run()} disabled={busy} className={buttonClass.small}>
        {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Ban className="size-4" aria-hidden="true" />}
        Mark removed
      </button>
    ) : (
      <span className="text-sm text-muted-foreground">The owner can mark it removed</span>
    );
  } else if (line.action === "put_back") {
    action = isOwner ? (
      !asking && (
        <button type="button" onClick={() => setAsking(true)} disabled={busy} className={buttonClass.small}>
          <Undo2 className="size-4" aria-hidden="true" />
          Put back in stock
        </button>
      )
    ) : (
      <span className="text-sm text-muted-foreground">The owner can put it back</span>
    );
  } else if (line.action === "add") {
    action = (
      <Link href={`${base}/scan`} className={buttonClass.small}>
        <Plus className="size-4" aria-hidden="true" />
        Add
      </Link>
    );
  }

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full",
            line.corrected ? "bg-ok-surface text-ok" : line.outcome === "missing" ? "bg-danger-surface text-destructive" : "bg-warn-surface text-warn",
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 basis-40">
          <p className="tabular truncate font-mono font-semibold">{line.serial}</p>
          <p className="text-sm break-words text-muted-foreground">{[modelText(line), detail].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="ml-12 shrink-0 sm:ml-0">{action}</div>
      </div>
      {asking && !line.corrected && (
        <form
          className="mt-3 flex flex-wrap items-end gap-2 sm:ml-12"
          onSubmit={(event) => {
            event.preventDefault();
            void run(reason);
          }}
        >
          <label className="min-w-0 flex-1 basis-48">
            <span className="mb-1.5 block text-sm font-medium">Reason</span>
            <input value={reason} onChange={(event) => setReason(event.target.value.slice(0, 120))} required placeholder="For example: the sale was cancelled" className={inputClass} />
          </label>
          <button type="submit" disabled={busy || !reason.trim()} className={buttonClass.primary}>
            {busy && <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />}
            Put back
          </button>
          <button type="button" onClick={() => setAsking(false)} disabled={busy} className={buttonClass.quiet}>
            Cancel
          </button>
        </form>
      )}
      {error && (
        <Notice tone="error" className="mt-3 sm:ml-12">
          {error}
        </Notice>
      )}
    </li>
  );
}
