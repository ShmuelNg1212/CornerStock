import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { SectionTitle } from "@/components/ui/field";
import { grossWeight, number, pinDistance, price } from "@/lib/format";
import type { Ball, BallModel } from "@/lib/types";

const BACK = ["nav-back"];
const FORWARD = ["nav-forward"];

/** The values of one ball in a short line, or a clear text when none are recorded. */
function ballValues(ball: Ball): string {
  if (ball.gross_weight_oz === null && ball.top_weight === null && ball.pin_min === null) return "Weights and pin not recorded";
  return `${grossWeight(ball.gross_weight_oz)} · Top ${number(ball.top_weight, 2)} · Pin ${pinDistance(ball)}`;
}

/** One model at one weight: its balls in stock and its catalog details. */
export function ModelView({
  model,
  balls,
  place,
  locationNames,
  priceForm,
  base = "",
}: {
  model: BallModel;
  balls: Ball[];
  place: string;
  /** Set when all locations show. Each ball then shows its location. */
  locationNames?: Record<string, string>;
  /** The owner's price form. */
  priceForm?: React.ReactNode;
  base?: string;
}) {
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
      <Link
        href={`${base}/`}
        transitionTypes={BACK}
        className="-ml-1.5 inline-flex h-11 items-center gap-1 rounded-lg pr-2 text-muted-foreground outline-none transition-colors duration-(--dur-fast) hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 lg:hidden"
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
        Stock
      </Link>

      <p className="text-muted-foreground lg:mt-0">{model.brand ?? "No brand recorded"}</p>
      <h1 className="text-2xl leading-tight font-bold break-words lg:text-[1.75rem]">{model.name}</h1>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-heading tabular rounded-md bg-gold px-2.5 py-1 text-sm font-bold text-foreground">{Number(model.nominal_weight_lb)} LB</span>
        <span className="tabular font-heading text-lg font-semibold">{price(model.selling_price)}</span>
      </div>
      {priceForm}

      <section className="mt-7" aria-labelledby="balls-heading">
        <h2 id="balls-heading" className="text-lg font-semibold">
          <span className="tabular">{balls.length}</span> in stock <span className="font-sans text-base font-normal text-muted-foreground">in {place}</span>
        </h2>
        {balls.length === 0 ? (
          <p className="mt-2 text-muted-foreground">No ball of this model and weight is in stock here. Select another location, or scan a label to add one.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border border-y border-border">
            {balls.map((ball) => (
              <li key={ball.id}>
                <Link
                  href={`${base}/balls/${ball.id}`}
                  transitionTypes={FORWARD}
                  className="-mx-2 flex min-h-14 items-center gap-3 rounded-lg px-2 py-2.5 outline-none transition-colors duration-(--dur-fast) hover:bg-muted focus-visible:bg-muted"
                >
                  <div className="min-w-0 flex-1">
                    <p className="tabular font-mono font-semibold break-all">{ball.serial}</p>
                    <p className="tabular text-sm text-muted-foreground">
                      {ballValues(ball)}
                      {locationNames && ` · ${locationNames[ball.location_id] ?? "Closed location"}`}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-7" aria-labelledby="specs-heading">
        <SectionTitle id="specs-heading">Model details</SectionTitle>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3.5">
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
