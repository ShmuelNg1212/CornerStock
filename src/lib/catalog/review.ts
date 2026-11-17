import { formatGrossWeight, normalizeSerial, validateLabel, validateUpc, type BallLabel, type RawLabel } from "@/lib/label/rules";
import { pinDistance, price } from "@/lib/format";
import type { Ball, BallModel, Location } from "@/lib/types";

export type ImportKind = "catalog" | "stock";
export type ImportRow = { row: number; values: Record<string, string | undefined> };
export type ImportModel = BallModel & { created_at?: string };
export type CatalogValues = Omit<BallModel, "id">;
export type ImportPayload = {
  kind: ImportKind;
  reason: string;
  models: { upc: string; before: ImportModel | null; after: CatalogValues }[];
  balls: { serial: string; before: Ball | null; label: BallLabel; location_id: string }[];
};
export type ImportSummary = { models_added: number; models_updated: number; balls_added: number; balls_updated: number; unchanged: number };
export type ImportChange = { row: number; identity: string; detail?: string; entity: "model" | "ball"; action: "add" | "update" | "unchanged"; fields: { field: string; before: string; after: string }[] };
export type ImportError = { row: number; field: string; message: string };
export type ImportReview = { payload: ImportPayload; summary: ImportSummary; changes: ImportChange[]; errors: ImportError[] };
export type ImportState = { models: ImportModel[]; balls: Ball[]; locations: Location[] };
export type ImportOptions = { defaultLocationId: string; reason: string };

const modelFields = ["upc", "brand", "model_name", "nominal_weight_lb", "color", "fragrance", "coverstock", "weight_block", "finish", "rg", "diff", "mass_bias", "product_code", "selling_price"] as const;
const stockFields = ["serial", "gross_weight", "top_weight", "pin_distance", "boxed_on", "location"] as const;
const text = (value: unknown) => value === null || value === undefined ? "" : String(value);

