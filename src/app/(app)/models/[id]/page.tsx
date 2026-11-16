import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ALL_LOCATIONS, getLocations, requireStaff } from "@/lib/auth";
import { grossWeight, number, pinDistance, price } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Ball, BallModel } from "@/lib/types";
import { PriceForm } from "./price-form";

export const metadata: Metadata = { title: "Model" };

export default async function ModelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [profile, { locations, selected }] = await Promise.all([requireStaff(), getLocations()]);
  const supabase = await createClient();

  const { data: model } = await supabase.from("ball_models").select("*").eq("id", id).maybeSingle<BallModel>();
  if (!model) notFound();

  let ballQuery = supabase.from("balls").select("*").eq("model_id", id).eq("status", "in_stock").order("received_at");
  if (selected !== ALL_LOCATIONS) ballQuery = ballQuery.eq("location_id", selected);
  const balls = ((await ballQuery).data ?? []) as Ball[];

  const all = selected === ALL_LOCATIONS;
  const place = all ? "all locations" : (locations.find((l) => l.id === selected)?.name ?? "");
  const locationName = (locationId: string) => locations.find((l) => l.id === locationId)?.name ?? "Closed location";
  const specs: [string, string][] = [
    ["Coverstock", model.coverstock ?? "—"],
    ["Weight block", model.weight_block ?? "—"],
    ["Finish", model.finish ?? "—"],
    ["Color", model.color ?? "—"],
    ["Fragrance", model.fragrance ?? "—"],
    ["RG", number(model.rg, 2)],
    ["Diff", number(model.diff, 3)],
    ["Mass bias", number(model.mass_bias, 3)],
    ["UPC", model.upc],
    ["Product code", model.product_code ?? "—"],
  ];

  return (
    <>
      <Link href="/" className="-ml-1 inline-flex h-10 items-center gap-1 text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-5" aria-hidden="true" />
        Stock
      </Link>
      <div className="mt-1 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold break-words">{model.name}</h1>
          <p className="text-muted-foreground">{[model.brand, `${model.nominal_weight_lb} lb`].filter(Boolean).join(" · ")}</p>
        </div>
        <p className="tabular shrink-0 text-right text-lg font-semibold">{price(model.selling_price)}</p>
      </div>
      {profile.role === "owner" && <PriceForm modelId={model.id} current={model.selling_price} />}

      <section className="mt-6" aria-labelledby="balls-heading">
        <h2 id="balls-heading" className="text-lg font-semibold">
          <span className="tabular">{balls.length}</span> in stock in {place}
        </h2>
        {balls.length === 0 ? (
          <p className="mt-2 text-muted-foreground">No ball of this model and weight is in stock here.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {balls.map((ball) => (
              <li key={ball.id}>
                <Link href={`/balls/${ball.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted">
                  <div className="min-w-0 flex-1">
                    <p className="tabular truncate font-mono font-semibold">{ball.serial}</p>
                    <p className="tabular text-sm text-muted-foreground">
                      {grossWeight(ball.gross_weight_oz)} · Top {number(ball.top_weight, 2)} · Pin {pinDistance(ball)}
                      {all && ` · ${locationName(ball.location_id)}`}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6" aria-labelledby="specs-heading">
        <h2 id="specs-heading" className="text-lg font-semibold">
          Model details
        </h2>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-3">
          {specs.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="tabular font-medium break-words">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
