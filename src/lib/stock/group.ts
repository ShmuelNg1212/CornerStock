// Turns the models and the stock counts into the rows of the stock list.
import type { BallModel } from "@/lib/types";

export type StockModel = Pick<BallModel, "id" | "brand" | "name" | "color" | "nominal_weight_lb">;
export type WeightEntry = { modelId: string; weight: number; count: number };
export type StockGroup = {
  key: string;
  brand: string | null;
  name: string;
  color: string | null;
  total: number;
  /** One entry for each weight in stock, from heavy to light. */
  weights: WeightEntry[];
};

/** One group for each brand and model name. A model with no ball in stock is not shown. */
export function groupStock(models: StockModel[], counts: { model_id: string; in_stock: number }[]): StockGroup[] {
  const byModel = new Map<string, number>();
  for (const row of counts) byModel.set(row.model_id, (byModel.get(row.model_id) ?? 0) + row.in_stock);

  const groups = new Map<string, StockGroup>();
  for (const model of models) {
    const count = byModel.get(model.id) ?? 0;
    if (count <= 0) continue;
    const key = `${model.brand ?? ""}|${model.name}`;
    const group = groups.get(key) ?? { key, brand: model.brand, name: model.name, color: model.color, total: 0, weights: [] };
    group.total += count;
    group.weights.push({ modelId: model.id, weight: Number(model.nominal_weight_lb), count });
    groups.set(key, group);
  }

  const list = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name) || (a.brand ?? "").localeCompare(b.brand ?? ""));
  for (const group of list) group.weights.sort((a, b) => b.weight - a.weight);
  return list;
}

/** The groups whose brand and name contain each word of the search. */
export function filterGroups(groups: StockGroup[], query: string): StockGroup[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return groups;
  return groups.filter((group) => {
    const text = `${group.brand ?? ""} ${group.name}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

export const stockTotal = (groups: StockGroup[]) => groups.reduce((sum, group) => sum + group.total, 0);
