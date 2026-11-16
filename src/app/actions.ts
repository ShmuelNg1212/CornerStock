"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ALL_LOCATIONS, LOCATION_COOKIE, requireOwner, requireStaff } from "@/lib/auth";
import { stockErrorMessage } from "@/lib/errors";
import {
  parseBoxedDate,
  parseDecimal,
  parseGrossWeight,
  parsePinDistance,
  normalizeSerial,
  validateLabel,
  validateModelDetails,
  validateUpc,
  type LabelErrors,
  type ModelDetailErrors,
  type RawLabel,
  type RawModelDetails,
} from "@/lib/label/rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { BallModel, BallStatus } from "@/lib/types";

export type ActionResult = { ok: true } | { ok: false; error: string };
const done: ActionResult = { ok: true };
const failed = (error: string): ActionResult => ({ ok: false, error });
const uuid = z.uuid();

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export async function signIn(_: string | null, form: FormData): Promise<string | null> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return "Write your email and password.";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return "The email or password is not correct.";
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function setLocation(value: string) {
  await requireStaff();
  if (value !== ALL_LOCATIONS && !uuid.safeParse(value).success) return;
  (await cookies()).set(LOCATION_COOKIE, value, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------

export type SerialMatch = {
  id: string;
  serial: string;
  status: BallStatus;
  location_id: string;
  model_name: string;
  weight: number;
};

/** Finds balls by a part of the serial number, in all locations and all statuses. */
export async function searchSerials(query: string): Promise<SerialMatch[]> {
  await requireStaff();
  const text = query.trim().slice(0, 60);
  if (text.length < 3) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("balls")
    .select("id, serial, status, location_id, ball_models(name, nominal_weight_lb)")
    .ilike("serial", `%${text.replace(/[%_\\]/g, "\\$&")}%`)
    .limit(8);
  type Row = Omit<SerialMatch, "model_name" | "weight"> & { ball_models: { name: string; nominal_weight_lb: number } };
  return ((data ?? []) as unknown as Row[]).map(({ ball_models, ...ball }) => ({
    ...ball,
    model_name: ball_models.name,
    weight: Number(ball_models.nominal_weight_lb),
  }));
}

export type LabelLookup = {
  /** The catalog values for this UPC, or null when the UPC is new. */
  model: RawLabel | null;
  /** Set when a ball with this serial number is already recorded. */
  existingBallId: string | null;
};

/** Looks up what the shop already knows about a scanned UPC and serial number. */
export async function lookupLabel(input: { upc: string | null; serial: string | null }): Promise<LabelLookup> {
  await requireStaff();
  const supabase = await createClient();
  const result: LabelLookup = { model: null, existingBallId: null };

  const upc = input.upc ? validateUpc(input.upc) : null;
  if (upc?.ok) {
    const { data: model } = await supabase.from("ball_models").select("*").eq("upc", upc.value).maybeSingle<BallModel>();
    if (model) {
      const text = (value: number | null) => (value === null ? "" : String(Number(value)));
      result.model = {
        brand: model.brand ?? "",
        model_name: model.name,
        nominal_weight_lb: String(model.nominal_weight_lb),
        color: model.color ?? "",
        fragrance: model.fragrance ?? "",
        coverstock: model.coverstock ?? "",
        weight_block: model.weight_block ?? "",
        finish: model.finish ?? "",
        rg: text(model.rg),
        diff: text(model.diff),
        mass_bias: text(model.mass_bias),
        product_code: model.product_code ?? "",
      };
    }
  }

  const serial = input.serial ? normalizeSerial(input.serial) : null;
  if (serial?.ok) {
    const { data: ball } = await supabase.from("balls").select("id").eq("serial", serial.value).maybeSingle<{ id: string }>();
    result.existingBallId = ball?.id ?? null;
  }
  return result;
}

export type ReceiveResult =
  | { ok: true; ballId: string }
  | { ok: false; error: string; fieldErrors?: LabelErrors; existingBallId?: string };

export async function receiveBall(input: {
  label: RawLabel;
  locationId: string;
  requestId: string;
  photoPath: string | null;
}): Promise<ReceiveResult> {
  await requireStaff();
  if (!uuid.safeParse(input.locationId).success) return { ok: false, error: "Select a location first." };
  if (!uuid.safeParse(input.requestId).success) return { ok: false, error: "Start the scan again." };

  const { value, errors } = validateLabel(input.label);
  if (!value) return { ok: false, error: "Check the marked fields.", fieldErrors: errors };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("receive_ball", {
    p_label: value,
    p_location_id: input.locationId,
    p_request_id: input.requestId,
    p_label_photo_path: input.photoPath,
  });
  if (error) {
    const existingBallId = error.message.includes("DUPLICATE_SERIAL") ? (error.details ?? undefined) : undefined;
    return { ok: false, error: stockErrorMessage(error), existingBallId };
  }
  revalidatePath("/", "layout");
  return { ok: true, ballId: data as string };
}

async function stockRpc(fn: string, args: Record<string, unknown>): Promise<ActionResult> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return failed(stockErrorMessage(error));
  revalidatePath("/", "layout");
  return done;
}

export async function sellBall(ballId: string, requestId: string, reference: string) {
  return stockRpc("sell_ball", { p_ball_id: ballId, p_request_id: requestId, p_reference: reference.slice(0, 80) });
}

export async function transferBall(ballId: string, toLocationId: string, requestId: string) {
  return stockRpc("transfer_ball", { p_ball_id: ballId, p_to_location_id: toLocationId, p_request_id: requestId });
}

export async function reverseSale(ballId: string, requestId: string, reason: string) {
  return stockRpc("reverse_sale", { p_ball_id: ballId, p_request_id: requestId, p_reason: reason.slice(0, 200) });
}

export async function removeBall(ballId: string, requestId: string, reason: string) {
  return stockRpc("remove_ball", { p_ball_id: ballId, p_request_id: requestId, p_reason: reason.slice(0, 200) });
}

export type AdjustInput = { serial: string; gross_weight: string; top_weight: string; pin_distance: string; boxed_on: string };

export async function adjustBall(
  ballId: string,
  requestId: string,
  input: AdjustInput,
  reason: string,
): Promise<ActionResult & { fieldErrors?: Partial<Record<keyof AdjustInput, string>> }> {
  const fieldErrors: Partial<Record<keyof AdjustInput, string>> = {};
  const changes: Record<string, unknown> = {};

  const serial = normalizeSerial(input.serial);
  if (serial.ok) changes.serial = serial.value;
  else fieldErrors.serial = serial.error;

  // An empty field removes the value.
  function optional<T>(field: keyof AdjustInput, parse: (t: string) => { ok: true; value: T } | { ok: false; error: string }) {
    if (input[field].trim() === "") return null;
    const result = parse(input[field]);
    if (result.ok) return result.value;
    fieldErrors[field] = result.error;
    return null;
  }
  changes.gross_weight_oz = optional("gross_weight", parseGrossWeight);
  changes.top_weight = optional("top_weight", (t) => parseDecimal(t, 0, 10));
  const pin = optional("pin_distance", parsePinDistance);
  changes.pin_min = pin?.min ?? null;
  changes.pin_max = pin?.max ?? null;
  changes.boxed_on = optional("boxed_on", parseBoxedDate);

  if (Object.keys(fieldErrors).length > 0) return { ok: false, error: "Check the marked fields.", fieldErrors };
  return stockRpc("adjust_ball", {
    p_ball_id: ballId,
    p_changes: changes,
    p_request_id: requestId,
    p_reason: reason.slice(0, 200),
  });
}

// ---------------------------------------------------------------------------
// Owner settings
// ---------------------------------------------------------------------------

export async function setPrice(modelId: string, priceText: string): Promise<ActionResult> {
  await requireOwner();
  const text = priceText.replace(/[₱,\s]/g, "");
  const price = text === "" ? null : Number(text);
  if (price !== null && !(price >= 0 && price < 10_000_000)) return failed("Write a price in pesos, for example 12500.");
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("ball_models")
    .update({ selling_price: price }, { count: "exact" })
    .eq("id", modelId);
  if (error || count !== 1) return failed(stockErrorMessage(error));
  revalidatePath("/", "layout");
  return done;
}

/** Changes the catalog details of a model. The UPC and the weight stay fixed. */
export async function updateModel(
  modelId: string,
  input: RawModelDetails,
): Promise<ActionResult & { fieldErrors?: ModelDetailErrors }> {
  await requireOwner();
  if (!uuid.safeParse(modelId).success) return failed("This model does not exist.");
  const { value, errors } = validateModelDetails(input);
  if (!value) return { ok: false, error: "Check the marked fields.", fieldErrors: errors };
  const supabase = await createClient();
  const { error, count } = await supabase.from("ball_models").update(value, { count: "exact" }).eq("id", modelId);
  if (error || count !== 1) return failed(stockErrorMessage(error));
  revalidatePath("/", "layout");
  return done;
}

export async function addLocation(name: string): Promise<ActionResult> {
  await requireOwner();
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 80) return failed("Write a name of 1 to 80 characters.");
  const supabase = await createClient();
  const { error } = await supabase.from("locations").insert({ name: trimmed });
  if (error) return failed(error.code === "23505" ? "A location with this name already exists." : stockErrorMessage(error));
  revalidatePath("/", "layout");
  return done;
}

