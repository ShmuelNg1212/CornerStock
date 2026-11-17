"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { CountFlow } from "@/components/count/count-flow";
import { CountHistory } from "@/components/count/count-history";
import { CountResultView } from "@/components/count/count-result";
import { buttonClass } from "@/components/ui/field";
import type { CountResult } from "@/lib/count/session";
import { locations } from "../../fixtures";
import { fakeCountApi, fakeResult, historyRows } from "./fake-count";

/**
 * The stock count with fixture data. `?step=result` shows a result with 200 balls.
 * The count itself runs on an in-memory copy of the rules, so a fake camera can scan the label fixtures.
 */
export function CountPreview({ owner, countId = null }: { owner: boolean; countId?: string | null }) {
  const step = useSearchParams().get("step");
  const [result, setResult] = useState<CountResult | null>(countId || step === "result" ? fakeResult(countId) : null);
  const [round, setRound] = useState(0);
  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-4 flex gap-3 text-sm text-muted-foreground">
        <Link href="/preview/count" className="underline">
          count
        </Link>
        <Link href="/preview/count?step=result" className="underline">
          result
        </Link>
      </p>
      {result ? (
        <>
          <CountResultView key={result.id} initial={result} isOwner={owner} api={fakeCountApi} base="/preview" />
          <button
            type="button"
            className={`${buttonClass.quiet} mt-6`}
            onClick={() => {
              setResult(null);
              setRound((r) => r + 1);
            }}
          >
            New count
          </button>
        </>
      ) : (
        <>
          <CountFlow key={round} locations={locations} defaultLocationId={locations[0].id} api={fakeCountApi} onFinished={setResult} />
          <CountHistory counts={historyRows()} base="/preview" />
        </>
      )}
    </div>
  );
}
