import { describe, expect, it } from "vitest";
import { manilaHour, startOfManilaDay, todayCounts, type TodayMovement } from "./today";

describe("manilaHour", () => {
  it("gives the hour in Manila", () => {
    expect(manilaHour(new Date("2026-11-15T23:30:00Z"))).toBe(7);
    expect(manilaHour(new Date("2026-11-16T16:00:00Z"))).toBe(0);
  });
});

describe("startOfManilaDay", () => {
  it("gives midnight in Manila (UTC+8) as a UTC time", () => {
    // 23:30 UTC on the 15th is 07:30 on the 16th in Manila.
    expect(startOfManilaDay(new Date("2026-11-15T23:30:00Z")).toISOString()).toBe("2026-11-15T16:00:00.000Z");
    // 15:59 UTC on the 16th is 23:59 on the 16th in Manila.
    expect(startOfManilaDay(new Date("2026-11-16T15:59:00Z")).toISOString()).toBe("2026-11-15T16:00:00.000Z");
    // 16:00 UTC on the 16th is midnight of the 17th in Manila.
    expect(startOfManilaDay(new Date("2026-11-16T16:00:00Z")).toISOString()).toBe("2026-11-16T16:00:00.000Z");
  });
});

const move = (type: TodayMovement["type"], from: string | null, to: string | null, ball = `x${Math.random()}`): TodayMovement => ({
  ball_id: ball,
  type,
  from_location_id: from,
  to_location_id: to,
});

describe("todayCounts", () => {
  const moves = [
    move("receive", null, "a"),
    move("receive", null, "a"),
    move("receive", null, "b"),
    move("sell", "a", null),
    move("sell", "b", null, "s1"),
    move("sell", "b", null),
    move("reverse_sale", null, "b", "s1"),
    move("transfer", "a", "b"),
    move("adjust", null, "a"),
  ];

  it("counts receives and net sales at one location", () => {
    expect(todayCounts(moves, "a")).toEqual({ received: 2, sold: 1 });
    expect(todayCounts(moves, "b")).toEqual({ received: 1, sold: 1 });
  });

  it("counts every location for all locations", () => {
    expect(todayCounts(moves, "all")).toEqual({ received: 3, sold: 2 });
  });

  it("does not give a negative sale count", () => {
    expect(todayCounts([move("reverse_sale", null, "a")], "a")).toEqual({ received: 0, sold: 0 });
  });

  it("does not remove a sale of today for the reversal of an earlier sale", () => {
    const list = [move("sell", "a", null, "p"), move("sell", "a", null, "q"), move("reverse_sale", null, "a", "old")];
    expect(todayCounts(list, "a")).toEqual({ received: 0, sold: 2 });
  });

  it("gives zero with no movements", () => {
    expect(todayCounts([], "a")).toEqual({ received: 0, sold: 0 });
  });
});
