import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetailTransition } from "@/components/detail-transition";
import { ModelView } from "@/components/stock/model-view";
import { ALL_LOCATIONS, getLocations, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Ball, BallModel } from "@/lib/types";
import { MinimumForm } from "./minimum-form";
import { PriceForm } from "./price-form";

export const metadata: Metadata = { title: "Model" };

export default async function ModelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  // The reads do not depend on each other, so they run in parallel. Row-level security limits each one.
  const ballsIn = async (selected: string) => {
    let query = supabase.from("balls").select("*").eq("model_id", id).eq("status", "in_stock").order("received_at");
    if (selected !== ALL_LOCATIONS) query = query.eq("location_id", selected);
    return ((await query).data ?? []) as Ball[];
  };
  // A query runs again at each await. One promise shares the one read.
  const modelRead = Promise.resolve(supabase.from("ball_models").select("*").eq("id", id).maybeSingle<BallModel>());
  // The other weights of the same model, for the weight switcher. The list treats no brand and an empty brand as one.
  const weightsIn = async (selected: string) => {
    const { data: current } = await modelRead;
    if (!current) return [];
    let siblings = supabase.from("ball_models").select("id, nominal_weight_lb").eq("name", current.name);
    siblings = current.brand ? siblings.eq("brand", current.brand) : siblings.or("brand.is.null,brand.eq.");
    const rows = ((await siblings).data ?? []) as Pick<BallModel, "id" | "nominal_weight_lb">[];
    let counts = supabase.from("stock_counts").select("model_id, in_stock").in("model_id", rows.map((row) => row.id));
    if (selected !== ALL_LOCATIONS) counts = counts.eq("location_id", selected);
    const countRows = ((await counts).data ?? []) as { model_id: string; in_stock: number }[];
    return rows.map((row) => ({
      modelId: row.id,
      weight: Number(row.nominal_weight_lb),
      count: countRows.filter((c) => c.model_id === row.id).reduce((sum, c) => sum + c.in_stock, 0),
    }));
  };
  const [profile, { locations, selected }, { data: model }, balls, allWeights] = await Promise.all([
    requireStaff(),
    getLocations(),
    modelRead,
    getLocations().then(({ selected }) => ballsIn(selected)),
    getLocations().then(({ selected }) => weightsIn(selected)),
  ]);
  if (!model) notFound();

  const weights = allWeights
    .filter((w) => w.count > 0 || w.modelId === model.id)
    .sort((a, b) => b.weight - a.weight);

  const all = selected === ALL_LOCATIONS;
  return (
    <DetailTransition back={"/"}>
      <ModelView
        model={model}
        weights={weights}
        balls={balls}
        place={all ? "all locations" : (locations.find((l) => l.id === selected)?.name ?? "")}
        locationNames={all ? Object.fromEntries(locations.map((l) => [l.id, l.name])) : undefined}
        editable={profile.role === "owner"}
        priceForm={
          profile.role === "owner" ? (
            <div className="flex flex-col items-start">
              <PriceForm modelId={model.id} current={model.selling_price} />
              <MinimumForm modelId={model.id} current={model.min_in_stock} />
            </div>
          ) : undefined
        }
      />
    </DetailTransition>
  );
}
