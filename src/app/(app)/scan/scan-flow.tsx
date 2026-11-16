"use client";

import { Camera, CircleCheck, Keyboard, LoaderCircle, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { lookupLabel, receiveBall } from "@/app/actions";
import { buttonClass, Field, inputClass } from "@/components/ui/field";
import { readLabelPhoto } from "@/lib/label/read-photo";
import { LABEL_FIELDS, validateLabel, type LabelErrors, type LabelField, type RawLabel } from "@/lib/label/rules";
import { createClient } from "@/lib/supabase/client";
import type { Location } from "@/lib/types";

type Step = "start" | "reading" | "confirm";
type Saved = { ballId: string; summary: string; location: string; photoKept: boolean };

const EMPTY: RawLabel = Object.fromEntries(LABEL_FIELDS.map((f) => [f, ""]));

const BALL_FIELDS: { field: LabelField; label: string; hint?: string; mode?: "decimal" | "numeric"; mono?: boolean }[] = [
  { field: "serial", label: "Serial number", mono: true },
  { field: "gross_weight", label: "Gross weight", hint: "15 lb 4 oz" },
  { field: "top_weight", label: "Top weight", mode: "decimal" },
  { field: "pin_distance", label: "Pin distance", hint: "3-3.5" },
  { field: "boxed_on", label: "Boxed on", hint: "month/day/year" },
];
const MODEL_FIELDS: typeof BALL_FIELDS = [
  { field: "upc", label: "UPC", hint: "12 digits", mode: "numeric", mono: true },
  { field: "model_name", label: "Model" },
  { field: "nominal_weight_lb", label: "Ball weight (lb)", mode: "numeric" },
  { field: "brand", label: "Brand" },
  { field: "color", label: "Color" },
  { field: "fragrance", label: "Fragrance" },
  { field: "coverstock", label: "Coverstock" },
  { field: "weight_block", label: "Weight block" },
  { field: "finish", label: "Finish" },
  { field: "rg", label: "RG", mode: "decimal" },
  { field: "diff", label: "Diff", mode: "decimal" },
  { field: "mass_bias", label: "Mass bias", mode: "decimal" },
  { field: "product_code", label: "Product code", mono: true },
];

/** Makes the photo smaller before the upload. A phone photo is 3 to 12 MB; the label needs much less. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

export function ScanFlow({ locations, defaultLocationId }: { locations: Location[]; defaultLocationId: string }) {
  const [step, setStep] = useState<Step>("start");
  const [fields, setFields] = useState<RawLabel>(EMPTY);
  const [errors, setErrors] = useState<LabelErrors>({});
  const [unread, setUnread] = useState<LabelField[]>([]);
  const [knownModel, setKnownModel] = useState(false);
  const [editModel, setEditModel] = useState(false);
  const [existingBallId, setExistingBallId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState(defaultLocationId || (locations.length === 1 ? locations[0].id : ""));
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const photo = useRef<Blob | null>(null);
  // One request id for each ball. A second tap on Save, or a retry after a lost
  // connection, sends the same id, and the database then adds the ball one time only.
  const requestId = useRef("");
  const fileInput = useRef<HTMLInputElement>(null);
  const firstError = useRef<HTMLDivElement>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  function begin(next: Step) {
    requestId.current = crypto.randomUUID();
    setErrors({});
    setMessage(null);
    setExistingBallId(null);
    setSaved(null);
    setStep(next);
  }

  function reset() {
    photo.current = null;
    setPreview(null);
    setFields(EMPTY);
    setUnread([]);
    setKnownModel(false);
    setEditModel(false);
    setStep("start");
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    begin("reading");
    setPreview(URL.createObjectURL(file));
    // Read the barcodes from the full photo. Keep a smaller copy as the record of the label.
    const [codes, small] = await Promise.all([
      readLabelPhoto(file).catch(() => null),
      shrink(file),
    ]);
    photo.current = small;

    const next: RawLabel = { ...EMPTY, upc: codes?.upc ?? "", serial: codes?.serial ?? "", product_code: codes?.product_code ?? "" };
    let known = false;
    if (codes?.upc || codes?.serial) {
      try {
        const lookup = await lookupLabel({ upc: codes.upc, serial: codes.serial });
        if (lookup.model) {
          Object.assign(next, lookup.model);
          known = true;
        }
        setExistingBallId(lookup.existingBallId);
      } catch {
        setMessage("The catalog was not checked. Check the connection. You can continue and type the details.");
      }
    }

    if (!codes) {
      setMessage("The photo could not be read on this device. Type the details.");
    } else if (!codes.upc && !codes.serial) {
      setMessage("No barcode was found in the photo. Take the photo again, closer and straight, or type the details.");
    } else if (!codes.serial) {
      setMessage("The serial number barcode was not found. Take the photo again, or type the serial number.");
    } else if (!codes.upc) {
      setMessage("The UPC barcode was not found. Take the photo again, or type the 12 digits below the barcode.");
    }

    setFields(next);
    setKnownModel(known);
    setEditModel(!known);
    setUnread((["serial", "upc"] as LabelField[]).filter((f) => !next[f]));
    setStep("confirm");
  }

  async function save() {
    const check = validateLabel(fields);
    if (!locationId) {
      setMessage("Select the location of this ball.");
      return;
    }
    if (!check.value) {
      setErrors(check.errors);
      if (!editModel && MODEL_FIELDS.some((f) => check.errors[f.field])) setEditModel(true);
      setMessage("Check the marked fields.");
      requestAnimationFrame(() => firstError.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      // The photo is a record of the label. A failed upload does not stop the save.
      let photoPath: string | null = null;
      if (photo.current) {
        const path = `${requestId.current}.jpg`;
        const upload = await createClient().storage.from("labels").upload(path, photo.current, { contentType: "image/jpeg", upsert: false });
        if (!upload.error || upload.error.message.toLowerCase().includes("exists")) photoPath = path;
      }
      const result = await receiveBall({ label: fields, locationId, requestId: requestId.current, photoPath });
      if (result.ok) {
        setSaved({
          ballId: result.ballId,
          summary: `${check.value.model_name} ${check.value.nominal_weight_lb} lb · ${check.value.serial}`,
          location: locations.find((l) => l.id === locationId)?.name ?? "",
          photoKept: photoPath !== null || photo.current === null,
        });
        reset();
      } else {
        setMessage(result.error);
        setErrors(result.fieldErrors ?? {});
        setExistingBallId(result.existingBallId ?? null);
      }
    } catch {
      setMessage("The ball was not saved. Check the connection, then tap Save again.");
    } finally {
      setSaving(false);
    }
  }

  const camera = (
    <input
      ref={fileInput}
      type="file"
      accept="image/*"
      capture="environment"
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(event) => {
        void onPhoto(event.target.files?.[0]);
        event.target.value = "";
      }}
    />
  );

  if (step === "start") {
    return (
      <>
        <h1 className="text-2xl font-bold">Scan label</h1>
        {saved && (
          <div role="status" className="mt-4 flex items-start gap-3 rounded-xl bg-ok-surface p-4 text-ok">
            <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-semibold">Added to {saved.location}</p>
              <p className="break-words">{saved.summary}</p>
              {!saved.photoKept && <p className="mt-1 text-sm">The label photo was not kept. The details are saved.</p>}
              <Link href={`/balls/${saved.ballId}`} className="mt-1 inline-flex h-10 items-center font-medium underline underline-offset-4">
                View this ball
              </Link>
            </div>
          </div>
        )}
        <div className="mt-4 rounded-xl border border-border bg-card p-5">
          <p className="text-muted-foreground">
            Take a photo of the white label on the ball box. Hold the phone straight and fill the frame with the label, so the barcodes are sharp.
          </p>
          {camera}
          <button type="button" onClick={() => fileInput.current?.click()} className={`${buttonClass.action} mt-4 h-14 w-full text-lg`}>
            <Camera className="size-6" aria-hidden="true" />
            {saved ? "Scan the next label" : "Take a photo of the label"}
          </button>
          <button
            type="button"
            onClick={() => {
              begin("confirm");
              setEditModel(true);
            }}
            className={`${buttonClass.quiet} mt-2 w-full`}
          >
            <Keyboard className="size-5" aria-hidden="true" />
            Type the details
          </button>
        </div>
      </>
    );
  }

  if (step === "reading") {
    return (
      <>
        <h1 className="text-2xl font-bold">Scan label</h1>
        <div role="status" className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-card p-5">
          <LoaderCircle className="size-6 shrink-0 animate-spin text-action motion-reduce:animate-none" aria-hidden="true" />
          <p className="font-medium">Reading the barcodes…</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview && <img src={preview} alt="" className="mt-4 max-h-80 rounded-xl border border-border" />}
      </>
    );
  }

  const input = ({ field, label, hint, mode, mono }: (typeof BALL_FIELDS)[number]) => (
    <Field
      key={field}
      label={label}
      error={errors[field]}
      hint={unread.includes(field) && !fields[field] ? "Not found in the photo. Type it from the label." : hint}
    >
      <input
        value={fields[field] ?? ""}
        onChange={(event) => {
          setFields({ ...fields, [field]: event.target.value });
          if (errors[field]) setErrors({ ...errors, [field]: undefined });
          if (field === "serial") setExistingBallId(null);
        }}
        inputMode={mode}
        autoCapitalize={mono ? "characters" : undefined}
        autoCorrect="off"
        spellCheck={false}
        aria-invalid={errors[field] ? true : undefined}
        className={`${inputClass} tabular ${mono ? "font-mono" : ""}`}
      />
    </Field>
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      noValidate
    >
      <h1 className="text-2xl font-bold">Check the details</h1>
      <p className="text-muted-foreground">
        {knownModel ? "Type the weights and the pin distance from the label, then save." : "Type the details from the label, then save."}
      </p>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      {preview && <img src={preview} alt="The label photo" className="mt-4 max-h-72 rounded-xl border border-border" />}

      {message && (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg bg-danger-surface px-3 py-2 font-medium text-destructive">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          {message}
        </p>
      )}
      {existingBallId && (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg bg-warn-surface px-3 py-2 font-medium text-warn">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <span>
            A ball with this serial number is already recorded.{" "}
            <Link href={`/balls/${existingBallId}`} className="underline underline-offset-4">
              View that ball
            </Link>
            . If the serial number was misread, correct it below.
          </span>
        </p>
      )}

      <div ref={firstError}>
        <fieldset className="mt-5 space-y-3 rounded-xl border border-border bg-card p-4">
          <legend className="font-heading px-1 text-lg font-semibold">This ball</legend>
          {input(BALL_FIELDS[0])}
          <div className="grid grid-cols-2 gap-3">{BALL_FIELDS.slice(1).map(input)}</div>
          <Field label="Location">
            <select value={locationId} onChange={(event) => setLocationId(event.target.value)} className={inputClass} required>
              {!locationId && <option value="">Select a location</option>}
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </Field>
        </fieldset>

        <fieldset className="mt-4 space-y-3 rounded-xl border border-border bg-card p-4">
          <legend className="font-heading px-1 text-lg font-semibold">Model</legend>
          {editModel ? (
            <>
              {knownModel && (
                <p className="text-sm text-muted-foreground">This UPC is in the catalog. A save keeps the catalog details of the model.</p>
              )}
              {MODEL_FIELDS.slice(0, 2).map(input)}
              <div className="grid grid-cols-2 gap-3">{MODEL_FIELDS.slice(2).map(input)}</div>
            </>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold break-words">
                  {fields.model_name} · {fields.nominal_weight_lb} lb
                </p>
                <p className="text-sm text-muted-foreground">
                  {[fields.brand, fields.color].filter(Boolean).join(" · ")}
                  {fields.brand || fields.color ? " · " : ""}
                  Known model, from the catalog
                </p>
                <p className="tabular font-mono text-sm text-muted-foreground">UPC {fields.upc}</p>
              </div>
              <button type="button" onClick={() => setEditModel(true)} className="h-10 shrink-0 font-medium text-action underline underline-offset-4">
                Show all
              </button>
            </div>
          )}
        </fieldset>
      </div>

      <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] -mx-4 mt-5 flex gap-2 border-t border-border bg-background px-4 py-3 sm:bottom-0">
        <button type="submit" disabled={saving} className={`${buttonClass.action} flex-1`}>
          {saving ? "Saving…" : "Save to stock"}
        </button>
        {preview && (
          <button type="button" onClick={() => fileInput.current?.click()} disabled={saving} className={buttonClass.quiet}>
            Retake
          </button>
        )}
        <button type="button" onClick={reset} disabled={saving} className={buttonClass.quiet}>
          Cancel
        </button>
      </div>
      {camera}
    </form>
  );
}
