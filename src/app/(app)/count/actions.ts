"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import type { CountOpen, CountReply, CountResult, ScanResult } from "@/lib/count/session";
import { stockErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

// The stock count. The database functions check the account and the rules (doc/adr/0005-stock-count-rules.md).

const uuid = z.uuid();
const bad: CountReply<never> = { ok: false, error: "The request is not valid." };

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<CountReply<T>> {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: stockErrorMessage(error) };
  return { ok: true, value: data as T };
}

/** Starts a count of the location, or gives its open count. */
export async function startCount(locationId: string) {
  if (!uuid.safeParse(locationId).success) return bad;
  return rpc<CountOpen>("start_count", { p_location_id: locationId });
}

export async function addCountScan(countId: string, serial: string) {
  if (!uuid.safeParse(countId).success) return bad;
  return rpc<ScanResult>("add_count_scan", { p_count_id: countId, p_serial: serial.slice(0, 40) });
}

export async function finishCount(countId: string) {
  if (!uuid.safeParse(countId).success) return bad;
  const reply = await rpc<CountResult>("finish_count", { p_count_id: countId });
  if (reply.ok) revalidatePath("/count");
  return reply;
}

export async function cancelCount(countId: string) {
  if (!uuid.safeParse(countId).success) return bad;
  return rpc<null>("cancel_count", { p_count_id: countId });
}

/** One correction from a line of a finished count. Gives the result again, with the line marked. */
export async function correctCountLine(countId: string, serial: string, requestId: string, reason: string | null) {
  if (!uuid.safeParse(countId).success || !uuid.safeParse(requestId).success) return bad;
  const reply = await rpc<null>("correct_count_line", {
    p_count_id: countId,
    p_serial: serial.slice(0, 40),
    p_request_id: requestId,
    p_reason: reason?.slice(0, 120) ?? null,
  });
  if (!reply.ok) return reply;
  revalidatePath("/", "layout");
  return rpc<CountResult>("count_result", { p_count_id: countId });
}
