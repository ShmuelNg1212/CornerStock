import { day, grossWeight, MOVEMENT_LABEL, number, pinDistance, price } from "@/lib/format";
import type { MovementType } from "@/lib/types";

export type ActivityType = MovementType | "model_edit";

/** One row of `public.activity_feed`. `at` stays the exact text from the database: it is the page cursor. */
export type ActivityRow = {
  src: number;
  id: number;
  at: string;
  type: ActivityType;
  actor_name: string | null;
  ball_id: string | null;
  serial: string | null;
  model_id: string;
  model_name: string;
  brand: string | null;
  weight_lb: number;
  from_location: string | null;
  to_location: string | null;
  reason: string | null;
  reference: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
};

export const ACTIVITY_LABEL: Record<ActivityType, string> = { ...MOVEMENT_LABEL, model_edit: "Catalog edited" };

export const ACTIVITY_FILTERS = [
  { key: "all", label: "All", types: null },
  { key: "added", label: "Added", types: ["receive"] },
  { key: "sold", label: "Sold", types: ["sell"] },
  { key: "cancelled", label: "Cancelled", types: ["reverse_sale"] },
  { key: "moved", label: "Moved", types: ["transfer"] },
  { key: "edited", label: "Edited", types: ["adjust", "model_edit"] },
  { key: "removed", label: "Removed", types: ["remove"] },
] as const satisfies readonly { key: string; label: string; types: readonly ActivityType[] | null }[];

export type ActivityFilter = (typeof ACTIVITY_FILTERS)[number]["key"];

/** The types of a filter. An unknown or missing filter gives all types. */
export function filterTypes(key: string | undefined): ActivityType[] | null {
  const types = ACTIVITY_FILTERS.find((f) => f.key === key)?.types;
  return types ? [...types] : null;
}

export function activityDetail(row: ActivityRow): string {
  switch (row.type) {
    case "receive":
      return row.to_location ? `Into ${row.to_location}` : "";
    case "sell":
      return [row.from_location && `From ${row.from_location}`, row.reference && `Ref. ${row.reference}`].filter(Boolean).join(" · ");
    case "transfer":
      return `${row.from_location ?? "—"} → ${row.to_location ?? "—"}`;
    default:
      return row.reason ?? "";
  }
}

type Change = { field: string; before: string; after: string };

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const text = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));
const withUnit = (unit: string) => (v: unknown) => (num(v) === null ? "—" : `${number(num(v))} ${unit}`);

const FIELDS: Record<string, { label: string; show: (v: unknown) => string }> = {
  // Ball values.
  serial: { label: "Serial", show: text },
  gross_weight_oz: { label: "Weight", show: (v) => grossWeight(num(v)) },
  top_weight: { label: "Top weight", show: withUnit("oz") },
  boxed_on: { label: "Boxed on", show: (v) => day((v as string | null) ?? null) },
  // Catalog values.
  name: { label: "Name", show: text },
  brand: { label: "Brand", show: text },
  color: { label: "Color", show: text },
  fragrance: { label: "Fragrance", show: text },
  coverstock: { label: "Coverstock", show: text },
  weight_block: { label: "Core", show: text },
  finish: { label: "Finish", show: text },
  rg: { label: "RG", show: (v) => number(num(v)) },
  diff: { label: "Diff", show: (v) => number(num(v)) },
  mass_bias: { label: "Mass bias", show: (v) => number(num(v)) },
  product_code: { label: "Product code", show: text },
  selling_price: { label: "Price", show: (v) => (num(v) === null ? "—" : price(num(v))) },
  min_in_stock: { label: "Keep in stock", show: (v) => (num(v) === null ? "No minimum" : String(num(v))) },
};

const same = (a: unknown, b: unknown) => (typeof a === "number" || typeof b === "number" ? num(a) === num(b) : (a ?? null) === (b ?? null));

/** The values that an edit changed, in words. Pin min and max show as one pin distance. */
export function activityChanges(row: ActivityRow): Change[] {
  if ((row.type !== "adjust" && row.type !== "model_edit") || !row.old_values || !row.new_values) return [];
  const before = row.old_values;
  const after = row.new_values;
  const changes: Change[] = [];
  for (const key of Object.keys(after)) {
    if (key === "pin_min" || key === "pin_max") continue;
    const field = FIELDS[key];
    if (field && !same(before[key], after[key])) changes.push({ field: field.label, before: field.show(before[key]), after: field.show(after[key]) });
  }
  if ("pin_min" in after || "pin_max" in after) {
    const pins = (v: Record<string, unknown>) => ({ pin_min: num(v.pin_min), pin_max: num(v.pin_max) });
    const [b, a] = [pins(before), pins(after)];
    if (b.pin_min !== a.pin_min || b.pin_max !== a.pin_max) changes.push({ field: "Pin distance", before: pinDistance(b), after: pinDistance(a) });
  }
  return changes;
}

const SHOP_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" });
const HEADING = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" });

/** "Today", "Yesterday", or the date, by the calendar day at the shop. */
export function dayHeading(iso: string, now = new Date()): string {
  const key = (d: Date) => SHOP_DAY.format(d);
  const date = new Date(iso);
  if (key(date) === key(now)) return "Today";
  if (key(date) === key(new Date(now.getTime() - 86_400_000))) return "Yesterday";
  return HEADING.format(date);
}

/** The calendar day at the shop, as YYYY-MM-DD. Rows with the same key share a heading. */
export const shopDay = (iso: string) => SHOP_DAY.format(new Date(iso));
