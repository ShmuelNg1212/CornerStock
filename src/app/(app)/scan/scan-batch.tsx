import { Camera, Check, CircleCheck, Copy, Images, LoaderCircle, Tag, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonClass, Field } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { existingBallNotice } from "@/lib/label/batch";
import type { BatchItem } from "./scan-types";

const STATUS: Record<BatchItem["status"], { label: string; className: string; icon: typeof Check; spin?: boolean }> = {
  reading: { label: "Reading", className: "bg-secondary text-muted-foreground", icon: LoaderCircle, spin: true },
  ready: { label: "Ready", className: "bg-ok-surface text-ok", icon: Check },
  needs_details: { label: "Needs a check", className: "bg-warn-surface text-warn", icon: TriangleAlert },
  duplicate: { label: "Already recorded", className: "bg-danger-surface text-destructive", icon: Copy },
  saving: { label: "Saving", className: "bg-secondary text-muted-foreground", icon: LoaderCircle, spin: true },
  saved: { label: "Saved", className: "bg-ok-surface text-ok", icon: CircleCheck },
  selling: { label: "Selling", className: "bg-secondary text-muted-foreground", icon: LoaderCircle, spin: true },
  sold: { label: "Sold", className: "bg-ok-surface text-ok", icon: Tag },
};

