import { describe, expect, it } from "vitest";
import { activityChanges, activityDetail, type ActivityRow, dayHeading, filterTypes } from "./activity";

const row = (overrides: Partial<ActivityRow>): ActivityRow => ({
  src: 0,
  id: 1,
  at: "2026-11-17T06:00:00.123456+00:00",
  type: "receive",
  actor_name: "Ana",
  ball_id: "b1",
  serial: "24A1234",
  model_id: "m1",
  model_name: "Phaze II",
  brand: "Storm",
  weight_lb: 15,
  from_location: null,
  to_location: null,
  reason: null,
  reference: null,
  old_values: null,
  new_values: null,
  ...overrides,
});

describe("activityDetail", () => {
  it("names the location of an added ball", () => {
    expect(activityDetail(row({ type: "receive", to_location: "Front shelf" }))).toBe("Into Front shelf");
  });

  it("names the location and the reference of a sale", () => {
    expect(activityDetail(row({ type: "sell", from_location: "Front shelf", reference: "OR-1102" }))).toBe(
      "From Front shelf · Ref. OR-1102",
    );
    expect(activityDetail(row({ type: "sell", from_location: "Front shelf" }))).toBe("From Front shelf");
  });

  it("names both locations of a move", () => {
    expect(activityDetail(row({ type: "transfer", from_location: "Mall", to_location: "Warehouse" }))).toBe("Mall → Warehouse");
  });

  it("gives the reason of a cancelled sale, a removal, and an edit", () => {
    expect(activityDetail(row({ type: "reverse_sale", reason: "Wrong ball" }))).toBe("Wrong ball");
    expect(activityDetail(row({ type: "remove", reason: "Damaged" }))).toBe("Damaged");
    expect(activityDetail(row({ type: "adjust", reason: "Misread label" }))).toBe("Misread label");
    expect(activityDetail(row({ type: "model_edit" }))).toBe("");
  });
});

describe("activityChanges", () => {
  it("names only the ball values that changed", () => {
    const changes = activityChanges(
      row({
        type: "adjust",
        old_values: { serial: "24A1234", gross_weight_oz: 244, top_weight: 3.28, pin_min: 3, pin_max: 3.5, boxed_on: "2023-05-30" },
        new_values: { serial: "24A1243", gross_weight_oz: 244, top_weight: 3, pin_min: 3, pin_max: 3.5, boxed_on: "2023-05-30" },
      }),
    );
    expect(changes).toEqual([
      { field: "Serial", before: "24A1234", after: "24A1243" },
      { field: "Top weight", before: "3.28 oz", after: "3 oz" },
    ]);
  });

  it("joins the two pin values into one pin distance", () => {
    const changes = activityChanges(
      row({ type: "adjust", old_values: { pin_min: 3, pin_max: 3.5 }, new_values: { pin_min: 4, pin_max: 4 } }),
    );
    expect(changes).toEqual([{ field: "Pin distance", before: '3–3.5"', after: '4"' }]);
  });

  it("formats catalog values and shows an empty value as a dash", () => {
    const changes = activityChanges(
      row({ type: "model_edit", old_values: { name: "Edit Me", selling_price: null }, new_values: { name: "Edited", selling_price: 9800 } }),
    );
    expect(changes).toEqual([
      { field: "Name", before: "Edit Me", after: "Edited" },
      { field: "Price", before: "—", after: "₱9,800.00" },
    ]);
  });

  it("gives no changes for a stock movement that is not an edit", () => {
    expect(activityChanges(row({ type: "sell" }))).toEqual([]);
  });
});

describe("filterTypes", () => {
  it("maps each filter to its types and gives all types for an unknown filter", () => {
    expect(filterTypes("edited")).toEqual(["adjust", "model_edit"]);
    expect(filterTypes("cancelled")).toEqual(["reverse_sale"]);
    expect(filterTypes(undefined)).toBeNull();
    expect(filterTypes("nonsense")).toBeNull();
  });
});

describe("dayHeading", () => {
  const now = new Date("2026-11-17T10:00:00+08:00");
  it("uses the shop's time zone", () => {
    expect(dayHeading("2026-11-16T17:00:00Z", now)).toBe("Today");
    expect(dayHeading("2026-11-16T15:00:00Z", now)).toBe("Yesterday");
    expect(dayHeading("2026-11-10T04:00:00Z", now)).toBe("Tue, Nov 10, 2026");
  });
});
