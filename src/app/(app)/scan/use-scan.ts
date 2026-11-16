"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { lookupLabel, receiveBall } from "@/app/actions";
import { announceSaved } from "@/lib/events";
import type { LabelBarcodes } from "@/lib/label/barcodes";
import { readMessage, scanStatus } from "@/lib/label/batch";
import { readLabelPhoto } from "@/lib/label/read-photo";
import { parseGrossWeight, validateLabel, type LabelErrors, type LabelField, type RawLabel } from "@/lib/label/rules";
import { createClient } from "@/lib/supabase/client";
import type { Location } from "@/lib/types";
import { EMPTY, MODEL_FIELDS, type BatchItem, type Saved, type Step } from "./scan-types";

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

/** Reads the barcodes of one label photo and looks them up in the catalog. */
async function readLabel(file: File) {
  // Read the barcodes from the full photo. Keep a smaller copy as the record of the label.
  const [codes, photo] = await Promise.all([readLabelPhoto(file).catch((): LabelBarcodes | null => null), shrink(file)]);
  const fields: RawLabel = { ...EMPTY, upc: codes?.upc ?? "", serial: codes?.serial ?? "", product_code: codes?.product_code ?? "" };
  let known = false;
  let existingBallId: string | null = null;
  let lookupFailed = false;
  if (codes?.upc || codes?.serial) {
    try {
      const lookup = await lookupLabel({ upc: codes.upc, serial: codes.serial });
      if (lookup.model) {
        Object.assign(fields, lookup.model);
        known = true;
      }
      existingBallId = lookup.existingBallId;
    } catch {
      lookupFailed = true;
    }
  }
  const unread = (["serial", "upc"] as LabelField[]).filter((f) => !fields[f]);
  return { codes, photo, fields, known, existingBallId, lookupFailed, unread };
}

/** Keeps the label photo, then adds the ball. Throws when the connection fails. */
async function submit(photo: Blob | null, label: RawLabel, locationId: string, requestId: string) {
  // The photo is a record of the label. A failed upload does not stop the save.
  let photoPath: string | null = null;
  if (photo) {
    const path = `${requestId}.jpg`;
    const upload = await createClient().storage.from("labels").upload(path, photo, { contentType: "image/jpeg", upsert: false });
    if (!upload.error || upload.error.message.toLowerCase().includes("exists")) photoPath = path;
  }
  const result = await receiveBall({ label, locationId, requestId, photoPath });
  return { result, photoKept: photoPath !== null || photo === null };
}

const summaryOf = (label: { model_name?: string | null; nominal_weight_lb?: string | number | null; serial?: string | null }) =>
  `${label.model_name} ${label.nominal_weight_lb} lb · ${label.serial}`;

