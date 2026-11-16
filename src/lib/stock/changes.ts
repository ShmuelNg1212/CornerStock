// Finds the counts that changed between two loads of the stock list.
// The list marks these rows, so a change from another device is visible.
import type { StockGroup } from "./group";

/** Model id to its count. */
export type CountSnapshot = Record<string, number>;

export function snapshot(groups: StockGroup[]): CountSnapshot {
  const counts: CountSnapshot = {};
  for (const group of groups) for (const weight of group.weights) counts[weight.modelId] = weight.count;
  return counts;
}

/**
 * Model id to the change of its count. Only models that have a row now are in the result.
 * The first load (no earlier snapshot) marks nothing.
 */
export function changedModels(before: CountSnapshot | null, now: CountSnapshot): Record<string, number> {
  if (!before) return {};
  const changed: Record<string, number> = {};
  for (const [modelId, count] of Object.entries(now)) {
    const delta = count - (before[modelId] ?? 0);
    if (delta !== 0) changed[modelId] = delta;
  }
  return changed;
}
