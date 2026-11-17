import { MinimumForm } from "@/app/(app)/(stock)/models/[id]/minimum-form";
import { PriceForm } from "@/app/(app)/(stock)/models/[id]/price-form";
import { DetailTransition } from "@/components/detail-transition";
import { ModelView } from "@/components/stock/model-view";
import { ballsOf, groups, locations, modelOf } from "../../../../fixtures";

export default async function PreviewModel({ params }: { params: Promise<{ id: string }> }) {
  const model = modelOf((await params).id);
  return (
    <DetailTransition back={"/preview/"}>
      <ModelView
        base="/preview"
        model={model}
        weights={groups.find((g) => g.weights.some((w) => w.modelId === model.id))?.weights}
        balls={ballsOf(model.id)}
        place={locations[0].name}
        editable
        priceForm={
          <div className="flex flex-col items-start">
            <PriceForm modelId={model.id} current={model.selling_price} />
            <MinimumForm modelId={model.id} current={model.min_in_stock} />
          </div>
        }
      />
    </DetailTransition>
  );
}
