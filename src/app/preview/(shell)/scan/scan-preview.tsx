"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { startTransition, useState } from "react";
import { ScanBatch } from "@/app/(app)/scan/scan-batch";
import { ScanConfirm } from "@/app/(app)/scan/scan-confirm";
import { ScanReading } from "@/app/(app)/scan/scan-reading";
import { ScanStart } from "@/app/(app)/scan/scan-start";
import { ScanViewfinder } from "@/app/(app)/scan/scan-viewfinder";
import { EMPTY, type BatchItem } from "@/app/(app)/scan/scan-types";
import { inputClass } from "@/components/ui/field";
import { readLabelPhoto } from "@/lib/label/read-photo";
import { locations } from "../../fixtures";

const LABEL = "/preview-label.jpg";
const known = { ...EMPTY, serial: "PHZ244107731", upc: "836185012345", model_name: "Phaze II", nominal_weight_lb: "15", brand: "Storm", color: "Red / Blue / Purple", product_code: "BBMTLZ15" };
const item = (id: string, status: BatchItem["status"], change: Partial<BatchItem> = {}): BatchItem => ({
  id,
  preview: status === "reading" ? null : LABEL,
  photo: null,
  fields: status === "reading" ? EMPTY : { ...known, serial: `PHZ2441077${id}` },
  known: status !== "reading",
  unread: [],
  existingBall: null,
  message: null,
  status,
  ...change,
});
const batch: BatchItem[] = [
  item("31", "saved", { ballId: "b1", savedTo: "Sta. Lucia East", photoKept: true }),
  item("45", "saving"),
  item("52", "ready"),
  item("60", "duplicate", { existingBall: { id: "b1", status: "in_stock", location: "Sta. Lucia East" } }),
  item("63", "duplicate", { existingBall: { id: "b1", status: "sold", location: "Sta. Lucia East" } }),
  item("66", "sold", { existingBall: { id: "b1", status: "sold", location: "Sta. Lucia East" } }),
  item("71", "needs_details", { known: false, fields: { ...EMPTY, serial: "SUPERLONGSERIALNUMBER00000000000001" }, message: "The UPC barcode was not found. Take the photo again, or type the 12 digits below the barcode." }),
  item("88", "reading"),
];
const STEPS = ["start", "saved", "reading", "confirm", "new", "error", "in-stock", "batch", "batch-empty", "viewfinder", "viewfinder-batch"];
const noop = () => {};

/** The steps of the scan flow with fixture data. Select a step with `?step=`. */
export function ScanPreview() {
  const wanted = useSearchParams().get("step") ?? "start";
  // "confirm": Save shows the saved state, so the move of the label photo into the saved row is visible.
  const [demoSaved, setDemoSaved] = useState(false);
  const step = wanted === "confirm" && demoSaved ? "saved" : wanted;
  // "viewfinder": the live camera with the real frame reader. A capture runs the real photo read.
  // The catalog lookup and the save need a sign-in, so the preview shows the barcodes only.
  const [shot, setShot] = useState<{ preview: string; serial: string; upc: string } | null>(null);
  const [shots, setShots] = useState<string[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const select = (
    <select className={inputClass} defaultValue={locations[0].id}>
      {locations.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name}
        </option>
      ))}
    </select>
  );
  const confirm = { locationSelect: select, onField: noop, onShowModel: noop, onSave: async () => true, onRetake: noop, onCancel: noop, base: "/preview", saving: false, fromBatch: false, canRetake: true, preview: LABEL };
  return (
    <>
      <p className="mb-4 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
        {STEPS.map((name) => (
          <Link key={name} href={`/preview/scan?step=${name}`} className={name === step ? "font-semibold text-foreground" : "underline"}>
            {name}
          </Link>
        ))}
      </p>
      {(step === "start" || step === "saved") && (
        <ScanStart
          base="/preview"
          saved={step === "saved" ? { ballId: "b1", serial: "PHZ244107731", summary: "Phaze II 15 lb · PHZ244107731", location: "Sta. Lucia East", photoKept: true, preview: LABEL } : null}
          batchAdded={0}
          onTakePhoto={noop}
          onType={noop}
          onBatch={noop}
        />
      )}
      {step === "reading" && <ScanReading preview={LABEL} />}
      {step === "confirm" && (
        <ScanConfirm
          {...confirm}
          onSave={async () => {
            startTransition(() => setDemoSaved(true));
            return true;
          }}
          fields={known}
          errors={{}}
          unread={[]}
          knownModel
          editModel={false}
          existingBall={null}
          message={null}
        />
      )}
      {step === "new" && (
        <ScanConfirm
          {...confirm}
          fields={{ ...EMPTY, upc: "836185099999" }}
          errors={{}}
          unread={["serial"]}
          knownModel={false}
          editModel
          existingBall={null}
          message="The serial number barcode was not found. Take the photo again, or type the serial number."
        />
      )}
      {step === "error" && (
        <ScanConfirm
          {...confirm}
          fields={{ ...known, gross_weight: "15 lbs", top_weight: "99" }}
          errors={{ gross_weight: "Write the weight as pounds and ounces, for example 15 lb 4 oz.", top_weight: "Write a number from 0 to 10." }}
          unread={[]}
          knownModel
          editModel={false}
          existingBall={{ id: "b1", status: "sold", location: "Sta. Lucia East" }}
          message="Check the marked fields."
        />
      )}
      {step === "in-stock" && (
        <ScanConfirm
          {...confirm}
          fields={known}
          errors={{}}
          unread={[]}
          knownModel
          editModel={false}
          existingBall={{ id: "b1", status: "in_stock", location: "Sta. Lucia East" }}
          message={null}
        />
      )}
      {step === "viewfinder" && !shot && !problem && (
        <ScanViewfinder
          mode="single"
          base="/preview"
          onCapture={async (file) => {
            const codes = await readLabelPhoto(file).catch(() => null);
            setShot({ preview: URL.createObjectURL(file), serial: codes?.serial ?? "", upc: codes?.upc ?? "" });
          }}
          onClose={() => setProblem("closed")}
          onTakePhoto={noop}
          onUnavailable={setProblem}
        />
      )}
      {step === "viewfinder" && problem && <p data-testid="camera-problem">Camera: {problem}</p>}
      {step === "viewfinder" && shot && (
        <ScanConfirm
          {...confirm}
          preview={shot.preview}
          fields={{ ...EMPTY, serial: shot.serial, upc: shot.upc }}
          errors={{}}
          unread={[]}
          knownModel={false}
          editModel
          existingBall={null}
          message={null}
        />
      )}
      {step === "viewfinder-batch" && (
        <>
          <ScanViewfinder
            mode="batch"
            base="/preview"
            added={shots.length}
            skipSerials={shots}
            onCapture={(_, codes) => codes.serial && setShots((list) => [...list, codes.serial!])}
            onClose={noop}
            onTakePhoto={noop}
            onUnavailable={setProblem}
          />
          <ul data-testid="batch-serials">
            {shots.map((serial) => (
              <li key={serial}>{serial}</li>
            ))}
          </ul>
        </>
      )}
      {(step === "batch" || step === "batch-empty") && (
        <ScanBatch
          base="/preview"
          batch={step === "batch" ? batch : []}
          message={null}
          saving={false}
          locationSelect={select}
          onCamera={noop}
          onLibrary={noop}
          onOpen={noop}
          onRemove={noop}
          onSell={noop}
          onSaveAll={noop}
          onDone={noop}
        />
      )}
    </>
  );
}
