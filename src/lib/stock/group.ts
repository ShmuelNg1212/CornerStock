// Turns the models and the stock counts into the rows of the stock list.
import type { StockStatus } from "@/lib/low-stock";
import { matches } from "@/lib/search";
import type { BallModel } from "@/lib/types";

export type StockModel = Pick<BallModel, "id" | "brand" | "name" | "color" | "nominal_weight_lb">;
/** `status`: low or out when a location is below the minimum. See doc/adr/0004-low-stock-minimum.md. */
export type WeightEntry = { modelId: string; weight: number; count: number; status: StockStatus; minimum: number | null };
/** A row of the database view `low_stock`: one model in one location below its minimum. */
export type LowRow = { model_id: string; in_stock: number; min_in_stock: number };
export type StockGroup = {
  key: string;
  brand: string | null;
  name: string;
  color: string | null;
  total: number;
  /** One entry for each weight in stock or low, from heavy to light. */
  weights: WeightEntry[];
};

/**
 * One group for each brand and model name. A model with no ball in stock is not shown, except when it
 * is low: `low` has the rows of the selected location, or of all locations. A model with a low row in
 * any of them is low, or out when no ball of it is in stock.
 */
export function groupStock(models: StockModel[], counts: { model_id: string; in_stock: number }[], low: LowRow[] = []): StockGroup[] {
  const byModel = new Map<string, number>();
  for (const row of counts) byModel.set(row.model_id, (byModel.get(row.model_id) ?? 0) + row.in_stock);
  const minimums = new Map(low.map((row) => [row.model_id, row.min_in_stock]));

  const groups = new Map<string, StockGroup>();
  for (const model of models) {
    const count = byModel.get(model.id) ?? 0;
    const minimum = minimums.get(model.id) ?? null;
    if (count <= 0 && minimum === null) continue;
    const key = `${model.brand ?? ""}|${model.name}`;
    const group = groups.get(key) ?? { key, brand: model.brand, name: model.name, color: model.color, total: 0, weights: [] };
    group.total += count;
    const status: StockStatus = minimum === null ? "ok" : count === 0 ? "out" : "low";
    group.weights.push({ modelId: model.id, weight: Number(model.nominal_weight_lb), count, status, minimum });
    groups.set(key, group);
  }

  const list = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name) || (a.brand ?? "").localeCompare(b.brand ?? ""));
  for (const group of list) group.weights.sort((a, b) => b.weight - a.weight);
  return list;
}

/** The groups whose brand and name match the search. See `matches` for the forgiving rules. */
export function filterGroups(groups: StockGroup[], query: string): StockGroup[] {
  return groups.filter((group) => matches(`${group.brand ?? ""} ${group.name}`, query));
}

export const stockTotal = (groups: StockGroup[]) => groups.reduce((sum, group) => sum + group.total, 0);

/** `low`: only the weights that are low or out. */
export type StockFilters = { weight: number | null; brand: string | null; low?: boolean };

/** The low and out weights. */
export const lowCount = (groups: StockGroup[]) => groups.reduce((sum, group) => sum + group.weights.filter((w) => w.status !== "ok").length, 0);

/** The groups of one brand, with only the chosen weight, or the low weights, in each group. A filter that is null or false does not apply. */
export function applyFilters(groups: StockGroup[], { weight, brand, low = false }: StockFilters): StockGroup[] {
  if (weight === null && brand === null && !low) return groups;
  const wanted = brand?.toLowerCase();
  const list: StockGroup[] = [];
  for (const group of groups) {
    if (wanted !== undefined && (group.brand ?? "").toLowerCase() !== wanted) continue;
    const weights = group.weights.filter((w) => (weight === null || w.weight === weight) && (!low || w.status !== "ok"));
    if (weights.length === group.weights.length) list.push(group);
    else if (weights.length) list.push({ ...group, total: weights.reduce((sum, w) => sum + w.count, 0), weights });
  }
  return list;
}

/** The balls of each weight in stock, from heavy to light. */
export function weightCounts(groups: StockGroup[]): { weight: number; count: number }[] {
  const counts = new Map<number, number>();
  for (const group of groups) for (const w of group.weights) if (w.count > 0) counts.set(w.weight, (counts.get(w.weight) ?? 0) + w.count);
  return [...counts].map(([weight, count]) => ({ weight, count })).sort((a, b) => b.weight - a.weight);
}

/** The balls of each brand in stock, by brand name. A model with no brand is not counted. */
export function brandCounts(groups: StockGroup[]): { brand: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const group of groups) if (group.brand && group.total > 0) counts.set(group.brand, (counts.get(group.brand) ?? 0) + group.total);
  return [...counts].map(([brand, count]) => ({ brand, count })).sort((a, b) => a.brand.localeCompare(b.brand));
}

/** The filters in the address (`?w=15&b=Storm&l=1`). A value that is not in stock, or no low weight, is ignored. */
export function parseFilters(params: { w: string | null; b: string | null; l?: string | null }, groups: StockGroup[]): StockFilters {
  const w = params.w && /^\d{1,2}$/.test(params.w) ? Number(params.w) : null;
  const weight = w !== null && groups.some((g) => g.weights.some((e) => e.weight === w)) ? w : null;
  const wanted = params.b?.trim().toLowerCase();
  const brand = (wanted && groups.find((g) => g.brand?.toLowerCase() === wanted)?.brand) || null;
  const low = params.l === "1" && lowCount(groups) > 0;
  return { weight, brand, low };
}
