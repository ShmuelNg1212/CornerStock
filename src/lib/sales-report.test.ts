import { describe, expect, it } from "vitest";
import { price } from "./format";
import { salesReportFilters, salesReportPeriodLabel } from "./sales-report";

describe("sales report filters", () => {
  const now = new Date("2024-02-29T16:00:00Z");

  it("defaults to the current Manila month and day", () => {
    expect(salesReportFilters({}, now)).toEqual({ period: "month", date: "2024-03-01", location: null });
  });

  it("keeps a valid date, period and location", () => {
    const location = "2fb2c084-4719-4f7f-bae5-a8a345347800";
    expect(salesReportFilters({ period: "week", date: "2024-02-29", location }, now))
      .toEqual({ period: "week", date: "2024-02-29", location });
  });

  it("falls back for invalid or repeated parameters", () => {
    expect(salesReportFilters({ period: ["day", "week"], date: "2023-02-29", location: "not-a-location" }, now))
      .toEqual({ period: "month", date: "2024-03-01", location: null });
  });
});

describe("sales report formatting", () => {
  it("keeps the end date when a week crosses into an expanded year", () => {
    expect(salesReportPeriodLabel("9999-12-27", "10000-01-02")).toMatch(/Jan 2, 10000/);
  });

  it("does not round a large recorded total through a floating point number", () => {
    expect(price("70368799999999.01")).toContain("70,368,799,999,999.01");
  });
});
