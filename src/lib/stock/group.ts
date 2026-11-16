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

export type StockFilters = { weight: number | null; brand: string | null };

/** The groups of one brand, with only one weight in each group. A filter that is null does not apply. */
export function applyFilters(groups: StockGroup[], { weight, brand }: StockFilters): StockGroup[] {
  if (weight === null && brand === null) return groups;
  const wanted = brand?.toLowerCase();
  const list: StockGroup[] = [];
  for (const group of groups) {
    if (wanted !== undefined && (group.brand ?? "").toLowerCase() !== wanted) continue;
    if (weight === null) {
      list.push(group);
      continue;
    }
    const entry = group.weights.find((w) => w.weight === weight);
    if (entry) list.push({ ...group, total: entry.count, weights: [entry] });
  }
  return list;
}

/** The balls of each weight in stock, from heavy to light. */
export function weightCounts(groups: StockGroup[]): { weight: number; count: number }[] {
  const counts = new Map<number, number>();
  for (const group of groups) for (const w of group.weights) counts.set(w.weight, (counts.get(w.weight) ?? 0) + w.count);
  return [...counts].map(([weight, count]) => ({ weight, count })).sort((a, b) => b.weight - a.weight);
}

/** The balls of each brand in stock, by brand name. A model with no brand is not counted. */
export function brandCounts(groups: StockGroup[]): { brand: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const group of groups) if (group.brand) counts.set(group.brand, (counts.get(group.brand) ?? 0) + group.total);
  return [...counts].map(([brand, count]) => ({ brand, count })).sort((a, b) => a.brand.localeCompare(b.brand));
}

/** The filters in the address (`?w=15&b=Storm`). A value that is not in stock is ignored. */
export function parseFilters(params: { w: string | null; b: string | null }, groups: StockGroup[]): StockFilters {
  const w = params.w && /^\d{1,2}$/.test(params.w) ? Number(params.w) : null;
  const weight = w !== null && groups.some((g) => g.weights.some((e) => e.weight === w)) ? w : null;
  const wanted = params.b?.trim().toLowerCase();
  const brand = (wanted && groups.find((g) => g.brand?.toLowerCase() === wanted)?.brand) || null;
  return { weight, brand };
}
