// Fixture data for the preview route. These models, serial numbers, and counts are examples.
// They are not shop data.
import type { SerialMatch } from "@/app/actions";
import { groupStock } from "@/lib/stock/group";
import type { Ball, BallModel, Location, Movement, Profile } from "@/lib/types";

export const locations: Location[] = [
  { id: "loc-main", name: "Sta. Lucia East", active: true },
  { id: "loc-room", name: "Stock room", active: true },
];
export const closedLocation: Location = { id: "loc-old", name: "Old kiosk", active: false };
export const locationNames = Object.fromEntries(locations.map((l) => [l.id, l.name]));

export const staff: Profile[] = [
  { id: "p-owner", full_name: "Shmuel Ng", role: "owner", active: true },
  { id: "p-carlo", full_name: "Carlo Reyes", role: "staff", active: true },
  { id: "p-mia", full_name: "Maria Concepcion dela Cruz-Villanueva", role: "staff", active: true },
  { id: "p-ben", full_name: "Ben", role: "staff", active: false },
];

function model(id: string, brand: string | null, name: string, weight: number, color: string | null, price: number | null = 12500): BallModel {
  return {
    id,
    upc: "836185012345",
    brand,
    name,
    nominal_weight_lb: weight,
    color,
    fragrance: "Cinnamon",
    coverstock: "TX-16 Solid Reactive",
    weight_block: "Velocity Core",
    finish: "3000 Abralon",
    rg: 2.48,
    diff: 0.051,
    mass_bias: null,
    product_code: "BBMTLZ15",
    selling_price: price,
    min_in_stock: null,
  };
}

const spec: [string | null, string, string | null, [number, number][]][] = [
  ["Storm", "Phaze II", "Red / Blue / Purple", [[16, 2], [15, 4], [14, 1]]],
  ["Storm", "Phaze AI", "Navy / Plum", [[16, 1], [15, 3]]],
  ["Storm", "Hy-Road", "Black / Ultramarine", [[16, 3], [15, 5], [14, 4], [13, 2], [12, 1]]],
  ["Storm", "Ion Pro", "Lapis / Teal", [[15, 2], [14, 2]]],
  ["Motiv", "Jackal Ghost", "Solid Black", [[16, 2], [15, 3], [14, 1]]],
  ["Motiv", "Venom Shock", "Blue / Lime", [[15, 4], [14, 3], [13, 2], [12, 2]]],
  ["Brunswick", "Rhino", "Carbon / Lime", [[15, 2], [14, 3], [13, 3], [12, 4], [11, 2], [10, 2]]],
  ["Brunswick", "Twist", "Sky Blue / Pink", [[14, 2], [13, 2], [12, 3], [11, 3], [10, 1]]],
  ["Hammer", "Black Widow 3.0", "Black / Red", [[16, 1], [15, 2]]],
];

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
export const models: BallModel[] = spec.flatMap(([brand, name, color, weights]) => weights.map(([weight]) => model(`${slug(name)}-${weight}`, brand, name, weight, color)));
export const counts = spec.flatMap(([, name, , weights]) => weights.map(([weight, count]) => ({ model_id: `${slug(name)}-${weight}`, in_stock: count })));
// Low stock: Twist 10 lb is below its minimum of 2, and Phaze II 13 lb is out (doc/adr/0004-low-stock-minimum.md).
const outModel = model("phaze-ii-13", "Storm", "Phaze II", 13, "Red / Blue / Purple");
models.push({ ...outModel, min_in_stock: 1 });
for (const m of models) if (m.id === "twist-10") m.min_in_stock = 2;
export const low = [
  { model_id: "twist-10", in_stock: 1, min_in_stock: 2 },
  { model_id: "phaze-ii-13", in_stock: 0, min_in_stock: 1 },
];
export const groups = groupStock(models, counts, low);

// Worst-case data: long names, no brand, non-Latin text, large counts.
const worstModels: BallModel[] = [
  model("w1", "Storm Bowling Products International", "Phaze II Pearl Limited Edition Tournament Anniversary Overseas Release", 15, "Red / Blue / Purple / Gold / Silver / Pearl White"),
  model("w2", "Storm Bowling Products International", "Phaze II Pearl Limited Edition Tournament Anniversary Overseas Release", 16, null),
  model("w3", null, "X", 6, null, null),
  model("w4", "ストーム", "フェイズ・ツー 保齡球 🎳", 14, "빨강 / 파랑"),
  model("w5", "Brunswick", "Supercalifragilisticexpialidocious-Unbreakable-Model-Name", 12, "Black"),
  ...[16, 15, 14, 13, 12, 11, 10, 9, 8].map((w) => model(`w6-${w}`, "Brunswick", "Rhino", w, "Carbon / Lime")),
];
export const worstGroups = groupStock(worstModels, [
  { model_id: "w1", in_stock: 128 },
  { model_id: "w2", in_stock: 1 },
  { model_id: "w3", in_stock: 1 },
  { model_id: "w4", in_stock: 2 },
  { model_id: "w5", in_stock: 1 },
  ...[16, 15, 14, 13, 12, 11, 10, 9, 8].map((w, i) => ({ model_id: `w6-${w}`, in_stock: (i + 1) * 37 })),
]);

