import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { SectionTitle } from "@/components/ui/field";
import { day, grossWeight, MOVEMENT_LABEL, number, pinDistance, price, when } from "@/lib/format";
import type { Ball, BallModel, Movement } from "@/lib/types";

const BACK = ["nav-back"];

/** One ball: its values, its actions, its history, and the photo of its label. */
export function BallView({
  ball,
  model,
  movements,
  locationName,
  personName,
  photoUrl,
  actions,
  base = "",
}: {
  ball: Ball;
  model: BallModel;
  movements: Movement[];
  locationName: (id: string | null) => string;
  personName: (id: string) => string;
  photoUrl?: string | null;
  /** The buttons and forms that change the ball. */
  actions?: React.ReactNode;
  base?: string;
}) {
  const facts: [string, string][] = [
    ["Gross weight", grossWeight(ball.gross_weight_oz)],
    ["Top weight", number(ball.top_weight, 2)],
    ["Pin distance", pinDistance(ball)],
    ["Boxed on", day(ball.boxed_on)],
    ["Location", locationName(ball.location_id)],
    ["Price", price(model.selling_price)],
  ];
  const noValues = ball.gross_weight_oz === null && ball.top_weight === null && ball.pin_min === null;

  function describe(move: Movement): string {
    if (move.type === "transfer") return `${locationName(move.from_location_id)} to ${locationName(move.to_location_id)}`;
    if (move.type === "receive") return `Into ${locationName(move.to_location_id)}`;
    if (move.type === "sell") return [`From ${locationName(move.from_location_id)}`, move.reference && `Ref. ${move.reference}`].filter(Boolean).join(" · ");
    return move.reason ?? "";
  }

  return (
    <>
      <Link
        href={`${base}/models/${model.id}`}
        transitionTypes={BACK}
        className="-ml-1.5 inline-flex h-11 max-w-full items-center gap-1 rounded-lg pr-2 text-muted-foreground outline-none transition-colors duration-(--dur-fast) hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <ChevronLeft className="size-5 shrink-0" aria-hidden="true" />
        <span className="truncate">
          {model.name} · {Number(model.nominal_weight_lb)} lb
        </span>
      </Link>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="tabular font-mono text-2xl font-bold break-all">{ball.serial}</h1>
        <StatusBadge status={ball.status} />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3.5 sm:grid-cols-3 lg:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="tabular font-medium break-words">{value}</dd>
          </div>
        ))}
      </dl>
      {noValues && <p className="mt-3 text-sm text-muted-foreground">The weights and the pin distance are not recorded for this ball.</p>}

      {actions}

      <section className="mt-7" aria-labelledby="history-heading">
        <SectionTitle id="history-heading">History</SectionTitle>
        <ol className="mt-2 divide-y divide-border border-y border-border">
          {movements.map((move) => (
            <li key={move.id} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="font-semibold">{MOVEMENT_LABEL[move.type]}</p>
                <p className="tabular text-sm text-muted-foreground">{when(move.at)}</p>
              </div>
              <p className="text-sm break-words text-muted-foreground">{[describe(move), `By ${personName(move.actor)}`].filter(Boolean).join(" · ")}</p>
            </li>
          ))}
        </ol>
      </section>

      {photoUrl && (
        <section className="mt-7" aria-labelledby="photo-heading">
          <SectionTitle id="photo-heading">Label photo</SectionTitle>
          {/* A signed URL changes on each request, so the image optimizer cannot cache it. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt={`Box label of ${ball.serial}`} className="mt-2 w-full max-w-sm rounded-xl border border-border" />
        </section>
      )}
    </>
  );
}
