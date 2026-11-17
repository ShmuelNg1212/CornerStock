"use client";

import { Ban, Camera, CircleCheck, CircleHelp, ClipboardCheck, LoaderCircle, MapPin, RotateCw, Tag, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScanViewfinder, type CountNotice } from "@/app/(app)/scan/scan-viewfinder";
import type { CameraState } from "@/app/(app)/scan/use-viewfinder";
import { buttonClass, Field, inputClass } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import {
  addScan,
  applyScanFailure,
  applyScanResult,
  emptySession,
  scanText,
  type CountApi,
  type CountOpen,
  type CountResult,
  type CountScan,
  type CountSession,
  type ScanStatus,
} from "@/lib/count/session";
import type { LabelBarcodes } from "@/lib/label/barcodes";
import { readLabelPhoto } from "@/lib/label/read-photo";
import type { Location } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Each status has an icon and words. "found" is the only one that agrees with the records. */
export const SCAN_MARK: Record<ScanStatus, { icon: typeof CircleCheck; className: string }> = {
  found: { icon: CircleCheck, className: "bg-ok-surface text-ok" },
  other_location: { icon: MapPin, className: "bg-warn-surface text-warn" },
  sold: { icon: Tag, className: "bg-warn-surface text-warn" },
  removed: { icon: Ban, className: "bg-danger-surface text-destructive" },
  not_recorded: { icon: CircleHelp, className: "bg-warn-surface text-warn" },
};

const noticeOf = (scan: CountScan, key: number): CountNotice => {
  if (scan.state === "checking") return { key, serial: scan.serial, text: "Checking…", tone: "checking" };
  if (scan.state === "failed") return { key, serial: scan.serial, text: scan.error ?? "Not saved", tone: "warn" };
  const text = scan.duplicate ? "Already counted" : scanText({ status: scan.status!, location: scan.location });
  return { key, serial: scan.serial, text, tone: scan.status === "found" || scan.duplicate ? "ok" : "warn" };
};

type CameraProblem = Exclude<CameraState, "starting" | "live">;

/**
 * The stock count of one location (doc/adr/0005-stock-count-rules.md).
 * Start: select the location. Count: the camera reads the serial of each box; a serial can also be typed.
 * Finish: the server compares the scans with the stock and gives the result.
 */
