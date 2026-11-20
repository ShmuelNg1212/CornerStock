import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ReorderWorksheet } from "./reorder-worksheet";

export async function readReorderWorksheet(): Promise<ReorderWorksheet> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reorder_worksheet");
  if (error || !data) throw new Error("The reorder worksheet could not be loaded. Try again.");
  return data as ReorderWorksheet;
}