export async function updateLocation(id: string, change: { name?: string; active?: boolean }): Promise<ActionResult> {
  await requireOwner();
  const supabase = await createClient();
  const update: { name?: string; active?: boolean } = {};
  if (change.name !== undefined) {
    const trimmed = change.name.trim();
    if (trimmed.length < 1 || trimmed.length > 80) return failed("Write a name of 1 to 80 characters.");
    update.name = trimmed;
  }
  if (change.active !== undefined) {
    if (!change.active) {
      const { count } = await supabase
        .from("balls")
        .select("id", { count: "exact", head: true })
        .eq("location_id", id)
        .eq("status", "in_stock");
      if (count) return failed(`This location has ${count} ${count === 1 ? "ball" : "balls"} in stock. Move them first.`);
    }
    update.active = change.active;
  }
  const { error, count } = await supabase.from("locations").update(update, { count: "exact" }).eq("id", id);
  if (error || count !== 1) {
    return failed(error?.code === "23505" ? "A location with this name already exists." : stockErrorMessage(error));
  }
  revalidatePath("/", "layout");
  return done;
}

export async function addStaff(input: { fullName: string; email: string; password: string }): Promise<ActionResult> {
  await requireOwner();
  const parsed = z
    .object({ fullName: z.string().trim().min(1).max(80), email: z.email(), password: z.string().min(8).max(72) })
    .safeParse(input);
  if (!parsed.success) return failed("Write a name, a valid email, and a password of 8 characters or more.");
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
    // The database gives access only to accounts with this mark. See handle_new_user.
    app_metadata: { added_by_owner: true },
  });
  if (error) {
    return failed(error.code === "email_exists" ? "An account with this email already exists." : "The account was not created. Try again.");
  }
  revalidatePath("/settings");
  return done;
}

export async function updateStaff(id: string, change: { active?: boolean; role?: "owner" | "staff" }): Promise<ActionResult> {
  const owner = await requireOwner();
  if (id === owner.id) return failed("You cannot change your own account here.");
  const supabase = await createClient();
  const { error, count } = await supabase.from("profiles").update(change, { count: "exact" }).eq("id", id);
  if (error || count !== 1) return failed(stockErrorMessage(error));
  revalidatePath("/settings");
  return done;
}
