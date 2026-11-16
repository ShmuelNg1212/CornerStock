import { Suspense } from "react";
import { StockFrame } from "@/components/stock/stock-frame";
import { StockList } from "@/components/stock/stock-list";
import { StockListSkeleton } from "@/components/ui/skeleton";
import { ALL_LOCATIONS, getLocations } from "@/lib/auth";
import { groupStock, type StockModel } from "@/lib/stock/group";
import { createClient } from "@/lib/supabase/server";

async function List() {
  const supabase = await createClient();
  const countsIn = async (selected: string) => {
    let query = supabase.from("stock_counts").select("model_id, in_stock");
    if (selected !== ALL_LOCATIONS) query = query.eq("location_id", selected);
    return ((await query).data ?? []) as { model_id: string; in_stock: number }[];
  };
  // The catalog is small. Read all models in parallel with the counts; groupStock keeps only the models in stock.
  const locationsRead = getLocations();
  const [{ locations, selected }, counts, { data: modelRows }] = await Promise.all([
    locationsRead,
    locationsRead.then(({ selected }) => countsIn(selected)),
    supabase.from("ball_models").select("id, brand, name, color, nominal_weight_lb"),
  ]);
  let models = (modelRows ?? []) as StockModel[];
  // Supabase returns at most 1000 rows. A larger catalog reads only the models in stock.
  if (models.length >= 1000) {
    const ids = [...new Set(counts.map((row) => row.model_id))];
    models = ids.length
      ? (((await supabase.from("ball_models").select("id, brand, name, color, nominal_weight_lb").in("id", ids)).data ?? []) as StockModel[])
      : [];
  }

  const place = selected === ALL_LOCATIONS ? "all locations" : (locations.find((l) => l.id === selected)?.name ?? "");
  return (
    // A new location is a new list. The key stops marks for counts that changed only because the location changed.
    <StockList
      key={selected}
      groups={groupStock(models, counts)}
      place={place}
      locationNames={Object.fromEntries(locations.map((l) => [l.id, l.name]))}
    />
  );
}

/** The stock list stays on screen while the detail of a model or a ball changes. */
export default function StockLayout({ children }: { children: React.ReactNode }) {
  return (
    <StockFrame
      list={
        <Suspense fallback={<StockListSkeleton />}>
          <List />
        </Suspense>
      }
    >
      {children}
    </StockFrame>
  );
}
