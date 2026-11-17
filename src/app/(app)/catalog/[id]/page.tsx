import { notFound } from "next/navigation";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ModelDetailsEditor } from "@/components/stock/model-details-editor";
import { PriceForm } from "../../(stock)/models/[id]/price-form";
import { buttonClass } from "@/components/ui/field";
import { price } from "@/lib/format";
import type { BallModel } from "@/lib/types";

export const metadata = { title: "Catalog model" };
export default async function CatalogModel({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, profile, client] = await Promise.all([
    params,
    requireStaff(),
    createClient(),
  ]);
  const { data, error } = await client
    .from("ball_models")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) notFound();
  const model = data as BallModel;
  const fields = [
    ["UPC", model.upc],
    ["Weight", `${model.nominal_weight_lb} lb`],
    ["Brand", model.brand],
    ["Color", model.color],
    ["Fragrance", model.fragrance],
    ["Coverstock", model.coverstock],
    ["Weight block", model.weight_block],
    ["Finish", model.finish],
    ["RG", model.rg],
    ["Differential", model.diff],
    ["Mass bias", model.mass_bias],
    ["Product code", model.product_code],
  ];
  const details = (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fields.map(([label, value]) => (
        <div key={label}>
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd
            className={`mt-1 font-medium break-words ${label === "UPC" || label === "Product code" ? "font-mono" : ""}`}
          >
            {value ?? "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/catalog" className={buttonClass.link}>
        ← Catalog
      </Link>
      <h1 className="font-heading mt-4 text-2xl font-bold break-words">
        {model.name}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {model.nominal_weight_lb} lb · {price(model.selling_price)}
      </p>
      <section
        aria-label="Model details"
        className="mt-6 rounded-(--radius-card) bg-card p-5 shadow-(--shadow-card)"
      >
        {profile.role === "owner" ? (
          <ModelDetailsEditor model={model}>{details}</ModelDetailsEditor>
        ) : (
          details
        )}
      </section>
      {profile.role === "owner" && (
        <section
          aria-label="Selling price"
          className="mt-5 rounded-(--radius-card) bg-card p-5 shadow-(--shadow-card)"
        >
          <h2 className="mb-3 font-semibold">Selling price</h2>
          <PriceForm modelId={model.id} current={model.selling_price} />
        </section>
      )}
      <Link
        href={`/models/${model.id}`}
        className={`${buttonClass.quiet} mt-6`}
      >
        View stock for this model
      </Link>
    </div>
  );
}
