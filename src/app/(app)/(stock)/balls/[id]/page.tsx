import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetailTransition } from "@/components/detail-transition";
import { BallView } from "@/components/stock/ball-view";
import { getLocations, requireStaff } from "@/lib/auth";
import { grossWeight, pinDistance } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Ball, BallModel, Location, Movement, Profile } from "@/lib/types";
import { BallActions } from "./ball-actions";

export const metadata: Metadata = { title: "Ball" };

export default async function BallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const ballRead = supabase.from("balls").select("*, ball_models(*)").eq("id", id).maybeSingle<Ball & { ball_models: BallModel | null }>();
  // The reads do not depend on each other, so they run in parallel. Row-level security limits each one.
  const [profile, { locations: activeLocations }, { data: row }, photo, { data: movements }, { data: people }, { data: allLocations }] =
    await Promise.all([
      requireStaff(),
      getLocations(),
      ballRead,
      ballRead.then(async ({ data }): Promise<{ data: { signedUrl: string } | null }> =>
        data?.label_photo_path ? supabase.storage.from("labels").createSignedUrl(data.label_photo_path, 600) : { data: null },
      ),
      supabase.from("stock_movements").select("*").eq("ball_id", id).order("id", { ascending: false }),
      supabase.from("profiles").select("id, full_name"),
      supabase.from("locations").select("id, name, active"),
    ]);
  if (!row?.ball_models) notFound();
  const { ball_models: model, ...ball } = row;

  const personName = (personId: string) =>
    ((people ?? []) as Pick<Profile, "id" | "full_name">[]).find((p) => p.id === personId)?.full_name || "Staff";
  const locationName = (locationId: string | null) =>
    ((allLocations ?? []) as Location[]).find((l) => l.id === locationId)?.name ?? "—";

  return (
    <DetailTransition back={`/models/${model.id}`}>
      <BallView
        ball={ball}
        model={model}
        movements={(movements ?? []) as Movement[]}
        locationName={locationName}
        personName={personName}
        photoUrl={photo.data?.signedUrl}
        actions={
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
        }
      />
    </DetailTransition>
  );
}
