import { ArrowLeft } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { buttonClass, Field, inputClass } from "@/components/ui/field";
import { requireOwner } from "@/lib/auth";
import { price } from "@/lib/format";
import { salesReportFilters, salesReportPeriodLabel, type SalesReport, type SalesReportFilters, type SalesReportParams } from "@/lib/sales-report";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Sales report" };

const countFormat = new Intl.NumberFormat("en-PH");
const rowLayout = "grid grid-cols-2 gap-x-3 sm:grid-cols-[minmax(0,1.55fr)_minmax(0,0.55fr)_minmax(0,1fr)_minmax(0,0.7fr)]";

function ReportFilters({ filters, locations }: { filters: SalesReportFilters; locations: SalesReport["locations"] }) {
  const missingLocation = locations.some(({ id }) => id === filters.location) ? null : filters.location;

  return (
    <Form action="/activity/sales" className="mt-5 grid grid-cols-2 items-end gap-3 rounded-(--radius-card) border border-border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.6fr)_auto]">
      <Field label="Period" className="min-w-0 max-[359px]:col-span-2">
        <select name="period" className={inputClass} defaultValue={filters.period}>
          <option value="day">Day</option>
          <option value="week">Week</option>
          <option value="month">Month</option>
        </select>
      </Field>
      <Field label="Date" className="min-w-0 max-[359px]:col-span-2">
        <input
          type="date"
          name="date"
          required
          min="0001-01-01"
          max="9999-12-31"
          className={cn(inputClass, "min-w-0 appearance-none px-2 py-0 align-bottom sm:px-3.5 [&::-webkit-date-and-time-value]:text-start")}
          defaultValue={filters.date}
        />
      </Field>
      <Field label="Location" className="col-span-2 min-w-0 sm:col-span-1">
        <select name="location" className={inputClass} defaultValue={filters.location ?? ""}>
          <option value="">All locations</option>
          {missingLocation && <option value={missingLocation}>Unavailable location</option>}
          {locations.map(({ id, name, active }) => (
            <option key={id} value={id}>{active ? name : `${name} (inactive)`}</option>
          ))}
        </select>
      </Field>
      <button type="submit" className={cn(buttonClass.primary, "col-span-2 sm:col-span-1")}>Apply filters</button>
    </Form>
  );
}

function Metric({ label, children, compact = false, className }: {
  label: string;
  children: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className={cn("text-sm text-muted-foreground", compact && "text-xs sm:sr-only")}>{label}</dt>
      <dd className={cn("font-semibold tabular-nums [overflow-wrap:anywhere]", compact ? "mt-0.5" : "mt-1 text-xl")}>
        {children}
      </dd>
    </div>
  );
}

function ReportResults({ report }: { report: SalesReport }) {
  const { start, end, totals, rows } = report;
  const period = salesReportPeriodLabel(start, end);

  return (
    <section aria-labelledby="report-period" className="mt-6">
      <h2 id="report-period" className="font-heading text-lg font-semibold">{period}</h2>
      <p className="mt-1 text-sm text-muted-foreground">Manila time</p>
      <dl className="mt-3 grid grid-cols-2 gap-4 rounded-(--radius-card) bg-card p-4 shadow-(--shadow-card) sm:grid-cols-3">
        <Metric label="Balls sold">{countFormat.format(totals.units)}</Metric>
        <Metric label="Sales value at catalog prices" className="max-sm:order-first max-sm:col-span-2">
          {totals.value === null ? "Unavailable" : price(totals.value)}
        </Metric>
        <Metric label="Sales without a saved price">{countFormat.format(totals.unpriced)}</Metric>
      </dl>
      {rows.length === 0 ? (
        <p className="mt-5 rounded-(--radius-card) border border-border px-4 py-6 text-center text-muted-foreground">
          No sales for this period and location.
        </p>
      ) : (
        <div className="mt-6">
          <h3 id="sales-models" className="mb-2 font-heading text-lg font-semibold">Sales by model and weight</h3>
          <div className={`${rowLayout} hidden px-4 pb-2 text-sm font-medium text-muted-foreground sm:grid`} aria-hidden="true">
            <div>Model and weight</div><div>Balls sold</div><div>Sales value</div><div>No saved price</div>
          </div>
          <ul aria-labelledby="sales-models" className="divide-y divide-border rounded-(--radius-card) bg-card shadow-(--shadow-card)">
            {rows.map((row) => (
              <li key={row.model_id}>
                <dl className={`${rowLayout} gap-y-2 px-4 py-3`}>
                  <div className="col-span-2 min-w-0 sm:col-span-1">
                    <dt className="sr-only">Model and weight</dt>
                    <dd className="font-semibold [overflow-wrap:anywhere]">{row.model_name}</dd>
                    <dd className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{row.brand ? `${row.brand} · ` : ""}{row.weight_lb} lb</dd>
                  </div>
                  <Metric compact label="Balls sold">{countFormat.format(row.units)}</Metric>
                  <Metric compact label="Sales value" className="max-sm:order-last max-sm:col-span-2">
                    {row.value === null ? "Unavailable" : price(row.value)}
                  </Metric>
                  <Metric compact label="No saved price">{countFormat.format(row.unpriced)}</Metric>
                </dl>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

async function Report({ searchParams }: { searchParams: Promise<SalesReportParams> }) {
  await requireOwner();
  const filters = salesReportFilters(await searchParams);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sales_report", {
    p_period: filters.period,
    p_date: filters.date,
    p_location_id: filters.location,
  });
  if (error || !data) throw new Error("The sales report could not be loaded. Try again.");
  const report = data as SalesReport;

  return (
    <div className="mx-auto max-w-4xl lg:mx-0">
      <Link href="/activity" className={cn(buttonClass.link, "gap-1.5")}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        Activity
      </Link>
      <h1 className="mt-2 font-heading text-2xl font-bold">Sales report</h1>
      <ReportFilters key={`${filters.period}:${filters.date}:${filters.location}`} filters={filters} locations={report.locations} />
      <ReportResults report={report} />
    </div>
  );
}

export default function SalesReportPage({ searchParams }: { searchParams: Promise<SalesReportParams> }) {
  return (
    <Suspense fallback={<p role="status" className="text-muted-foreground">Loading sales report…</p>}>
      <Report searchParams={searchParams} />
    </Suspense>
  );
}