/** The state and the actions of the scan flow. The step components only show it. */
export function useScan({ locations, defaultLocationId }: { locations: Location[]; defaultLocationId: string }) {
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
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [fromBatch, setFromBatch] = useState<string | null>(null);
  const [batchAdded, setBatchAdded] = useState(0);

  const photo = useRef<Blob | null>(null);
  // One request id for each ball. A second tap on Save, or a retry after a lost
  // connection, sends the same id, and the database then adds the ball one time only.
  const requestId = useRef("");
  const batchRef = useRef<BatchItem[]>([]);
  // The photos of a batch are read one at a time. This keeps the memory use low on a phone.
  const readQueue = useRef<Promise<void>>(Promise.resolve());
  const weightGuess = useRef("");

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);
  const savedPreview = saved?.preview ?? null;
  useEffect(() => () => void (savedPreview && URL.revokeObjectURL(savedPreview)), [savedPreview]);
  useEffect(() => {
    batchRef.current = batch;
  }, [batch]);
  useEffect(() => () => batchRef.current.forEach((item) => item.preview && URL.revokeObjectURL(item.preview)), []);

  const unsaved = batch.filter((item) => item.status !== "saved").length;
  const unsavedPhotos = unsaved + (!fromBatch && preview && (step === "reading" || step === "confirm") ? 1 : 0);
  useEffect(() => {
    if (!unsavedPhotos) return;
    const text = `${unsavedPhotos} ${unsavedPhotos === 1 ? "ball is" : "balls are"} not saved. Leave the scan?`;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    // A link of the app does not unload the page, so it needs its own question.
    const ask = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!link || (link as HTMLAnchorElement).target === "_blank") return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!window.confirm(text)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const askSignOut = (event: SubmitEvent) => {
      if (!(event.target instanceof HTMLFormElement) || !event.target.hasAttribute("data-leaves-scan")) return;
      if (!window.confirm(text)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", ask, true);
    document.addEventListener("submit", askSignOut, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", ask, true);
      document.removeEventListener("submit", askSignOut, true);
    };
  }, [unsavedPhotos]);

  function begin(next: Step) {
    requestId.current = crypto.randomUUID();
    weightGuess.current = "";
    setErrors({});
    setMessage(null);
    setExistingBallId(null);
    setSaved(null);
    setBatchAdded(0);
    setStep(next);
  }

  function reset() {
    photo.current = null;
    setPreview(null);
    setFields(EMPTY);
    setUnread([]);
    setKnownModel(false);
    setEditModel(false);
    setFromBatch(null);
    setStep(fromBatch ? "batch" : "start");
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    begin("reading");
    setPreview(URL.createObjectURL(file));
    const read = await readLabel(file);
    photo.current = read.photo;
    setMessage(readMessage(read.codes, read.lookupFailed));
    setExistingBallId(read.existingBallId);
    setFields(read.fields);
    setKnownModel(read.known);
    setEditModel(!read.known);
    setUnread(read.unread);
    setStep("confirm");
  }

  function typeDetails() {
    begin("confirm");
    setEditModel(true);
  }

  function startBatch() {
    begin("batch");
    setMessage(null);
  }

  const updateItem = (id: string, change: Partial<BatchItem>) =>
    setBatch((items) => items.map((item) => (item.id === id ? { ...item, ...change } : item)));

  /** `codes`: the barcodes that the live camera already read, so a second capture of the same box is skipped at once. */
  function addPhotos(files: File[], codes: (LabelBarcodes | undefined)[] = []) {
    if (!files.length) return;
    const items: BatchItem[] = files.map((_, i) => ({
      id: crypto.randomUUID(),
      preview: null,
      photo: null,
      fields: { ...EMPTY, serial: codes[i]?.serial ?? "", upc: codes[i]?.upc ?? "" },
      known: false,
      unread: [],
      existingBallId: null,
      message: null,
      status: "reading",
    }));
    setBatch((current) => [...current, ...items]);
    files.forEach((file, i) => {
      // A failed read must not stop the reads of the next photos.
      readQueue.current = readQueue.current.then(() =>
        readItem(items[i].id, file).catch(() =>
          updateItem(items[i].id, { status: "needs_details", message: "The photo could not be read on this device. Type the details." }),
        ),
      );
    });
  }

  async function readItem(id: string, file: File) {
    const read = await readLabel(file);
    const current = batchRef.current;
    const index = current.findIndex((item) => item.id === id);
    if (index < 0) return; // Removed while it was read.
    const serialsBefore = current.slice(0, index).flatMap((item) => (item.fields.serial ? [item.fields.serial] : []));
    const status = scanStatus({ ...read, knownModel: read.known, serialsBefore });
    updateItem(id, {
      preview: URL.createObjectURL(read.photo),
      photo: read.photo,
      fields: read.fields,
      known: read.known,
      unread: read.unread,
      existingBallId: read.existingBallId,
      message:
        status === "duplicate" && !read.existingBallId
          ? "Another photo in this batch has this serial number. If it was misread, correct it."
          : readMessage(read.codes, read.lookupFailed),
      status,
    });
  }

  function removeItem(item: BatchItem) {
    if (item.preview) URL.revokeObjectURL(item.preview);
    setBatch((items) => items.filter((i) => i.id !== item.id));
  }

  function openItem(item: BatchItem) {
    requestId.current = item.id;
    weightGuess.current = "";
    photo.current = item.photo;
    setFields(item.fields);
    setErrors({});
    setUnread(item.unread);
    setKnownModel(item.known);
    setEditModel(!item.known);
    setExistingBallId(item.existingBallId);
    setMessage(item.message);
    setFromBatch(item.id);
    setStep("confirm");
  }

  function backToBatch() {
    if (fromBatch) updateItem(fromBatch, { fields, existingBallId });
    reset();
  }

  function finishBatch() {
    if (unsaved && !window.confirm(`${unsaved} ${unsaved === 1 ? "ball is" : "balls are"} not saved. Leave the batch?`)) return;
    batch.forEach((item) => item.preview && URL.revokeObjectURL(item.preview));
    const added = batch.filter((item) => item.status === "saved").length;
    setBatch([]);
    setMessage(null);
    setSaved(null);
    setBatchAdded(added);
    setStep("start");
  }

  async function saveAll() {
    if (!locationId) {
      setMessage("Select the location of these balls.");
      return;
    }
    setSaving(true);
    setMessage(null);
    const location = locations.find((l) => l.id === locationId)?.name ?? "";
    for (const item of batchRef.current.filter((i) => i.status === "ready")) {
      updateItem(item.id, { status: "saving", message: null });
      try {
        const { result, photoKept } = await submit(item.photo, item.fields, locationId, item.id);
        if (result.ok) {
          updateItem(item.id, { status: "saved", ballId: result.ballId, savedTo: location, photoKept });
          announceSaved(1);
        }
        else
          updateItem(item.id, {
            status: result.existingBallId ? "duplicate" : "needs_details",
            message: result.error,
            existingBallId: result.existingBallId ?? null,
          });
      } catch {
        updateItem(item.id, { status: "ready", message: "Not saved. Check the connection, then tap Save again." });
      }
    }
    setSaving(false);
  }

  /** Returns false when a field has an error. The form then moves the focus to it. */
  async function save(): Promise<boolean> {
    const check = validateLabel(fields);
    if (!locationId) {
      setMessage("Select the location of this ball.");
      return true;
    }
    if (!check.value) {
      setErrors(check.errors);
      if (!editModel && MODEL_FIELDS.some((f) => check.errors[f.field])) setEditModel(true);
      setMessage("Check the marked fields.");
      return false;
    }

    setSaving(true);
    setMessage(null);
    try {
      const { result, photoKept } = await submit(photo.current, fields, locationId, requestId.current);
      const location = locations.find((l) => l.id === locationId)?.name ?? "";
      if (result.ok) announceSaved(1);
      if (result.ok && fromBatch) {
        updateItem(fromBatch, { status: "saved", fields, ballId: result.ballId, savedTo: location, photoKept });
        reset();
      } else if (result.ok) {
        const summary = summaryOf(check.value);
        const serial = check.value.serial;
        const savedPhoto = photo.current ? URL.createObjectURL(photo.current) : null;
        // A transition lets the label photo move into the row of the saved ball.
        startTransition(() => {
          setSaved({ ballId: result.ballId, serial, summary, location, photoKept, preview: savedPhoto });
          reset();
        });
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
    return true;
  }

  function setField(field: LabelField, value: string) {
    const next = { ...fields, [field]: value };
    // The ball weight is the pounds part of the gross weight on most labels. Fill it in
    // while it is empty or still the value that this rule put there. Staff can change it.
    if (field === "gross_weight") {
      const gross = parseGrossWeight(value);
      const guess = gross.ok ? String(Math.floor(gross.value / 16)) : "";
      if (!fields.nominal_weight_lb || fields.nominal_weight_lb === weightGuess.current) {
        next.nominal_weight_lb = guess;
        weightGuess.current = guess;
      }
    }
    setFields(next);
    if (errors[field]) setErrors({ ...errors, [field]: undefined });
    if (field === "serial") setExistingBallId(null);
  }

  return {
    step,
    fields,
    errors,
    unread,
    knownModel,
    editModel,
    existingBallId,
    locationId,
    message,
    saving,
    saved,
    preview: fromBatch ? (batch.find((item) => item.id === fromBatch)?.preview ?? null) : preview,
    hasOwnPhoto: preview !== null && !fromBatch,
    batch,
    fromBatch: fromBatch !== null,
    batchAdded,
    setLocationId,
    setField,
    showModel: () => setEditModel(true),
    onPhoto,
    typeDetails,
    startBatch,
    addPhotos,
    removeItem,
    openItem,
    backToBatch,
    cancel: reset,
    finishBatch,
    saveAll,
    save,
  };
}

export type Scan = ReturnType<typeof useScan>;
