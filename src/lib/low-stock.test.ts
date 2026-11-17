import { describe, expect, it } from "vitest";
import { parseMinimum, stockStatus } from "./low-stock";

describe("parseMinimum", () => {
  it("reads a whole number from 0 to 99, and empty as no minimum", () => {
    expect(parseMinimum("")).toEqual({ ok: true, value: null });
    expect(parseMinimum("  ")).toEqual({ ok: true, value: null });
    expect(parseMinimum("0")).toEqual({ ok: true, value: 0 });
    expect(parseMinimum(" 3 ")).toEqual({ ok: true, value: 3 });
    expect(parseMinimum("99")).toEqual({ ok: true, value: 99 });
  });

  it("refuses a number above 99, a negative number, a decimal, and text", () => {
    for (const text of ["100", "-1", "1.5", "two", "3 balls"]) expect(parseMinimum(text).ok, text).toBe(false);
  });
});

describe("stockStatus", () => {
  it("is ok with no minimum or a minimum of 0, also at 0 in stock", () => {
    expect(stockStatus(0, null)).toBe("ok");
    expect(stockStatus(0, 0)).toBe("ok");
  });

  it("is low below the minimum, out at 0, and ok at or above the minimum", () => {
    expect(stockStatus(1, 2)).toBe("low");
    expect(stockStatus(0, 2)).toBe("out");
    expect(stockStatus(2, 2)).toBe("ok");
    expect(stockStatus(5, 2)).toBe("ok");
  });
});
