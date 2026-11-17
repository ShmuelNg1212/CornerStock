import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { CountResultView } from "@/components/count/count-result";
import { requireStaff } from "@/lib/auth";
import type { CountResult } from "@/lib/count/session";
import { createClient } from "@/lib/supabase/server";
import { addCountScan, cancelCount, correctCountLine, finishCount, startCount } from "../actions";

export const metadata: Metadata = { title: "Count result" };

const api = { start: startCount, scan: addCountScan, finish: finishCount, cancel: cancelCount, correct: correctCountLine };

export default async function CountResultPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, profile] = await Promise.all([params, requireStaff()]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("count_result", { p_count_id: id });
  if (error || !data) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/count" className="mb-3 inline-flex h-11 items-center gap-1 font-medium text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-5" aria-hidden="true" />
        Counts
      </Link>
      <CountResultView initial={data as CountResult} isOwner={profile.role === "owner"} api={api} />
    </div>
  );
}
