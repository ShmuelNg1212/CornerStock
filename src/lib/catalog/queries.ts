import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { BallModel } from "@/lib/types";

/** Stable pages avoid silently truncating full catalog downloads at the API limit. */
export async function readCatalog(): Promise<BallModel[]> {
  const client = await createClient();
  const rows: BallModel[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await client
      .from("ball_models")
      .select("*")
      .order("id")
      .range(start, start + 499);
    if (error) throw new Error("The catalog could not be loaded. Try again.");
    rows.push(...(data as BallModel[]));
    if (data.length < 500) return rows;
  }
}