export function CountFlow({
  locations,
  defaultLocationId,
  api,
  onFinished,
}: {
  locations: Location[];
  defaultLocationId: string;
  api: CountApi;
  onFinished: (result: CountResult) => void;
}) {
  const [locationId, setLocationId] = useState(defaultLocationId);
  const [count, setCount] = useState<CountOpen | null>(null);
  const [session, setSession] = useState<CountSession>(emptySession(0));
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<"start" | "finish" | "cancel" | null>(null);
  const [live, setLive] = useState(false);
  const [problem, setProblem] = useState<CameraProblem | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [typed, setTyped] = useState("");
  const [typedError, setTypedError] = useState<string | null>(null);
  const [notice, setNotice] = useState<CountNotice | null>(null);
  const typeInput = useRef<HTMLInputElement>(null);
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  });

  // The camera notice follows the last scan, and goes after a short time.
  const lastKey = useRef(0);
  useEffect(() => {
    if (!notice || notice.tone === "checking") return;
    const timer = setTimeout(() => setNotice(null), 1800);
    return () => clearTimeout(timer);
  }, [notice]);

  const send = useCallback(
    async (text: string): Promise<string | null> => {
      if (!count) return null;
      const { session: next, added, serial, error } = addScan(sessionRef.current, text);
      if (error) return error;
      const key = ++lastKey.current;
      if (!added) {
        setNotice({ key, serial: serial!, text: "Already counted", tone: "ok" });
        return null;
      }
      sessionRef.current = next;
      setSession(next);
      setNotice(noticeOf(next.scans[0], key));
      const reply = await api.scan(count.id, serial!);
      setSession((current) => (reply.ok ? applyScanResult(current, reply.value) : applyScanFailure(current, serial!, reply.error)));
      // Only the newest scan owns the camera notice.
      if (lastKey.current === key) {
        const done: CountScan = reply.ok
          ? { serial: serial!, state: "done", status: reply.value.status, duplicate: reply.value.duplicate, location: reply.value.location }
          : { serial: serial!, state: "failed", error: reply.error };
        setNotice(noticeOf(done, key));
      }
      if (reply.ok && reply.value.status === "found" && !reply.value.duplicate) navigator.vibrate?.(30);
      return null;
    },
    [api, count],
  );

  const onCapture = useCallback(
    async (file: File, codes: LabelBarcodes) => {
      // The shutter gives no live code. The photo read then looks for the serial.
      const serial = codes.serial ?? (await readLabelPhoto(file).catch(() => null))?.serial ?? null;
      if (!serial) {
        setNotice({ key: ++lastKey.current, serial: "—", text: "No serial number in the photo", tone: "warn" });
        return;
      }
      await send(serial);
    },
    [send],
  );

  const onUnavailable = useCallback((state: CameraProblem) => {
    setProblem(state);
    setLive(false);
  }, []);

  async function start() {
    if (!locationId) {
      setMessage("Select a location.");
      return;
    }
    setBusy("start");
    setMessage(null);
    const reply = await api.start(locationId);
    setBusy(null);
    if (!reply.ok) {
      setMessage(reply.error);
      return;
    }
    setCount(reply.value);
    setSession(emptySession(reply.value.expected, reply.value.scanned));
    setLive(!problem);
  }

  async function finish() {
    if (!count) return;
    setBusy("finish");
    setMessage(null);
    const reply = await api.finish(count.id);
    setBusy(null);
    if (!reply.ok) {
      setMessage(reply.error);
      setConfirmFinish(false);
      return;
    }
    onFinished(reply.value);
  }

  async function cancel() {
    if (!count) return;
    setBusy("cancel");
    const reply = await api.cancel(count.id);
    setBusy(null);
    if (!reply.ok) {
      setMessage(reply.error);
      return;
    }
    setCount(null);
    setSession(emptySession(0));
    setConfirmFinish(false);
  }

  if (!count) {
    return (
      <section aria-labelledby="count-start" className="rounded-(--radius-card) bg-card p-5 shadow-(--shadow-card) sm:p-6">
        <h2 id="count-start" className="font-heading flex items-center gap-2.5 text-xl font-semibold">
          <ClipboardCheck className="size-6 text-action" aria-hidden="true" />
          Count stock
        </h2>
        <p className="mt-1.5 max-w-prose text-muted-foreground">
          Scan the label of each ball box in one location. At the finish, the app shows the balls that are missing and the balls that
          are not expected here. The count itself changes no stock.
        </p>
        <Field label="Location" className="mt-5 max-w-sm">
          <select value={locationId} onChange={(event) => setLocationId(event.target.value)} className={inputClass}>
            {!locationId && <option value="">Select a location</option>}
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </Field>
        {message && (
          <Notice tone="error" className="mt-4 max-w-sm">
            {message}
          </Notice>
        )}
        <button type="button" onClick={() => void start()} disabled={busy !== null} className={`${buttonClass.action} mt-5`}>
          {busy === "start" ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <Camera className="size-5" aria-hidden="true" />}
          Start the count
        </button>
        <p className="mt-3 text-sm text-muted-foreground">Staff on other phones who start a count here join the same count.</p>
      </section>
    );
  }

  const counter = `${session.scanned} of ${session.expected}`;
  return (
    <>
      {live && (
        <ScanViewfinder
          mode="count"
          title={`Count · ${count.location}`}
          counter={counter}
          notice={notice}
          skipSerials={session.scans.filter((s) => s.state !== "failed").map((s) => s.serial)}
          onCapture={(file, codes) => void onCapture(file, codes)}
          onClose={() => setLive(false)}
          onTakePhoto={() => {
            setLive(false);
            // The input shows after the camera closes.
            setTimeout(() => typeInput.current?.focus(), 0);
          }}
          onUnavailable={onUnavailable}
        />
      )}

      <section aria-labelledby="count-open" className="rounded-(--radius-card) bg-card p-5 shadow-(--shadow-card) sm:p-6">
        <p className="text-sm font-medium text-muted-foreground">Counting</p>
        <h2 id="count-open" className="font-heading text-xl font-semibold break-words">
          {count.location}
        </h2>
        <p role="status" className="tabular mt-3 flex items-baseline gap-1.5">
          <b className="font-heading text-3xl font-bold">{session.scanned}</b>
          <span className="text-muted-foreground">
            scanned of {session.expected} in stock here
          </span>
        </p>

        {problem && (
          <Notice tone="warn" className="mt-4">
            The camera is not available on this device. Type each serial number below.
          </Notice>
        )}

        <div className="mt-5 flex flex-wrap gap-2.5">
          {!problem && (
            <button type="button" onClick={() => setLive(true)} className={buttonClass.primary}>
              <Camera className="size-5" aria-hidden="true" />
              Scan with the camera
            </button>
          )}
        </div>

        <form
          className="mt-5 flex max-w-md items-start gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void send(typed).then((error) => {
              setTypedError(error);
              if (!error) setTyped("");
            });
          }}
        >
          <Field label="Serial number" error={typedError ?? undefined} hint="For a damaged label." className="min-w-0 flex-1">
            <input
              ref={typeInput}
              value={typed}
              onChange={(event) => setTyped(event.target.value.slice(0, 40))}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              aria-invalid={typedError ? true : undefined}
              className={cn(inputClass, "font-mono uppercase")}
            />
          </Field>
          <button type="submit" className={`${buttonClass.quiet} mt-6.5 shrink-0`}>
            Add
          </button>
        </form>

        {message && (
          <Notice tone="error" className="mt-4">
            {message}
          </Notice>
        )}

        <div className="mt-6 border-t border-border pt-5">
          {confirmFinish ? (
            <div className="flex flex-col gap-3">
              <p className="font-medium">
                Finish the count of {count.location}? The app then compares {session.scanned} scanned with {session.expected} in stock.
              </p>
              <div className="flex flex-wrap gap-2.5">
                <button type="button" onClick={() => void finish()} disabled={busy !== null} className={buttonClass.action}>
                  {busy === "finish" && <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />}
                  Finish and compare
                </button>
                <button type="button" onClick={() => setConfirmFinish(false)} disabled={busy !== null} className={buttonClass.quiet}>
                  Continue counting
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2.5">
              <button type="button" onClick={() => setConfirmFinish(true)} className={buttonClass.action}>
                Finish the count
              </button>
              <button type="button" onClick={() => void cancel()} disabled={busy !== null} className={buttonClass.quiet}>
                {busy === "cancel" && <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />}
                Cancel the count
              </button>
            </div>
          )}
        </div>
      </section>

      {session.scans.length > 0 && (
        <section aria-labelledby="count-scans" className="mt-5">
          <h2 id="count-scans" className="text-sm font-semibold text-muted-foreground">
            Scanned on this device
          </h2>
          <ul className="mt-2 divide-y divide-border overflow-hidden rounded-(--radius-card) bg-card shadow-(--shadow-card)">
            {session.scans.map((scan) => (
              <ScanRow key={scan.serial} scan={scan} onRetry={() => void send(scan.serial)} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function ScanRow({ scan, onRetry }: { scan: CountScan; onRetry: () => void }) {
  const mark = scan.state === "done" ? SCAN_MARK[scan.status!] : null;
  const Icon = scan.state === "checking" ? LoaderCircle : scan.state === "failed" ? TriangleAlert : mark!.icon;
  const text =
    scan.state === "checking" ? "Checking…" : scan.state === "failed" ? (scan.error ?? "Not saved") : scanText({ status: scan.status!, location: scan.location });
  return (
    <li className="flex animate-enter items-center gap-3 px-4 py-3">
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full",
          scan.state === "checking" ? "bg-muted text-muted-foreground" : scan.state === "failed" ? "bg-danger-surface text-destructive" : mark!.className,
        )}
      >
        <Icon className={cn("size-5", scan.state === "checking" && "animate-spin")} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="tabular truncate font-mono font-semibold">{scan.serial}</p>
        <p className="truncate text-sm text-muted-foreground">
          {[scan.model, text].filter(Boolean).join(" · ")}
        </p>
      </div>
      {scan.state === "failed" && (
        <button type="button" onClick={onRetry} className={buttonClass.small}>
          <RotateCw className="size-4" aria-hidden="true" />
          Try again
        </button>
      )}
    </li>
  );
}
