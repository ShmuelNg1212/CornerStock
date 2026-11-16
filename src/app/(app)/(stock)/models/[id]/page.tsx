import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetailTransition } from "@/components/detail-transition";
import { ModelView } from "@/components/stock/model-view";
import { ALL_LOCATIONS, getLocations, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Ball, BallModel } from "@/lib/types";
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
  const [profile, { locations, selected }, { data: model }, balls] = await Promise.all([
    requireStaff(),
    getLocations(),
    supabase.from("ball_models").select("*").eq("id", id).maybeSingle<BallModel>(),
    getLocations().then(({ selected }) => ballsIn(selected)),
  ]);
  if (!model) notFound();

  // The other weights of the same model, for the weight switcher.
  let siblings = supabase.from("ball_models").select("id, nominal_weight_lb").eq("name", model.name);
  siblings = model.brand === null ? siblings.is("brand", null) : siblings.eq("brand", model.brand);
  const { data: weightModels } = await siblings;
  const weightIds = ((weightModels ?? []) as Pick<BallModel, "id" | "nominal_weight_lb">[]).map((m) => m.id);
  let countQuery = supabase.from("stock_counts").select("model_id, in_stock").in("model_id", weightIds);
  if (selected !== ALL_LOCATIONS) countQuery = countQuery.eq("location_id", selected);
  const { data: weightCounts } = await countQuery;
  const countOf = (modelId: string) =>
    ((weightCounts ?? []) as { model_id: string; in_stock: number }[]).filter((row) => row.model_id === modelId).reduce((sum, row) => sum + row.in_stock, 0);
  const weights = ((weightModels ?? []) as Pick<BallModel, "id" | "nominal_weight_lb">[])
    .map((m) => ({ modelId: m.id, weight: Number(m.nominal_weight_lb), count: countOf(m.id) }))
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
        priceForm={profile.role === "owner" ? <PriceForm modelId={model.id} current={model.selling_price} /> : undefined}
      />
    </DetailTransition>
  );
}
