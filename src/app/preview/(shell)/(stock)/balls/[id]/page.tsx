import { BallActions } from "@/app/(app)/(stock)/balls/[id]/ball-actions";
import { DetailTransition } from "@/components/detail-transition";
import { BallView } from "@/components/stock/ball-view";
import { ballsOf, locationName, locations, models, movements, personName } from "../../../../fixtures";

export default async function PreviewBall({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const model = models[1];
  const all = ballsOf(model.id);
  const ball = { ...(all.find((b) => b.id === id) ?? all[0]), ...(id === "b9" ? { status: "sold" as const } : {}) };
  return (
    <DetailTransition back={`/preview/models/${model.id}`}>
      <BallView
        base="/preview"
        ball={ball}
        model={model}
        movements={movements}
        locationName={locationName}
        personName={personName}
        actions={
          <BallActions
            ball={{ id: ball.id, serial: ball.serial, status: ball.status, location_id: ball.location_id, gross_weight: "15 lb 2 oz", top_weight: "2.75", pin_distance: "2-3", boxed_on: "2026-08-14" }}
            modelLabel={`${model.name} ${model.nominal_weight_lb} lb`}
            locations={locations}
            owner
          />
        }
      />
    </DetailTransition>
  );
}
