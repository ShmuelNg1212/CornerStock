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
  type LabelErrors,
  type RawLabel,
} from "@/lib/label/rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
