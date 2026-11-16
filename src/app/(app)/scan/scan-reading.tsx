import { LoaderCircle } from "lucide-react";

/** Shown while the app reads the barcodes of one photo. */
export function ScanReading({ preview }: { preview: string | null }) {
  return (
    <div className="mx-auto max-w-xl lg:mx-0">
      <h1 className="text-2xl font-bold">Scan label</h1>
      <div role="status" className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
        <LoaderCircle className="size-6 shrink-0 animate-spin text-action" aria-hidden="true" />
        <p className="font-medium">Reading the barcodes…</p>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {preview && <img src={preview} alt="" className="mt-4 max-h-80 animate-pulse-soft rounded-xl border border-border" />}
    </div>
  );
}
