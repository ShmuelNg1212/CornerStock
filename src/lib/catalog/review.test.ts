import { describe, expect, it } from "vitest";
import { buildReview } from "./review";
import type { Ball, BallModel, Location } from "@/lib/types";

const location: Location = { id: "location-a", name: "Shop", active: true };
const model: BallModel = {
  id: "model-a", upc: "887970617601", name: "Summit", nominal_weight_lb: 15,
  brand: "Storm", color: "Blue", fragrance: null, coverstock: null,
  weight_block: null, finish: null, rg: null, diff: null, mass_bias: null,
  product_code: null, selling_price: 12500,
};
const ball: Ball = {
  id: "ball-a", serial: "ABC123", model_id: model.id, location_id: location.id,
  status: "in_stock", gross_weight_oz: 244, top_weight: 2.5, pin_min: 3,
  pin_max: 3.5, boxed_on: "2023-05-30", label_photo_path: null,
  received_at: "2026-11-17T00:00:00Z", received_by: "owner",
};
const options = { defaultLocationId: location.id, reason: "" };
const row = (values: Record<string, string | undefined>, line = 2) => ({ row: line, values });
const state = { models: [model], balls: [ball], locations: [location] };

describe("import review", () => {
  it("merges compatible model details across stock rows without duplicate model writes", () => {
    const result = buildReview("stock", [
      row({ upc: model.upc, serial: "NEW123", color: "Green" }),
      row({ upc: model.upc, serial: "NEW456", selling_price: "13000" }, 3),
    ], state, options);
    expect(result.errors).toEqual([]);
    expect(result.payload.models).toHaveLength(1);
    expect(result.payload.models[0].after).toMatchObject({ color: "Green", selling_price: 13000 });
    expect(result.summary).toMatchObject({ models_updated: 1, balls_added: 2 });
  });
  it("reports conflicting model cells and duplicate normalized serials by source row", () => {
    const result = buildReview("stock", [
      row({ upc: model.upc, serial: "new123", color: "Green" }),
      row({ upc: model.upc, serial: "NEW 123", color: "Red" }, 8),
    ], state, options);
    expect(result.errors).toContainEqual(expect.objectContaining({ row: 8, field: "color" }));
    expect(result.errors).toContainEqual(expect.objectContaining({ row: 8, field: "serial" }));
  });
  it.each([
    { nominal_weight_lb: "14" }, { model_name: "__CLEAR__" },
    { selling_price: "NaN" }, { selling_price: "10000000" },
    { selling_price: "12.345" }, { status: "sold" },
  ])("rejects invalid or immutable catalog values: %j", (values) => {
    const result = buildReview("catalog", [row({ upc: model.upc, ...values })], state, options);
    expect(result.errors.length).toBeGreaterThan(0);
  });
  it("rejects an empty or oversized batch", () => {
    expect(buildReview("catalog", [], state, options).errors.length).toBeGreaterThan(0);
    expect(buildReview("catalog", Array.from({ length: 1001 }, (_, i) => row({ upc: model.upc }, i + 2)), state, options).errors.length).toBeGreaterThan(0);
  });
  it("rejects numeric precision that the database would round", () => {
    const result = buildReview("stock", [row({ upc: model.upc, serial: "NEW123", rg: "2.5432", top_weight: "2.345", pin_distance: "3.125-3.5" })], state, options);
    expect(result.errors.map(e => e.field)).toEqual(expect.arrayContaining(["rg", "top_weight", "pin_distance"]));
  });
  it("can get new model details from a later row for the same UPC", () => {
    const result = buildReview("stock", [row({ upc: model.upc, serial: "NEW123" }), row({ upc: model.upc, serial: "NEW456", model_name: "Summit", nominal_weight_lb: "15" }, 3)], { ...state, models: [] }, options);
    expect(result.errors).toEqual([]);
    expect(result.summary).toMatchObject({ models_added: 1, balls_added: 2 });
  });
  it("keeps the model identity of an existing ball fixed", () => {
    const otherModel = { ...model, id: "other-model", upc: "012345678905" };
    const result = buildReview("stock", [row({ upc: otherModel.upc, serial: ball.serial })], { ...state, models: [model, otherModel] }, options);
    expect(result.errors).toContainEqual(expect.objectContaining({ field: "upc" }));
  });
  it("preserves an existing ball when cells are blank", () => {
    const result = buildReview("stock", [row({ upc: model.upc, serial: ball.serial, gross_weight: "", location: "" })], state, options);
    expect(result.errors).toEqual([]);
    expect(result.payload.balls[0]).toMatchObject({ before: ball, label: { gross_weight_oz: 244, top_weight: 2.5, pin_min: 3, pin_max: 3.5, boxed_on: "2023-05-30" } });
    expect(result.summary.balls_updated).toBe(0);
    expect(result.changes.find(c => c.entity === "ball")?.action).toBe("unchanged");
  });
  it("requires a reason for a stock correction and previews its old and new values", () => {
    const rows = [row({ upc: model.upc, serial: ball.serial, top_weight: "__CLEAR__" })];
    expect(buildReview("stock", rows, state, options).errors).toContainEqual(expect.objectContaining({ field: "reason" }));
    const result = buildReview("stock", rows, state, { ...options, reason: "Correct spreadsheet" });
    expect(result.errors).toEqual([]);
    expect(result.summary.balls_updated).toBe(1);
    expect(result.changes.find(c => c.entity === "ball")?.fields).toContainEqual({ field: "top_weight", before: "2.5", after: "" });
  });
  it("resolves exact active locations and prevents moving sold balls", () => {
    const next = { id: "location-b", name: "Warehouse", active: true };
    const result = buildReview("stock", [row({ upc: model.upc, serial: ball.serial, location: "Warehouse" })], { ...state, locations: [location, next] }, { ...options, reason: "Move to warehouse" });
    expect(result.errors).toEqual([]);
    expect(result.payload.balls[0].location_id).toBe(next.id);
    const sold = buildReview("stock", [row({ upc: model.upc, serial: ball.serial, location: next.id })], { ...state, balls: [{ ...ball, status: "sold" }], locations: [location, next] }, { ...options, reason: "Move" });
    expect(sold.errors).toContainEqual(expect.objectContaining({ field: "location" }));
  });
  it("receives a known UPC with no repeated model details", () => {
    const result = buildReview("stock", [row({ upc: model.upc, serial: "NEW123" })], state, options);
    expect(result.errors).toEqual([]);
    expect(result.payload.models[0]).toEqual({ upc: model.upc, before: model, after: expect.objectContaining({ color: "Blue", selling_price: 12500 }) });
    expect(result.summary).toMatchObject({ models_added: 0, models_updated: 0, balls_added: 1 });
  });
  it("keeps blank catalog cells and only clears an optional value explicitly", () => {
    const result = buildReview("catalog", [row({ upc: model.upc, color: "__CLEAR__", selling_price: "", brand: "" })], state, options);
    expect(result.errors).toEqual([]);
    expect(result.payload.models[0].after).toMatchObject({ brand: "Storm", color: null, selling_price: 12500 });
    expect(result.changes[0]).toMatchObject({ action: "update", fields: [{ field: "color", before: "Blue", after: "" }] });
  });
  it("adds a model and a physical ball together for a new UPC", () => {
    const result = buildReview("stock", [row({ upc: model.upc, serial: "NEW123", model_name: "Summit", nominal_weight_lb: "15", selling_price: "12500" })], { models: [], balls: [], locations: [location] }, options);
    expect(result.errors).toEqual([]);
    expect(result.summary).toMatchObject({ models_added: 1, balls_added: 1 });
    expect(result.payload.models[0].after).toMatchObject({ name: "Summit", selling_price: 12500 });
    expect(result.payload.balls[0]).toMatchObject({ serial: "NEW123", before: null, location_id: location.id });
  });
});
