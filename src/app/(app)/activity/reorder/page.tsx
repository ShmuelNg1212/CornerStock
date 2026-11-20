import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { buttonClass } from "@/components/ui/field";
import { requireOwner } from "@/lib/auth";
import { readReorderWorksheet } from "@/lib/reorder-worksheet-query";
import { ReorderForm } from "./reorder-form";

export const metadata = { title: "Reorder worksheet" };

async function Worksheet() {
  await requireOwner();
  const initial = await readReorderWorksheet();

  return (
    <div className="mx-auto max-w-5xl lg:mx-0">
      <Link href="/activity" className={`${buttonClass.link} gap-1.5`}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        Activity
      </Link>
      <h1 className="mt-2 font-heading text-2xl font-bold">Reorder worksheet</h1>
      <ReorderForm initial={initial} />
    </div>
  );
}

export default function ReorderPage() {
  return (
    <Suspense fallback={<p role="status" className="text-muted-foreground">Loading reorder worksheet…</p>}>
      <Worksheet />
    </Suspense>
  );
}
