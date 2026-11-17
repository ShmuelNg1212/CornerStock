import type { Metadata } from "next";
import { CountHistory } from "@/components/count/count-history";
import { CountScreen } from "@/components/count/count-screen";
import { ALL_LOCATIONS, getLocations, requireStaff } from "@/lib/auth";
import type { CountRecord } from "@/lib/count/session";
import { createClient } from "@/lib/supabase/server";
import { addCountScan, cancelCount, correctCountLine, finishCount, startCount } from "./actions";

export const metadata: Metadata = { title: "Count stock" };

const api = { start: startCount, scan: addCountScan, finish: finishCount, cancel: cancelCount, correct: correctCountLine };

export default async function CountPage() {
  await requireStaff();
  const supabase = await createClient();
  const [{ locations, selected }, { data: history }] = await Promise.all([getLocations(), supabase.rpc("count_history", { p_limit: 30 })]);
  return (
    <div className="mx-auto max-w-2xl">
      <CountScreen locations={locations} defaultLocationId={selected === ALL_LOCATIONS ? "" : selected} api={api} />
      <CountHistory counts={(history ?? []) as CountRecord[]} />
    </div>
  );
}