/** The batch scan: several label photos, each with its state. */
export function ScanBatch({
  batch,
  message,
  saving,
  locationSelect,
  onCamera,
  onLibrary,
  onOpen,
  onRemove,
  onSell,
  onSaveAll,
  onDone,
  base = "",
}: {
  batch: BatchItem[];
  message: string | null;
  saving: boolean;
  locationSelect: React.ReactNode;
  onCamera: () => void;
  onLibrary: () => void;
  onOpen: (item: BatchItem) => void;
  onRemove: (item: BatchItem) => void;
  onSell: (item: BatchItem) => void;
  onSaveAll: () => void;
  onDone: () => void;
  base?: string;
}) {
  const count = (status: BatchItem["status"]) => batch.filter((item) => item.status === status).length;
  const ready = count("ready");
  const tally = (
    [
      [count("reading"), "reading"],
      [ready, "ready"],
      [count("needs_details"), "to check"],
      [count("duplicate"), "already recorded"],
      [count("saved"), "saved"],
      [count("sold"), "sold"],
    ] as [number, string][]
  )
    .filter(([n]) => n)
    .map(([n, label]) => `${n} ${label}`)
    .join(" · ");

  return (
    <div className="mx-auto max-w-2xl lg:mx-0">
      <h1 className="text-2xl font-bold">Scan several labels</h1>
      <p className="mt-1 text-muted-foreground">
        Add one photo for each label. Balls of a model in the catalog save in one tap. Open the other photos to check them.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={onCamera} className={buttonClass.action}>
          <Camera className="size-5" aria-hidden="true" />
          Take a photo
        </button>
        <button type="button" onClick={onLibrary} className={buttonClass.quiet}>
          <Images className="size-5" aria-hidden="true" />
          Add photos
        </button>
      </div>
      <div className="mt-4">
        <Field label="Location of these balls">{locationSelect}</Field>
      </div>

      {message && (
        <Notice tone="error" className="mt-4">
          {message}
        </Notice>
      )}

      {batch.length > 0 ? (
        <>
          <p role="status" className="tabular mt-6 text-sm font-medium text-muted-foreground">
            {tally}
          </p>
          <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {batch.map((item, index) => (
              <BatchRow key={item.id} item={item} index={index} onOpen={onOpen} onRemove={onRemove} onSell={onSell} disabled={saving} base={base} />
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-6 rounded-xl border border-dashed border-input px-5 py-8 text-center text-muted-foreground">
          No photos yet. Take a photo of the first label, or add photos from the gallery.
        </p>
      )}

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-4 mt-6 flex gap-2 border-t border-border bg-background px-4 py-3 lg:bottom-0 lg:mx-0 lg:px-0">
        <button type="button" onClick={onSaveAll} disabled={saving || !ready} className={`${buttonClass.action} tabular flex-1`}>
          {saving ? "Saving…" : ready ? `Save ${ready} ${ready === 1 ? "ball" : "balls"}` : "Save"}
        </button>
        <button type="button" onClick={onDone} disabled={saving} className={buttonClass.quiet}>
          Done
        </button>
      </div>
    </div>
  );
}

function BatchRow({
  item,
  index,
  onOpen,
  onRemove,
  onSell,
  disabled,
  base,
}: {
  item: BatchItem;
  index: number;
  onOpen: (item: BatchItem) => void;
  onRemove: (item: BatchItem) => void;
  onSell: (item: BatchItem) => void;
  disabled: boolean;
  base: string;
}) {
  const { fields, status } = item;
  const busy = status === "reading" || status === "saving" || status === "selling";
  const notice = item.existingBall ? existingBallNotice(item.existingBall) : null;
  const canSell = status === "duplicate" && (notice?.canSell ?? false);
  // A sale needs two taps, so a tap meant for Open or Remove does not sell a ball.
  const [arming, setArming] = useState(false);
  useEffect(() => {
    if (!arming) return;
    const timer = setTimeout(() => setArming(false), 4000);
    return () => clearTimeout(timer);
  }, [arming]);
  const title = item.known ? `${fields.model_name} · ${fields.nominal_weight_lb} lb` : status === "reading" ? `Photo ${index + 1}` : "Model not in the catalog";
  const { label, className, icon: Icon, spin } = STATUS[status];
  return (
    <li className="flex items-start gap-3 p-3">
      <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-secondary">
        {item.preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.preview} alt="" className="size-full object-cover" />
        ) : (
          <LoaderCircle className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold break-words">{title}</p>
        <p className="tabular font-mono text-sm break-all text-muted-foreground">{fields.serial || (busy ? "…" : "No serial number")}</p>
        {/* The key starts the animation again when the state changes. */}
        <p key={status} className={`mt-1.5 inline-flex animate-mark items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-2 text-xs font-semibold ${className}`}>
          <Icon className={`size-3.5 ${spin ? "animate-spin" : ""}`} aria-hidden="true" />
          {label}
        </p>
        {status === "saved" ? (
          <p className="mt-1 text-sm text-ok">
            In {item.savedTo}
            {item.photoKept === false && ". The label photo was not kept"} ·{" "}
            <Link href={`${base}/balls/${item.ballId}`} className="underline underline-offset-4">
              View
            </Link>
          </p>
        ) : (
          item.message && <p className="mt-1 text-sm text-muted-foreground">{item.message}</p>
        )}
        {(status === "duplicate" || status === "sold") && item.existingBall && notice && (
          <p className="mt-1 text-sm text-muted-foreground">
            {status === "duplicate" && <>{notice.text} </>}
            <Link href={`${base}/balls/${item.existingBall.id}`} className="underline underline-offset-4">
              View the recorded ball
            </Link>
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {canSell && (
          <button
            type="button"
            onClick={() => (arming ? (setArming(false), onSell(item)) : setArming(true))}
            disabled={disabled}
            className={buttonClass.small}
          >
            {arming ? "Tap to confirm" : "Mark sold"}
          </button>
        )}
        {(status === "needs_details" || status === "duplicate" || status === "ready") && (
          <button type="button" onClick={() => onOpen(item)} disabled={disabled} className={buttonClass.small}>
            Open
          </button>
        )}
        {!busy && status !== "saved" && status !== "sold" && (
          <button
            type="button"
            onClick={() => onRemove(item)}
            disabled={disabled}
            aria-label={`Remove photo ${index + 1}`}
            className="grid size-10 place-items-center rounded-lg text-muted-foreground outline-none transition-colors duration-(--dur-fast) hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-60"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        )}
      </div>
    </li>
  );
}
