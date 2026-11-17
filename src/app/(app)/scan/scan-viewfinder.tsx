"use client";

import { Check, CircleCheck, Flashlight, FlashlightOff, Focus, Hand, LoaderCircle, Minus, RotateCw, ScanLine, SunDim, TriangleAlert, X, ZoomIn } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { LabelBarcodes } from "@/lib/label/barcodes";
import type { FrameHint } from "@/lib/label/frame-quality";
import type { Saved } from "./scan-types";
import { useViewfinder, type CameraState, type ViewfinderStats } from "./use-viewfinder";

const HINTS: Record<FrameHint, { text: string; icon: typeof Hand }> = {
  aim: { text: "Point the camera at the label", icon: ScanLine },
  hold: { text: "Hold still", icon: Hand },
  glare: { text: "Glare on the label. Tilt the box or move away from the light.", icon: SunDim },
  far: { text: "Move closer, so the label fills the frame.", icon: ZoomIn },
  soft: { text: "Hold the phone still, a little farther away.", icon: Focus },
  align: { text: "Line the phone up with the label.", icon: RotateCw },
  added: { text: "Already added. Point at the next label.", icon: CircleCheck },
};

const round =
  "grid size-12 place-items-center rounded-full bg-rail/80 text-rail-foreground outline-none transition-[background-color,transform] duration-(--dur-fast) hover:bg-rail active:scale-95 focus-visible:ring-3 focus-visible:ring-gold";
// The corners close in when a barcode reads, and lock with a small overshoot when the photo is taken.
const corner = "absolute size-9 transition-[border-color,transform] duration-(--dur-slow) ease-[cubic-bezier(0.34,1.56,0.64,1)]";