function ball(id: string, serial: string, modelId: string, values: Partial<Ball> = {}): Ball {
  return {
    id,
    serial,
    model_id: modelId,
    location_id: "loc-main",
    status: "in_stock",
    gross_weight_oz: 242,
    top_weight: 2.75,
    pin_min: 2,
    pin_max: 3,
    boxed_on: "2026-08-14",
    label_photo_path: null,
    received_at: "2026-11-10T02:05:00Z",
    received_by: "p-carlo",
    ...values,
  };
}

/** Four sample balls for a model. The low-stock samples get their own count, so the model page shows the mark. */
export const ballsOf = (modelId: string): Ball[] => sampleBalls(modelId).slice(0, low.find((row) => row.model_id === modelId)?.in_stock ?? 4);
const sampleBalls = (modelId: string): Ball[] => [
  ball("b1", "PHZ244107731", modelId),
  ball("b2", "PHZ244107745", modelId, { gross_weight_oz: 241, top_weight: 3.1, pin_min: 3, pin_max: 4 }),
  ball("b3", "PHZ244110092", modelId, { gross_weight_oz: 240, top_weight: 2.4, location_id: "loc-room" }),
  ball("b4", "PHZ244110118", modelId, { gross_weight_oz: null, top_weight: null, pin_min: null, pin_max: null, boxed_on: null }),
];

export const serialMatches: SerialMatch[] = [
  { id: "b1", serial: "PHZ244107731", status: "in_stock", location_id: "loc-main", model_name: "Phaze II", weight: 15 },
  { id: "b9", serial: "PHZ243900412", status: "sold", location_id: "loc-main", model_name: "Phaze II", weight: 15 },
  { id: "b8", serial: "PHZ243900007", status: "removed", location_id: "loc-old", model_name: "Phaze II", weight: 16 },
];

export const movements: Movement[] = [
  { id: 4, ball_id: "b1", type: "adjust", from_location_id: null, to_location_id: null, actor: "p-owner", at: "2026-11-15T08:40:00Z", reason: "The top weight on the label was misread", reference: null },
  { id: 3, ball_id: "b1", type: "transfer", from_location_id: "loc-room", to_location_id: "loc-main", actor: "p-mia", at: "2026-11-12T05:40:00Z", reason: null, reference: null },
  { id: 2, ball_id: "b1", type: "receive", from_location_id: null, to_location_id: "loc-room", actor: "p-carlo", at: "2026-11-10T02:05:00Z", reason: null, reference: null },
];

export const personName = (id: string) => staff.find((p) => p.id === id)?.full_name ?? "Staff";
export const locationName = (id: string | null) => [...locations, closedLocation].find((l) => l.id === id)?.name ?? "—";
export const modelOf = (id: string) => models.find((m) => m.id === id) ?? models[1];

/** Store activity for the preview: each type, a long name, and rows on three days. */
export function activityRows(now = new Date()): import("@/lib/activity").ActivityRow[] {
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
  const base = { ball_id: "b1", serial: "24A1234", model_id: "m-phaze", model_name: "Phaze II", brand: "Storm", weight_lb: 15, from_location: null, to_location: null, reason: null, reference: null, old_values: null, new_values: null };
  return [
    { ...base, src: 0, id: 9, at: ago(4), type: "sell", actor_name: "Carlo Reyes", from_location: "Sta. Lucia East", reference: "OR-1102" },
    { ...base, src: 1, id: 2, at: ago(20), type: "model_edit", actor_name: "Shmuel Ng", ball_id: null, serial: null, old_values: { selling_price: 9500, name: "Phaze 2" }, new_values: { selling_price: 9800, name: "Phaze II" } },
    { ...base, src: 0, id: 8, at: ago(55), type: "receive", actor_name: "Maria Concepcion dela Cruz-Villanueva", model_name: "Ultimate Hybrid Pearl Reactive Special Edition", serial: "23VSLE30B047", to_location: "Stock room" },
    { ...base, src: 0, id: 7, at: ago(60 * 26), type: "reverse_sale", actor_name: "Shmuel Ng", reason: "The customer chose a 14 lb ball" },
    { ...base, src: 0, id: 6, at: ago(60 * 27), type: "adjust", actor_name: "Shmuel Ng", reason: "The top weight on the label was misread", old_values: { serial: "24A1234", top_weight: 3.28, pin_min: 3, pin_max: 3.5 }, new_values: { serial: "24A1234", top_weight: 3, pin_min: 4, pin_max: 4 } },
    { ...base, src: 0, id: 5, at: ago(60 * 75), type: "transfer", actor_name: "Carlo Reyes", from_location: "Stock room", to_location: "Sta. Lucia East" },
    { ...base, src: 0, id: 4, at: ago(60 * 76), type: "remove", actor_name: null, reason: "Cracked in the box" },
  ];
}
