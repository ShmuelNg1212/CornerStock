import "server-only";
import { filterTypes, type ActivityRow } from "@/lib/activity";
import { createClient } from "@/lib/supabase/server";

export const ACTIVITY_PAGE = 50;

export type ActivityCursor = Pick<ActivityRow, "at" | "src" | "id">;
export type ActivityPage = { rows: ActivityRow[]; more: boolean };

/** One page of the store activity, newest first. Row-level security limits the rows. */
export async function readActivity(filter: string | undefined, before: ActivityCursor | null): Promise<ActivityPage> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("activity_feed", {
    p_before_at: before?.at ?? null,
    p_before_src: before?.src ?? null,
    p_before_id: before?.id ?? null,
    p_types: filterTypes(filter),
    p_limit: ACTIVITY_PAGE,
  });
  if (error) throw new Error("The activity could not be loaded. Try again.");
  const rows = (data ?? []) as ActivityRow[];
  return { rows, more: rows.length === ACTIVITY_PAGE };
}