/** Shows which barcode is read. A check and a dash, not color alone. */
function CodeMark({ label, read }: { label: string; read: boolean }) {
  const Icon = read ? Check : Minus;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors duration-(--dur-fast) ${
        read ? "bg-ok-surface text-ok" : "bg-white/10 text-rail-foreground/80"
      }`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
      <span className="sr-only">{read ? " read" : " not read"}</span>
    </span>
  );
}

const noSubscribe = () => () => {};
const readDebug = () => new URLSearchParams(window.location.search).get("debug") === "1";

/** The diagnostic panel. It shows only with `?debug=1` in the address. No value leaves the device. */
function DebugPanel({ stats, hint }: { stats: ViewfinderStats | null; hint: FrameHint }) {
  const rows: [string, string][] = stats
    ? [
        ["stream", stats.stream],
        ["frame", stats.frame],
        ["read", `${stats.readMs} ms (avg ${stats.readAvgMs})`],
        ["fps", String(stats.fps)],
        ["sharp", String(stats.sharpness)],
        ["module", stats.moduleSize === null ? "–" : `${stats.moduleSize.toFixed(2)} px`],
        ["codes", stats.read],
        ["window", stats.window],
        ["hint", hint],
        ["captures", String(stats.captures)],
        ["capture", stats.lastCaptureMs === null ? "–" : `${(stats.lastCaptureMs / 1000).toFixed(1)} s`],
      ]
    : [["status", "waiting for a frame"]];
  return (
    <dl
      data-testid="scan-debug"
      className="tabular pointer-events-none absolute bottom-3 left-3 z-10 grid grid-cols-[auto_auto] gap-x-2 rounded-lg bg-black/70 px-2.5 py-2 font-mono text-[11px] leading-4 text-white"
    >
      {rows.map(([name, value]) => (
        <div key={name} className="contents">
          <dt className="text-white/60">{name}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The status of the last count scan, from the parent. It shows in place of the hint. */
export type CountNotice = { key: number; serial: string; text: string; tone: "ok" | "warn" | "checking" };

/**
 * The live camera of the scan. It covers the screen on a phone, like the camera app.
 * Single mode: the first capture goes to the confirm screen. Batch mode: the camera stays
 * open, and each new serial number adds one ball. Count mode: the camera stays open, the
 * serial alone captures, and the parent shows the status of each scan.
 */
export function ScanViewfinder({
  mode,
  saved = null,
  added = 0,
  skipSerials,
  onCapture,
  onClose,
  onTakePhoto,
  onUnavailable,
  base = "",
  title,
  counter,
  notice = null,
}: {
  mode: "single" | "batch" | "count";
  /** Count mode: the title in the top bar. */
  title?: string;
  /** Count mode: the totals at the left of the shutter. */
  counter?: string;
  /** Count mode: the status of the last scan. */
  notice?: CountNotice | null;
  /** Single mode: the ball that the last scan saved. */
  saved?: Saved | null;
  /** Batch mode: the number of photos in the batch. */
  added?: number;
  skipSerials?: readonly string[];
  onCapture: (file: File, codes: LabelBarcodes) => void;
  onClose: () => void;
  /** Opens the phone camera app, as before the viewfinder. */
  onTakePhoto: () => void;
  onUnavailable: (state: Exclude<CameraState, "starting" | "live">) => void;
  base?: string;
}) {
  const [flash, setFlash] = useState<{ key: number; serial: string } | null>(null);
  // The server render has no address, so it gives false. The client then reads the address.
  const debug = useSyncExternalStore(noSubscribe, readDebug, () => false);
  const count = mode === "count";
  const { videoRef, state, hint: frameHint, codes, torch, toggleTorch, shutter, stats } = useViewfinder({
    skipSerials,
    debug,
    mode: count ? "count" : "intake",
    onCapture: (file, codes) => {
      if (mode === "batch" && codes.serial) setFlash({ key: Date.now(), serial: codes.serial });
      onCapture(file, codes);
    },
  });

  useEffect(() => {
    if (state === "unsupported" || state === "denied" || state === "failed") onUnavailable(state);
  }, [state, onUnavailable]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 1600);
    return () => clearTimeout(timer);
  }, [flash]);

  // The page under the camera must not scroll, and a pull must not reload the page.
  useEffect(() => {
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = before;
    };
  }, []);

  const hint =
    frameHint === "glare" && torch.on
      ? { text: "Glare on the label. Turn off the torch or tilt the box.", icon: SunDim }
      : state === "live"
        ? count && frameHint === "added"
          ? { text: "Already counted. Point at the next label.", icon: CircleCheck }
          : HINTS[frameHint]
        : { text: "Starting the camera…", icon: LoaderCircle };
  const HintIcon = hint.icon;
  const someRead = Boolean(codes.upc || codes.serial);
  const captured = count ? notice !== null && notice.tone !== "checking" : flash !== null;
  // Corners: ivory while it looks, gold when a barcode reads, green on a capture.
  const tone = captured ? "border-ok" : someRead ? "border-gold" : "border-white/85";
  const inward = captured ? "scale-[0.86]" : someRead ? "scale-[0.94]" : "";
  // The hint icon is gold for a problem the staff member can fix, so it stands out on the navy tray.
  const hintTone = ["glare", "far", "soft", "align"].includes(frameHint) && state === "live" ? "text-gold" : "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={count ? "Count with the camera" : mode === "batch" ? "Scan several labels with the camera" : "Scan a label with the camera"}
      className="fixed inset-0 z-40 flex h-dvh touch-none flex-col overscroll-none bg-rail text-rail-foreground select-none"
    >
      {/* Top: close, title, torch, on a solid bar, so the controls read over any label. */}
      <div className="relative z-10 flex items-center justify-between gap-3 bg-rail px-3 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2">
        <button type="button" onClick={onClose} aria-label="Close the camera" className={round}>
          <X className="size-6" aria-hidden="true" />
        </button>
        <p className="font-heading min-w-0 truncate text-base font-semibold">{count ? title : mode === "batch" ? "Scan several labels" : "Scan label"}</p>
        {torch.available ? (
          <button
            type="button"
            onClick={() => void toggleTorch()}
            aria-pressed={torch.on}
            aria-label={torch.on ? "Turn off the torch" : "Turn on the torch"}
            className={`${round} ${torch.on ? "bg-gold text-rail hover:bg-gold" : ""}`}
          >
            {torch.on ? <Flashlight className="size-6" aria-hidden="true" /> : <FlashlightOff className="size-6" aria-hidden="true" />}
          </button>
        ) : (
          <span className="size-12" aria-hidden="true" />
        )}
      </div>

      {/* The camera. The reader reads the whole frame, also the parts outside the view. */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black px-6 py-5">
        <video ref={videoRef} muted playsInline autoPlay aria-hidden="true" className="absolute inset-0 size-full object-cover lg:object-contain" />

        {debug && state === "live" && <DebugPanel stats={stats} hint={frameHint} />}

        {saved && mode === "single" && (
          <div role="status" className="absolute inset-x-3 top-3 z-10 flex items-center gap-2.5 rounded-xl bg-ok-surface px-3.5 py-2 text-ok">
            <CircleCheck className="size-5 shrink-0" aria-hidden="true" />
            <p className="min-w-0 flex-1 text-sm">
              <span className="font-semibold">Added to {saved.location}</span>
              <span className="tabular block truncate">{saved.summary}</span>
            </p>
            <Link href={`${base}/balls/${saved.ballId}`} className="inline-flex h-11 shrink-0 items-center px-1.5 text-sm font-semibold underline underline-offset-4">
              View
            </Link>
          </div>
        )}

        {/* The aim frame: the corner bracket of the Cornerstock mark, in the shape of a box label. */}
        <div className="relative aspect-[5/8] h-full max-h-[34rem] max-w-full" aria-hidden="true">
          <span className={`${corner} ${tone} ${inward} top-0 left-0 origin-top-left rounded-tl-lg border-t-4 border-l-4`} />
          <span className={`${corner} ${tone} ${inward} top-0 right-0 origin-top-right rounded-tr-lg border-t-4 border-r-4`} />
          <span className={`${corner} ${tone} ${inward} bottom-0 left-0 origin-bottom-left rounded-bl-lg border-b-4 border-l-4`} />
          <span className={`${corner} ${tone} ${inward} right-0 bottom-0 origin-bottom-right rounded-br-lg border-r-4 border-b-4`} />
        </div>
      </div>

      {/* Bottom tray: the hint, the barcodes, the shutter. */}
      <div className="relative z-10 flex flex-col items-center gap-3 bg-rail px-4 pt-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        <div className="flex min-h-12 w-full max-w-md items-center justify-center">
          {count && notice ? (
            <p
              key={notice.key}
              role="status"
              className={`inline-flex max-w-full items-center gap-2 rounded-full px-4 py-2 font-semibold ${
                notice.tone === "checking" ? "bg-white/10" : `animate-mark ${notice.tone === "ok" ? "bg-ok-surface text-ok" : "bg-warn-surface text-warn"}`
              }`}
            >
              {notice.tone === "checking" ? (
                <LoaderCircle className="size-5 shrink-0 animate-spin" aria-hidden="true" />
              ) : notice.tone === "ok" ? (
                <CircleCheck className="size-5 shrink-0" aria-hidden="true" />
              ) : (
                <TriangleAlert className="size-5 shrink-0" aria-hidden="true" />
              )}
              <span className="tabular shrink-0 font-mono">{notice.serial}</span>
              <span className="min-w-0 truncate">{notice.text}</span>
            </p>
          ) : flash ? (
            <p key={flash.key} role="status" className="inline-flex animate-mark items-center gap-2 rounded-full bg-ok-surface px-4 py-2 font-semibold text-ok">
              <CircleCheck className="size-5 shrink-0" aria-hidden="true" />
              Added <span className="tabular font-mono">{flash.serial}</span>
            </p>
          ) : (
            <p role="status" aria-live="polite" className="flex max-w-sm items-center gap-2.5 font-medium text-pretty">
              <HintIcon className={`size-5 shrink-0 ${hintTone} ${state === "live" ? "" : "animate-spin"}`} aria-hidden="true" />
              {hint.text}
            </p>
          )}
        </div>
        <div className="flex gap-2" aria-label="Barcodes">
          <CodeMark label="Serial" read={Boolean(codes.serial)} />
          {!count && <CodeMark label="UPC" read={Boolean(codes.upc)} />}
        </div>

        <div className="grid w-full max-w-md grid-cols-3 items-center">
          <div className="justify-self-start">
            {mode === "batch" && (
              <p className="tabular text-sm font-semibold">
                {added} {added === 1 ? "ball" : "balls"}
              </p>
            )}
            {count && <p className="tabular text-sm font-semibold">{counter}</p>}
          </div>
          <button
            type="button"
            onClick={() => void shutter()}
            disabled={state !== "live"}
            aria-label="Take the photo now"
            className="grid size-[4.5rem] place-items-center justify-self-center rounded-full border-4 border-white outline-none transition-transform duration-(--dur-fast) active:scale-95 focus-visible:ring-4 focus-visible:ring-gold disabled:opacity-50"
          >
            <span className="size-14 rounded-full bg-white" />
          </button>
          <div className="justify-self-end">
            {mode !== "single" && (
              <button type="button" onClick={onClose} className="h-12 rounded-full bg-white px-5 font-semibold text-rail outline-none active:scale-95 focus-visible:ring-3 focus-visible:ring-gold">
                Done
              </button>
            )}
          </div>
        </div>
        <button type="button" onClick={onTakePhoto} className="h-11 rounded-md px-3 text-sm font-medium text-rail-foreground/85 underline underline-offset-4 outline-none hover:text-rail-foreground focus-visible:ring-3 focus-visible:ring-gold">
          {count ? "Type a serial number" : "Take a photo instead"}
        </button>
      </div>
    </div>
  );
}
