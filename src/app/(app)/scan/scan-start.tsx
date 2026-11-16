import { Camera, CircleCheck, Keyboard, Layers } from "lucide-react";
import Link from "next/link";
import { ViewTransition } from "react";
import { buttonClass } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import type { Saved } from "./scan-types";

const corner = "pointer-events-none absolute size-7 border-primary transition-transform duration-(--dur) ease-out";

/** The first screen of a scan. The camera action is the main element. */
export function ScanStart({
  saved,
  batchAdded,
  onTakePhoto,
  onType,
  onBatch,
  base = "",
}: {
  saved: Saved | null;
  batchAdded: number;
  onTakePhoto: () => void;
  onType: () => void;
  onBatch: () => void;
  base?: string;
}) {
  return (
    <div className="mx-auto max-w-xl lg:mx-0">
      <h1 className="text-2xl font-bold">Scan label</h1>

      {batchAdded > 0 && (
        <Notice tone="ok" className="mt-4 font-semibold">
          Added {batchAdded} {batchAdded === 1 ? "ball" : "balls"} from the batch.
        </Notice>
      )}

      {saved && (
        <div role="status" className="mt-4 flex items-center gap-3.5 rounded-xl border border-ok/30 bg-ok-surface p-3 text-ok">
          <ViewTransition name="label-photo" share="label-morph" default="none">
            <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-ok/30 bg-card">
              {saved.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={saved.preview} alt="" className="size-full object-cover" />
              ) : (
                <CircleCheck className="size-7" aria-hidden="true" />
              )}
            </div>
          </ViewTransition>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 font-semibold">
              <CircleCheck className="size-5 shrink-0" aria-hidden="true" />
              Added to {saved.location}
            </p>
            <p className="tabular break-words">{saved.summary}</p>
            {!saved.photoKept && <p className="mt-0.5 text-sm">The label photo was not kept. The details are saved.</p>}
          </div>
          <Link
            href={`${base}/balls/${saved.ballId}`}
            className="inline-flex h-11 shrink-0 items-center rounded-md px-2 font-medium underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ok/40"
          >
            View
          </Link>
        </div>
      )}

      <button
        type="button"
        onClick={onTakePhoto}
        className="group relative mt-4 flex w-full flex-col items-center rounded-2xl border border-border bg-card px-6 py-10 text-center outline-none transition-[border-color,transform] duration-(--dur-fast) hover:border-primary/50 focus-visible:ring-4 focus-visible:ring-ring/25 active:scale-[0.99] sm:py-14"
      >
        {/* The corners of a camera frame. They are the corner of the Cornerstock mark. */}
        <span className={`${corner} top-4 left-4 rounded-tl-md border-t-4 border-l-4 group-hover:-translate-x-0.5 group-hover:-translate-y-0.5`} aria-hidden="true" />
        <span className={`${corner} top-4 right-4 rounded-tr-md border-t-4 border-r-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5`} aria-hidden="true" />
        <span className={`${corner} bottom-4 left-4 rounded-bl-md border-b-4 border-l-4 group-hover:-translate-x-0.5 group-hover:translate-y-0.5`} aria-hidden="true" />
        <span className={`${corner} right-4 bottom-4 rounded-br-md border-r-4 border-b-4 group-hover:translate-x-0.5 group-hover:translate-y-0.5`} aria-hidden="true" />
        <span className="grid size-18 place-items-center rounded-full bg-action text-action-foreground">
          <Camera className="size-8" aria-hidden="true" />
        </span>
        <span className="font-heading mt-5 text-xl font-semibold">{saved ? "Scan the next label" : "Take a photo of the label"}</span>
        <span className="mt-1.5 max-w-xs text-muted-foreground">
          The white label on the ball box. Hold the phone straight and fill the frame, so the barcodes are sharp.
        </span>
      </button>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={onBatch} className={buttonClass.quiet}>
          <Layers className="size-5" aria-hidden="true" />
          Scan several labels
        </button>
        <button type="button" onClick={onType} className={buttonClass.quiet}>
          <Keyboard className="size-5" aria-hidden="true" />
          Type the details
        </button>
      </div>
    </div>
  );
}