export function buildReview(kind: ImportKind, rows: ImportRow[], state: ImportState, options: ImportOptions): ImportReview {
  const result: ImportReview = {
    payload: { kind, reason: options.reason.trim(), models: [], balls: [] },
    summary: { models_added: 0, models_updated: 0, balls_added: 0, balls_updated: 0, unchanged: 0 }, changes: [], errors: [],
  };
  const error = (row: number, field: string, message: string) => result.errors.push({ row, field, message });
  const recordChange = (row: number, identity: string, detail: string, entity: "model" | "ball", before: Record<string, unknown> | null, after: Record<string, unknown>) => {
    const fields = Object.entries(after).filter(([field, value]) => text(before?.[field]) !== text(value)).map(([field, value]) => ({ field, before: text(before?.[field]), after: text(value) }));
    const action = !before ? "add" : fields.length ? "update" : "unchanged";
    result.changes.push({ row, identity, detail, entity, action, fields });
    if (action === "unchanged") result.summary.unchanged++;
    else if (entity === "model") result.summary[action === "add" ? "models_added" : "models_updated"]++;
    else result.summary[action === "add" ? "balls_added" : "balls_updated"]++;
  };
  if (kind !== "catalog" && kind !== "stock") {
    error(0, "file", "Select catalog or stock import.");
    return result;
  }
  if (rows.length === 0 || rows.length > 1000) {
    error(0, "file", "Import 1 to 1,000 data rows at a time.");
    return result;
  }
  if (options.reason.length > 200) error(0, "reason", "Use a reason of 200 characters or fewer.");
  const allowed = new Set<string>(kind === "stock" ? [...modelFields, ...stockFields] : modelFields);
  const suppliedModels = new Map<string, Record<string, string>>();
  const serialRows = new Map<string, number>();
  const balls = new Map(state.balls.map(ball => [ball.serial, ball]));
  // An existing ball matches by serial. A blank UPC on its row keeps the stored UPC.
  const rowUpc = (input: ImportRow) => {
    const supplied = input.values.upc ?? "";
    if (kind !== "stock" || supplied.trim()) return supplied;
    const serial = normalizeSerial(input.values.serial ?? "");
    const existing = serial.ok ? balls.get(serial.value) : undefined;
    return state.models.find(model => model.id === existing?.model_id)?.upc ?? supplied;
  };
  for (const input of rows) {
    for (const [field, value] of Object.entries(input.values)) {
      if (!allowed.has(field)) error(input.row, field, "This field is not supported for this import.");
      else if (value !== undefined && (typeof value !== "string" || value.length > 5000)) error(input.row, field, "This cell must contain text of 5,000 characters or fewer.");
    }
    const upc = validateUpc(rowUpc(input));
    if (upc.ok) {
      const group = suppliedModels.get(upc.value) ?? {};
      for (const field of modelFields) {
        if (field === "upc") continue;
        const supplied = input.values[field]?.trim();
        if (!supplied) continue;
        if (group[field] !== undefined && group[field] !== supplied) error(input.row, field, "Rows for the same UPC supply conflicting values.");
        else group[field] = supplied;
      }
      suppliedModels.set(upc.value, group);
    }
    if (kind === "stock") {
      const serial = normalizeSerial(input.values.serial ?? "");
      if (serial.ok) {
        if (serialRows.has(serial.value)) error(input.row, "serial", `This serial number is also on row ${serialRows.get(serial.value)}.`);
        else serialRows.set(serial.value, input.row);
      }
    }
  }
  const recordedModels = new Set<string>();
  const models = new Map(state.models.map(model => [model.upc, model]));
  for (const input of rows) {
    const upc = validateUpc(rowUpc(input));
    if (!upc.ok) { error(input.row, "upc", upc.error); continue; }
    const before = models.get(upc.value) ?? null;
    const suppliedModel = suppliedModels.get(upc.value) ?? {};
    const serial = normalizeSerial(input.values.serial ?? "");
    const existingBall = kind === "stock" && serial.ok ? balls.get(serial.value) ?? null : null;
    const raw: RawLabel = { serial: kind === "stock" ? input.values.serial : "CATALOG", upc: upc.value };
    for (const field of modelFields) {
      if (field === "selling_price" || field === "upc") continue;
      const current = before?.[field === "model_name" ? "name" : field];
      const provided = suppliedModel[field];
      raw[field] = provided === "__CLEAR__" ? "" : provided || text(current);
    }
    if (kind === "stock") {
      const defaults = {
        gross_weight: existingBall?.gross_weight_oz == null ? "" : formatGrossWeight(existingBall.gross_weight_oz),
        top_weight: text(existingBall?.top_weight),
        pin_distance: existingBall?.pin_min == null ? "" : `${existingBall.pin_min}-${existingBall.pin_max ?? existingBall.pin_min}`,
        boxed_on: text(existingBall?.boxed_on),
      };
      for (const [key, fallback] of Object.entries(defaults)) {
        const field = key as keyof typeof defaults;
        const supplied = input.values[field]?.trim();
        raw[field] = supplied === "__CLEAR__" ? "" : supplied || fallback;
      }
    }
    const validated = validateLabel(raw);
    if (!validated.value) {
      for (const [field, message] of Object.entries(validated.errors)) error(input.row, field, message!);
      continue;
    }
    const label = validated.value;
    for (const field of ["rg", "diff", "mass_bias"] as const) {
      const value = label[field];
      if (value !== null && value !== Number(value.toFixed(3))) error(input.row, field, "Use at most three decimal places.");
    }
    if (label.top_weight !== null && label.top_weight !== Number(label.top_weight.toFixed(2))) error(input.row, "top_weight", "Use at most two decimal places.");
    if ([label.pin_min, label.pin_max].some(value => value !== null && value !== Number(value.toFixed(2)))) error(input.row, "pin_distance", "Use at most two decimal places.");
    if (before && Number(before.nominal_weight_lb) !== label.nominal_weight_lb) error(input.row, "nominal_weight_lb", "The weight of an existing UPC cannot change.");
    // Accept the same price text as the price form: a peso sign, commas, and spaces.
    const priceText = suppliedModel.selling_price?.replace(/[₱,\s]/g, "");
    if (priceText && priceText !== "__CLEAR__" && (!/^\d+(?:\.\d{1,2})?$/.test(priceText) || Number(priceText) >= 10_000_000)) error(input.row, "selling_price", "Use a nonnegative price below 10,000,000 with at most two decimal places.");
    const after: CatalogValues = {
      upc: label.upc, name: label.model_name, nominal_weight_lb: label.nominal_weight_lb,
      brand: label.brand, color: label.color, fragrance: label.fragrance, coverstock: label.coverstock,
      weight_block: label.weight_block, finish: label.finish, rg: label.rg, diff: label.diff,
      mass_bias: label.mass_bias, product_code: label.product_code,
      selling_price: priceText === "__CLEAR__" ? null : priceText ? Number(priceText) : before?.selling_price ?? null,
    };
    if (!recordedModels.has(label.upc)) {
      result.payload.models.push({ upc: label.upc, before, after });
      const shown = (values: Record<string, unknown>) => ({ ...values, selling_price: values.selling_price == null ? "" : price(Number(values.selling_price)) });
      recordChange(input.row, `${label.model_name} · ${label.nominal_weight_lb} lb`, `UPC ${label.upc}`, "model", before && shown(before), shown(after));
      recordedModels.add(label.upc);
    }
    if (kind === "stock") {
      let locationId = existingBall?.location_id ?? options.defaultLocationId;
      const suppliedLocation = input.values.location?.trim();
      if (suppliedLocation) {
        const locations = state.locations.filter(location => location.active && (location.id === suppliedLocation || location.name === suppliedLocation));
        if (locations.length !== 1) error(input.row, "location", "Use one exact active location name or ID.");
        else locationId = locations[0].id;
      }
      if (!existingBall && !state.locations.some(location => location.active && location.id === locationId)) error(input.row, "location", "Select an active destination for new balls.");
      if (existingBall && state.models.find(model => model.id === existingBall.model_id)?.upc !== label.upc) error(input.row, "upc", "The UPC of an existing ball cannot change.");
      if (existingBall && existingBall.location_id !== locationId && existingBall.status !== "in_stock") error(input.row, "location", "Only a ball in stock can move to another location.");
      result.payload.balls.push({ serial: label.serial, before: existingBall, label, location_id: locationId });
      // Show measurements as the stock screens do. The payload keeps the stored values.
      const shown = (ball: Pick<Ball, "gross_weight_oz" | "top_weight" | "pin_min" | "pin_max" | "boxed_on" | "location_id">) => ({
        gross_weight: ball.gross_weight_oz == null ? "" : formatGrossWeight(ball.gross_weight_oz),
        top_weight: ball.top_weight, pin_distance: ball.pin_min == null ? "" : pinDistance(ball),
        boxed_on: ball.boxed_on, location_id: ball.location_id,
      });
      recordChange(input.row, label.serial, `${label.model_name} · ${label.nominal_weight_lb} lb`, "ball", existingBall && shown(existingBall), shown({
        gross_weight_oz: label.gross_weight_oz, top_weight: label.top_weight,
        pin_min: label.pin_min, pin_max: label.pin_max, boxed_on: label.boxed_on,
        location_id: locationId,
      }));
      if (existingBall && result.changes.at(-1)?.action === "update" && !options.reason.trim()) error(input.row, "reason", "Give a reason for changes to existing stock.");
    }
  }
  return result;
}
