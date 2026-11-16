import { Camera, ChevronRight, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { buttonClass, inputClass } from "@/components/ui/field";
import { ALL_LOCATIONS, getLocations } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { BallModel, BallStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Stock" };

type Count = { model_id: string; location_id: string; in_stock: number };
type Group = { key: string; brand: string | null; name: string; color: string | null; total: number; weights: { model: BallModel; count: number }[] };

export default async function StockPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const query = ((await searchParams).q ?? "").trim().slice(0, 60);
  const { locations, selected } = await getLocations();
  const supabase = await createClient();

  let countQuery = supabase.from("stock_counts").select("model_id, location_id, in_stock");
  if (selected !== ALL_LOCATIONS) countQuery = countQuery.eq("location_id", selected);
  const counts = ((await countQuery).data ?? []) as Count[];

  const byModel = new Map<string, number>();
  for (const row of counts) byModel.set(row.model_id, (byModel.get(row.model_id) ?? 0) + row.in_stock);

  const models = byModel.size
    ? (((await supabase.from("ball_models").select("*").in("id", [...byModel.keys()])).data ?? []) as BallModel[])
    : [];

  const needle = query.toLowerCase();
  const groups = new Map<string, Group>();
  for (const model of models) {
    if (needle && !`${model.brand ?? ""} ${model.name}`.toLowerCase().includes(needle)) continue;
    const key = `${model.brand ?? ""}|${model.name}`;
    const group = groups.get(key) ?? { key, brand: model.brand, name: model.name, color: model.color, total: 0, weights: [] };
    const count = byModel.get(model.id) ?? 0;
    group.total += count;
    group.weights.push({ model, count });
    groups.set(key, group);
  }
  const list = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
  for (const group of list) group.weights.sort((a, b) => b.model.nominal_weight_lb - a.model.nominal_weight_lb);

  // A search also looks for a serial number, in all locations and all statuses.
  const serialMatches =
    query.length >= 3
      ? (((
          await supabase
            .from("balls")
            .select("id, serial, status, location_id, ball_models(name, nominal_weight_lb)")
            .ilike("serial", `%${query.replace(/[%_\\]/g, "\\$&")}%`)
            .limit(8)
        ).data ?? []) as unknown as {
          id: string;
          serial: string;
          status: BallStatus;
          location_id: string;
          ball_models: { name: string; nominal_weight_lb: number };
        }[])
      : [];

  const total = [...byModel.values()].reduce((sum, n) => sum + n, 0);
  const place = selected === ALL_LOCATIONS ? "all locations" : (locations.find((l) => l.id === selected)?.name ?? "");
  const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? "Closed location";

  return (
    <>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Stock</h1>
          <p className="truncate text-muted-foreground">
            <span className="tabular font-semibold text-foreground">{total}</span> {total === 1 ? "ball" : "balls"} in {place}
          </p>
        </div>
        <Link href="/scan" className={`${buttonClass.action} shrink-0`}>
          <Camera className="size-5" aria-hidden="true" />
          Scan label
        </Link>
      </div>

      <form action="/" className="relative mt-4" role="search">
        <Search className="pointer-events-none absolute top-3.5 left-3 size-5 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search a model or a serial number"
          aria-label="Search a model or a serial number"
          autoCapitalize="characters"
          autoCorrect="off"
          enterKeyHint="search"
          className={`${inputClass} pl-10`}
        />
      </form>

      {serialMatches.length > 0 && (
        <section className="mt-5" aria-labelledby="serial-matches">
          <h2 id="serial-matches" className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Serial numbers
          </h2>
          <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {serialMatches.map((ball) => (
              <li key={ball.id}>
                <Link href={`/balls/${ball.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted">
                  <div className="min-w-0 flex-1">
                    <p className="tabular truncate font-mono font-semibold">{ball.serial}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {ball.ball_models.name} · {ball.ball_models.nominal_weight_lb} lb · {locationName(ball.location_id)}
                    </p>
                  </div>
                  <StatusBadge status={ball.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {list.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-input px-6 py-10 text-center">
          {query ? (
            <>
              <p className="font-semibold">No model in stock matches “{query}”</p>
              <p className="mt-1 text-muted-foreground">Check the spelling, or select another location.</p>
              <Link href="/" className={`${buttonClass.quiet} mt-5`}>
                Clear search
              </Link>
            </>
          ) : (
            <>
              <p className="font-semibold">No balls in stock here yet</p>
              <p className="mt-1 text-muted-foreground">Scan the label on a ball box to add the first one.</p>
            </>
          )}
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {list.map((group) => (
            <li key={group.key} className="rounded-xl border border-border bg-card">
              <div className="flex items-baseline justify-between gap-3 px-4 pt-3">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold">{group.name}</h2>
                  <p className="truncate text-sm text-muted-foreground">{[group.brand, group.color].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                <p className="tabular shrink-0 text-sm text-muted-foreground">
                  <span className="text-lg font-semibold text-foreground">{group.total}</span> in stock
                </p>
              </div>
              <ul className="mt-2 divide-y divide-border border-t border-border">
                {group.weights.map(({ model, count }) => (
                  <li key={model.id}>
                    <Link href={`/models/${model.id}`} className="flex h-12 items-center gap-3 px-4 hover:bg-muted">
                      <span className="tabular w-14 font-semibold">{model.nominal_weight_lb} lb</span>
                      <span className="tabular flex-1 text-muted-foreground">
                        {count} {count === 1 ? "ball" : "balls"}
                      </span>
                      <ChevronRight className="size-5 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
