import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { getLocations, requireStaff } from "@/lib/auth";
import { day, grossWeight, MOVEMENT_LABEL, number, pinDistance, price, when } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Ball, BallModel, Location, Movement, Profile } from "@/lib/types";
import { BallActions } from "./ball-actions";

export const metadata: Metadata = { title: "Ball" };

export default async function BallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [profile, { locations: activeLocations }] = await Promise.all([requireStaff(), getLocations()]);
  const supabase = await createClient();

  const { data: ball } = await supabase.from("balls").select("*").eq("id", id).maybeSingle<Ball>();
  if (!ball) notFound();

  const [{ data: model }, { data: movements }, { data: people }, { data: allLocations }, photo] = await Promise.all([
    supabase.from("ball_models").select("*").eq("id", ball.model_id).single<BallModel>(),
    supabase.from("stock_movements").select("*").eq("ball_id", id).order("id", { ascending: false }),
    supabase.from("profiles").select("id, full_name"),
    supabase.from("locations").select("id, name, active"),
    ball.label_photo_path
      ? supabase.storage.from("labels").createSignedUrl(ball.label_photo_path, 600)
      : Promise.resolve({ data: null }),
  ]);
  if (!model) notFound();

  const personName = (personId: string) =>
    ((people ?? []) as Pick<Profile, "id" | "full_name">[]).find((p) => p.id === personId)?.full_name || "Staff";
  const locationName = (locationId: string | null) =>
    ((allLocations ?? []) as Location[]).find((l) => l.id === locationId)?.name ?? "—";

  const facts: [string, string][] = [
    ["Gross weight", grossWeight(ball.gross_weight_oz)],
    ["Top weight", number(ball.top_weight, 2)],
    ["Pin distance", pinDistance(ball)],
    ["Boxed on", day(ball.boxed_on)],
    ["Location", locationName(ball.location_id)],
    ["Price", price(model.selling_price)],
  ];

  function describe(move: Movement): string {
    if (move.type === "transfer") return `${locationName(move.from_location_id)} to ${locationName(move.to_location_id)}`;
    if (move.type === "receive") return `Into ${locationName(move.to_location_id)}`;
    if (move.type === "sell") return [`From ${locationName(move.from_location_id)}`, move.reference && `Ref. ${move.reference}`].filter(Boolean).join(" · ");
    return move.reason ?? "";
  }

  return (
    <>
      <Link href={`/models/${model.id}`} className="-ml-1 inline-flex h-10 max-w-full items-center gap-1 text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-5 shrink-0" aria-hidden="true" />
        <span className="truncate">
          {model.name} · {model.nominal_weight_lb} lb
        </span>
      </Link>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="tabular font-mono text-2xl font-bold break-all">{ball.serial}</h1>
        <StatusBadge status={ball.status} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-3">
        {facts.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="tabular font-medium break-words">{value}</dd>
          </div>
        ))}
      </dl>

      <BallActions
        ball={{
          id: ball.id,
          serial: ball.serial,
          status: ball.status,
          location_id: ball.location_id,
          gross_weight: ball.gross_weight_oz === null ? "" : grossWeight(ball.gross_weight_oz),
          top_weight: ball.top_weight === null ? "" : String(Number(ball.top_weight)),
          pin_distance: ball.pin_min === null ? "" : pinDistance(ball).replace('"', "").replace("–", "-"),
          boxed_on: ball.boxed_on ?? "",
        }}
        modelLabel={`${model.name} ${model.nominal_weight_lb} lb`}
        locations={activeLocations}
        owner={profile.role === "owner"}
      />

      <section className="mt-6" aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-lg font-semibold">
          History
        </h2>
        <ol className="mt-2 divide-y divide-border rounded-xl border border-border bg-card">
          {((movements ?? []) as Movement[]).map((move) => (
            <li key={move.id} className="px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="font-semibold">{MOVEMENT_LABEL[move.type]}</p>
                <p className="tabular text-sm text-muted-foreground">{when(move.at)}</p>
              </div>
              <p className="text-sm break-words text-muted-foreground">
                {[describe(move), `By ${personName(move.actor)}`].filter(Boolean).join(" · ")}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {photo.data?.signedUrl && (
        <section className="mt-6" aria-labelledby="photo-heading">
          <h2 id="photo-heading" className="text-lg font-semibold">
            Label photo
          </h2>
          {/* A signed URL changes on each request, so the image optimizer cannot cache it. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.data.signedUrl} alt={`Box label of ${ball.serial}`} className="mt-2 w-full max-w-sm rounded-xl border border-border" />
        </section>
      )}
    </>
  );
}
