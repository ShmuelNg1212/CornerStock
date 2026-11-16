import { PriceForm } from "@/app/(app)/(stock)/models/[id]/price-form";
import { DetailTransition } from "@/components/detail-transition";
import { ModelView } from "@/components/stock/model-view";
import { ballsOf, locations, modelOf } from "../../../../fixtures";

export default async function PreviewModel({ params }: { params: Promise<{ id: string }> }) {
  const model = modelOf((await params).id);
  return (
    <DetailTransition>
      <ModelView
        base="/preview"
        model={model}
        balls={ballsOf(model.id)}
        place={locations[0].name}
        priceForm={<PriceForm modelId={model.id} current={model.selling_price} />}
      />
    </DetailTransition>
  );
}
