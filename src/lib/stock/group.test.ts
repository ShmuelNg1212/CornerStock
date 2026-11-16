import { describe, expect, it } from "vitest";
import { filterGroups, groupStock, stockTotal, type StockModel } from "./group";

const model = (id: string, name: string, weight: number, brand: string | null = "Storm", color: string | null = null): StockModel => ({
  id,
  name,
  brand,
  color,
  nominal_weight_lb: weight,
});

const models = [
  model("a15", "Phaze II", 15, "Storm", "Red / Blue"),
  model("a16", "Phaze II", 16, "Storm", "Red / Blue"),
  model("a14", "Phaze II", 14, "Storm", "Red / Blue"),
  model("b15", "Hy-Road", 15),
  model("c12", "Rhino", 12, "Brunswick"),
];

describe("groupStock", () => {
  it("makes one group for each brand and name, with the weights from heavy to light", () => {
    const groups = groupStock(models, [
      { model_id: "a14", in_stock: 1 },
      { model_id: "a15", in_stock: 4 },
      { model_id: "a16", in_stock: 2 },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ name: "Phaze II", brand: "Storm", color: "Red / Blue", total: 7 });
    expect(groups[0].weights.map((w) => [w.weight, w.count, w.modelId])).toEqual([
      [16, 2, "a16"],
      [15, 4, "a15"],
      [14, 1, "a14"],
    ]);
  });

  it("adds the counts of one model in several locations", () => {
    const groups = groupStock(models, [
      { model_id: "b15", in_stock: 2 },
      { model_id: "b15", in_stock: 3 },
    ]);
    expect(groups[0].total).toBe(5);
    expect(groups[0].weights).toEqual([{ modelId: "b15", weight: 15, count: 5 }]);
  });

  it("sorts the groups by name", () => {
    const groups = groupStock(models, [
      { model_id: "c12", in_stock: 1 },
      { model_id: "a15", in_stock: 1 },
      { model_id: "b15", in_stock: 1 },
    ]);
    expect(groups.map((g) => g.name)).toEqual(["Hy-Road", "Phaze II", "Rhino"]);
  });

  it("does not show a model with no ball in stock", () => {
    const groups = groupStock(models, [
      { model_id: "a15", in_stock: 2 },
      { model_id: "b15", in_stock: 0 },
    ]);
    expect(groups.map((g) => g.name)).toEqual(["Phaze II"]);
  });

  it("ignores a count for a model that is not in the list", () => {
    expect(groupStock(models, [{ model_id: "gone", in_stock: 3 }])).toEqual([]);
  });

  it("keeps two brands with the same model name apart", () => {
    const groups = groupStock(
      [model("x", "Twist", 12, "Brunswick"), model("y", "Twist", 12, "Other")],
      [
        { model_id: "x", in_stock: 1 },
        { model_id: "y", in_stock: 1 },
      ],
    );
    expect(groups).toHaveLength(2);
  });
});

describe("filterGroups", () => {
  const groups = groupStock(models, [
    { model_id: "a15", in_stock: 4 },
    { model_id: "b15", in_stock: 2 },
    { model_id: "c12", in_stock: 1 },
  ]);

  it("returns all groups for an empty search", () => {
    expect(filterGroups(groups, "  ")).toHaveLength(3);
  });

  it("finds a part of the model name, in any letter case", () => {
    expect(filterGroups(groups, "pHAz").map((g) => g.name)).toEqual(["Phaze II"]);
  });

  it("finds the brand", () => {
    expect(filterGroups(groups, "brunswick").map((g) => g.name)).toEqual(["Rhino"]);
  });

  it("finds brand and name together", () => {
    expect(filterGroups(groups, "storm hy").map((g) => g.name)).toEqual(["Hy-Road"]);
  });

  it("returns no group when nothing matches", () => {
    expect(filterGroups(groups, "zzz")).toEqual([]);
  });
});

describe("stockTotal", () => {
  it("adds the totals of the groups", () => {
    const groups = groupStock(models, [
      { model_id: "a15", in_stock: 4 },
      { model_id: "c12", in_stock: 1 },
    ]);
    expect(stockTotal(groups)).toBe(5);
    expect(stockTotal([])).toBe(0);
  });
});
