import { shopDay } from "./activity";
import type { Location } from "./types";

export type SalesReportParams = Record<string, string | string[] | undefined>;
export type SalesReportFilters = { period: "day" | "week" | "month"; date: string; location: string | null };

type SalesTotals = { units: number; value: `${number}` | null; unpriced: number };
type SalesModel = SalesTotals & { model_id: string; model_name: string; brand: string | null; weight_lb: number };

export type SalesReport = {
  start: string;
  end: string;
  totals: SalesTotals;
  rows: SalesModel[];
  locations: Location[];
};

const ISO_DATE = /^(?!0000)\d{4}-\d{2}-\d{2}$/;
const LOCATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const periodDate = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "UTC" });

export function salesReportFilters(params: SalesReportParams, now = new Date()): SalesReportFilters {
  const { period, date, location } = params;
  const parsed = typeof date === "string" && ISO_DATE.test(date) ? new Date(`${date}T00:00:00.000Z`) : null;
  const validDate = parsed && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
  return {
    period: period === "day" || period === "week" ? period : "month",
    date: validDate ? parsed.toISOString().slice(0, 10) : shopDay(now.toISOString()),
    location: typeof location === "string" && LOCATION_ID.test(location) ? location.toLowerCase() : null,
  };
}

// The last week of a four-digit year can end in a five-digit year.
function utcReportDate(date: string): Date {
  const [year, month, day] = date.split("-");
  const isoYear = year.length > 4 ? `+${year.padStart(6, "0")}` : year;
  return new Date(`${isoYear}-${month}-${day}T00:00:00Z`);
}

export function salesReportPeriodLabel(start: string, end: string): string {
  const firstDay = utcReportDate(start);
  return start === end ? periodDate.format(firstDay) : periodDate.formatRange(firstDay, utcReportDate(end));
}
