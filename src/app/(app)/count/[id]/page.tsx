import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { CountResultView } from "@/components/count/count-result";
import { requireStaff } from "@/lib/auth";
import type { CountResult } from "@/lib/count/session";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { countApi } from "../count-api";

export const metadata: Metadata = { title: "Count result" };

export default async function CountResultPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, profile] = await Promise.all([params, requireStaff()]);
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("count_result", { p_count_id: id });
  if (error || !data) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/count" className="mb-3 inline-flex h-11 items-center gap-1 font-medium text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-5" aria-hidden="true" />
        Counts
      </Link>
      <CountResultView initial={data as CountResult} isOwner={profile.role === "owner"} api={countApi} />
    </div>
  );
}
