import { describe, expect, it } from "vitest";
import { changedModels, snapshot } from "./changes";
import { groupStock } from "./group";

const models = [
  { id: "a15", name: "Phaze II", brand: "Storm", color: null, nominal_weight_lb: 15 },
  { id: "b15", name: "Hy-Road", brand: "Storm", color: null, nominal_weight_lb: 15 },
];
const snap = (counts: [string, number][]) => snapshot(groupStock(models, counts.map(([model_id, in_stock]) => ({ model_id, in_stock }))));

describe("changedModels", () => {
  it("marks nothing on the first load", () => {
    expect(changedModels(null, snap([["a15", 4]]))).toEqual({});
  });

  it("marks nothing when the counts are the same", () => {
    expect(changedModels(snap([["a15", 4]]), snap([["a15", 4]]))).toEqual({});
  });

  it("marks a count that went up", () => {
    expect(changedModels(snap([["a15", 4]]), snap([["a15", 5]]))).toEqual({ a15: 1 });
  });

  it("marks a count that went down", () => {
    expect(changedModels(snap([["a15", 4]]), snap([["a15", 2]]))).toEqual({ a15: -2 });
  });

  it("marks a model that is new in the list", () => {
    expect(changedModels(snap([["a15", 4]]), snap([["a15", 4], ["b15", 1]]))).toEqual({ b15: 1 });
  });

  it("does not mark a model that left the list, because it has no row", () => {
    expect(changedModels(snap([["a15", 4], ["b15", 1]]), snap([["a15", 4]]))).toEqual({});
  });
});
