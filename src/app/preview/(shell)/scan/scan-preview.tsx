"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { startTransition, useState } from "react";
import { ScanBatch } from "@/app/(app)/scan/scan-batch";
import { ScanConfirm } from "@/app/(app)/scan/scan-confirm";
import { ScanReading } from "@/app/(app)/scan/scan-reading";
import { ScanStart } from "@/app/(app)/scan/scan-start";
import { EMPTY, type BatchItem } from "@/app/(app)/scan/scan-types";
import { inputClass } from "@/components/ui/field";
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
  existingBallId: null,
  message: null,
  status,
  ...change,
});
const batch: BatchItem[] = [
  item("31", "saved", { ballId: "b1", savedTo: "Sta. Lucia East", photoKept: true }),
  item("45", "saving"),
  item("52", "ready"),
  item("60", "duplicate", { existingBallId: "b1", message: "A ball with this serial number is already recorded." }),
  item("71", "needs_details", { known: false, fields: { ...EMPTY, serial: "SUPERLONGSERIALNUMBER00000000000001" }, message: "The UPC barcode was not found. Take the photo again, or type the 12 digits below the barcode." }),
  item("88", "reading"),
];
const STEPS = ["start", "saved", "reading", "confirm", "new", "error", "batch", "batch-empty"];
const noop = () => {};

/** The steps of the scan flow with fixture data. Select a step with `?step=`. */
export function ScanPreview() {
  const wanted = useSearchParams().get("step") ?? "start";
  // "confirm": Save shows the saved state, so the move of the label photo into the saved row is visible.
  const [demoSaved, setDemoSaved] = useState(false);
  const step = wanted === "confirm" && demoSaved ? "saved" : wanted;
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
          saved={step === "saved" ? { ballId: "b1", summary: "Phaze II 15 lb · PHZ244107731", location: "Sta. Lucia East", photoKept: true, preview: LABEL } : null}
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
          existingBallId={null}
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
          existingBallId={null}
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
          existingBallId="b1"
          message="Check the marked fields."
        />
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
          onSaveAll={noop}
          onDone={noop}
        />
      )}
    </>
  );
}
