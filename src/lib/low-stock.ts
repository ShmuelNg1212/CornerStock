// The low-stock alert. See doc/adr/0004-low-stock-minimum.md.
// The owner sets a minimum for a model at one weight. It applies to each active location.
import type { Parsed } from "./label/rules";

export type StockStatus = "ok" | "low" | "out";

/** The minimum as the owner types it. Empty means no minimum. */
export function parseMinimum(text: string): Parsed<number | null> {
  const trimmed = text.trim();
  if (trimmed === "") return { ok: true, value: null };
  if (!/^\d{1,2}$/.test(trimmed)) return { ok: false, error: "Write a whole number from 0 to 99, or leave the field empty." };
  return { ok: true, value: Number(trimmed) };
}

/** The status of one model-weight in one location. A minimum of 0 or none gives no alert. */
export function stockStatus(inStock: number, minimum: number | null): StockStatus {
  if (!minimum) return "ok";
  if (inStock === 0) return "out";
  return inStock < minimum ? "low" : "ok";
}
