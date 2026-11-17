import { Suspense } from "react";
import { StockFrame } from "@/components/stock/stock-frame";
import { StockList } from "@/components/stock/stock-list";
import { StockListSkeleton } from "@/components/ui/skeleton";
import { ALL_LOCATIONS, getLocations } from "@/lib/auth";
import { groupStock, type LowRow, type StockModel } from "@/lib/stock/group";
import { startOfManilaDay, todayCounts, type TodayMovement } from "@/lib/stock/today";
import { createClient } from "@/lib/supabase/server";

async function List() {
  const supabase = await createClient();
  const columns = "id, brand, name, color, nominal_weight_lb";
  const countsIn = async (selected: string) => {
    let query = supabase.from("stock_counts").select("model_id, in_stock");
    if (selected !== ALL_LOCATIONS) query = query.eq("location_id", selected);
    return ((await query).data ?? []) as { model_id: string; in_stock: number }[];
  };
  // The models below their minimum, in the selected location or in any location (doc/adr/0004-low-stock-minimum.md).
  const lowIn = async (selected: string) => {
    let query = supabase.from("low_stock").select("model_id, in_stock, min_in_stock");
    if (selected !== ALL_LOCATIONS) query = query.eq("location_id", selected);
    return ((await query).data ?? []) as LowRow[];
  };
  // The catalog is small. Read it in parallel with the counts; groupStock keeps only the models in stock.
  // The movements of today give the "In today" and "Sold today" tiles. A day has few movements.
  const since = startOfManilaDay(new Date()).toISOString();
  const [{ locations, selected }, counts, low, { data: catalog }, { data: moves }] = await Promise.all([
    getLocations(),
    getLocations().then(({ selected }) => countsIn(selected)),
    getLocations().then(({ selected }) => lowIn(selected)),
    supabase.from("ball_models").select(columns),
    supabase
      .from("stock_movements")
      .select("ball_id, type, from_location_id, to_location_id")
      .gte("at", since)
      .in("type", ["receive", "sell", "reverse_sale"])
      .order("id"),
  ]);
  const models = (catalog ?? []) as StockModel[];
  // The API returns a limited number of rows. Read any counted model that the catalog read did not return.
  const read = new Set(models.map((m) => m.id));
  const missing = [...new Set([...counts, ...low].map((row) => row.model_id))].filter((id) => !read.has(id));
  if (missing.length) {
    const { data } = await supabase.from("ball_models").select(columns).in("id", missing);
    models.push(...((data ?? []) as StockModel[]));
  }

  const place = selected === ALL_LOCATIONS ? "all locations" : (locations.find((l) => l.id === selected)?.name ?? "");
  return (
    // A new location is a new list. The key stops marks for counts that changed only because the location changed.
    <StockList
      key={selected}
      groups={groupStock(models, counts, low)}
      place={place}
      today={todayCounts((moves ?? []) as TodayMovement[], selected)}
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
