import { describe, expect, it } from "vitest";
import { applyFilters, brandCounts, filterGroups, groupStock, lowCount, parseFilters, stockTotal, weightCounts, type StockModel } from "./group";

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
    expect(groups[0].weights).toEqual([{ modelId: "b15", weight: 15, count: 5, status: "ok", minimum: null, lowAt: [] }]);
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

  it("forgives punctuation and look-alike letters", () => {
    const loose = groupStock([model("q", "!Q Tour 78/U", 14), model("h", "Hy-Road", 15)], [
      { model_id: "q", in_stock: 1 },
      { model_id: "h", in_stock: 1 },
    ]);
    expect(filterGroups(loose, "iq").map((g) => g.name)).toEqual(["!Q Tour 78/U"]);
    expect(filterGroups(loose, "hyroad").map((g) => g.name)).toEqual(["Hy-Road"]);
  });

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

describe("filters by weight and brand", () => {
  const groups = groupStock(
    [...models, model("d15", "Black Widow 3.0", 15, "Hammer"), model("e12", "Mystery", 12, null)],
    [
      { model_id: "a14", in_stock: 1 },
      { model_id: "a15", in_stock: 4 },
      { model_id: "a16", in_stock: 2 },
      { model_id: "b15", in_stock: 3 },
      { model_id: "c12", in_stock: 5 },
      { model_id: "d15", in_stock: 1 },
      { model_id: "e12", in_stock: 2 },
    ],
  );

  it("keeps only the chosen weight in each group, with its count as the total", () => {
    const list = applyFilters(groups, { weight: 15, brand: null });
    expect(list.map((g) => [g.name, g.total, g.weights.map((w) => w.weight)])).toEqual([
      ["Black Widow 3.0", 1, [15]],
      ["Hy-Road", 3, [15]],
      ["Phaze II", 4, [15]],
    ]);
  });

  it("keeps only the chosen brand, in any letter case", () => {
    expect(applyFilters(groups, { weight: null, brand: "storm" }).map((g) => g.name)).toEqual(["Hy-Road", "Phaze II"]);
  });

  it("combines weight, brand, and a text search", () => {
    const list = filterGroups(applyFilters(groups, { weight: 15, brand: "Storm" }), "phaze");
    expect(list.map((g) => [g.name, g.total])).toEqual([["Phaze II", 4]]);
  });

  it("returns the groups unchanged with no filter", () => {
    expect(applyFilters(groups, { weight: null, brand: null })).toBe(groups);
  });

  it("counts the balls of each weight, from heavy to light", () => {
    expect(weightCounts(groups)).toEqual([
      { weight: 16, count: 2 },
      { weight: 15, count: 8 },
      { weight: 14, count: 1 },
      { weight: 12, count: 7 },
    ]);
  });

  it("counts the balls of each brand by name, and skips a model with no brand", () => {
    expect(brandCounts(groups)).toEqual([
      { brand: "Brunswick", count: 5 },
      { brand: "Hammer", count: 1 },
      { brand: "Storm", count: 10 },
    ]);
  });

  it("reads the filters from the address and ignores values that are not in stock", () => {
    expect(parseFilters({ w: "15", b: "storm" }, groups)).toEqual({ weight: 15, brand: "Storm", low: false });
    expect(parseFilters({ w: "13", b: "Nobody" }, groups)).toEqual({ weight: null, brand: null, low: false });
    expect(parseFilters({ w: "15abc", b: "" }, groups)).toEqual({ weight: null, brand: null, low: false });
    expect(parseFilters({ w: null, b: null }, groups)).toEqual({ weight: null, brand: null, low: false });
  });
});

describe("low stock in the stock list", () => {
  const counts = [
    { model_id: "a15", in_stock: 1 },
    { model_id: "a16", in_stock: 4 },
    { model_id: "b15", in_stock: 3 },
  ];
  const low = [
    { model_id: "a15", location_id: "mall", min_in_stock: 2 },
    { model_id: "a14", location_id: "mall", min_in_stock: 1 },
    { model_id: "c12", location_id: "mall", min_in_stock: 2 },
  ];
  const groups = groupStock(models, counts, low);
  const phaze = groups.find((g) => g.name === "Phaze II")!;

  it("marks a weight below its minimum as low, and a weight at 0 as out", () => {
    expect(phaze.weights).toEqual([
      { modelId: "a16", weight: 16, count: 4, status: "ok", minimum: null, lowAt: [] },
      { modelId: "a15", weight: 15, count: 1, status: "low", minimum: 2, lowAt: ["mall"] },
      { modelId: "a14", weight: 14, count: 0, status: "out", minimum: 1, lowAt: ["mall"] },
    ]);
    expect(phaze.total).toBe(5);
  });

  it("shows a model that is out of stock in every weight, with a total of 0", () => {
    expect(groups.find((g) => g.name === "Rhino")).toMatchObject({ total: 0, weights: [{ modelId: "c12", count: 0, status: "out" }] });
  });

  it("joins the rows of several locations into one weight: low when any location is low, with the low locations", () => {
    const all = groupStock(models, [{ model_id: "a15", in_stock: 1 }, { model_id: "a15", in_stock: 5 }], [
      { model_id: "a15", location_id: "mall", min_in_stock: 2 },
      { model_id: "a15", location_id: "room", min_in_stock: 2 },
    ]);
    expect(all[0].weights).toEqual([{ modelId: "a15", weight: 15, count: 6, status: "low", minimum: 2, lowAt: ["mall", "room"] }]);
  });

  it("counts the low and out weights, and keeps only them with the low filter", () => {
    expect(lowCount(groups)).toBe(3);
    const filtered = applyFilters(groups, { weight: null, brand: null, low: true });
    expect(filtered.map((g) => [g.name, g.weights.map((w) => w.modelId), g.total])).toEqual([
      ["Phaze II", ["a15", "a14"], 1],
      ["Rhino", ["c12"], 0],
    ]);
  });

  it("leaves out-of-stock weights out of the weight and brand pills, and out of the total", () => {
    expect(weightCounts(groups).find((w) => w.weight === 14)).toBeUndefined();
    expect(weightCounts(groups).find((w) => w.weight === 12)).toBeUndefined();
    expect(stockTotal(groups)).toBe(8);
    expect(brandCounts(groups).find((b) => b.brand === "Brunswick")).toBeUndefined();
  });

  it("reads the low filter from the address only when a weight is low", () => {
    expect(parseFilters({ w: null, b: null, l: "1" }, groups).low).toBe(true);
    expect(parseFilters({ w: null, b: null, l: "1" }, groupStock(models, counts)).low).toBe(false);
  });
});
