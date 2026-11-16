"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { StockList } from "@/components/stock/stock-list";
import { DetailSkeleton, StockListSkeleton } from "@/components/ui/skeleton";
import type { StockGroup } from "@/lib/stock/group";

/** States of the stock list that the main preview does not show. Select one with `?state=`. */
export function States({ groups, worst, locationNames }: { groups: StockGroup[]; worst: StockGroup[]; locationNames: Record<string, string> }) {
  const state = useSearchParams().get("state") ?? "worst";
  const [live, setLive] = useState(groups);

  // "live": after a short time, one count goes up and one goes down, as if another device changed the stock.
  useEffect(() => {
    if (state !== "live") return;
    const timer = setTimeout(() => {
      setLive((current) =>
        current.map((group, i) =>
          i === 1 || i === 3
            ? { ...group, total: group.total + (i === 1 ? 1 : -1), weights: group.weights.map((w, j) => (j === 0 ? { ...w, count: w.count + (i === 1 ? 1 : -1) } : w)) }
            : group,
        ),
      );
    }, 1200);
    return () => clearTimeout(timer);
  }, [state]);

  if (state === "loading")
    return (
      <div className="grid gap-8 lg:grid-cols-2">
        <StockListSkeleton />
        <DetailSkeleton />
      </div>
    );
  const list = state === "empty" ? [] : state === "live" ? live : state === "worst" ? worst : groups;
  return <StockList key={state} base="/preview" groups={list} place="Sta. Lucia East" locationNames={locationNames} fixtureSerials={[]} />;
}
