// An in-memory stock count for the preview route. It follows the rules of the database
// functions (supabase/migrations/20261117200000_stock_count.sql), on fixture balls.
// The serials 26GRNE12A043 and 26GRNE08B001 are on the label fixtures, so a fake camera can scan them.
import type { CountApi, CountLine, CountOpen, CountRecord, CountResult, ScanResult, ScanStatus } from "@/lib/count/session";

type FakeBall = { id: string; serial: string; model: string; weight: number; location: string; status: "in_stock" | "sold" | "removed" };
const NAMES: Record<string, string> = { "loc-main": "Sta. Lucia East", "loc-room": "Stock room" };

const balls: FakeBall[] = [
  { id: "c1", serial: "26GRNE12A043", model: "Phaze II", weight: 14, location: "loc-main", status: "in_stock" },
  { id: "c2", serial: "26GRNE08B001", model: "Phaze II", weight: 13, location: "loc-main", status: "in_stock" },
  { id: "c3", serial: "PHZ244107731", model: "Phaze II", weight: 15, location: "loc-main", status: "in_stock" },
  { id: "c4", serial: "23VSLE30B047", model: "Solid Lock", weight: 15, location: "loc-room", status: "in_stock" },
  { id: "c5", serial: "PHZ243900412", model: "Phaze II", weight: 15, location: "loc-main", status: "sold" },
  { id: "c6", serial: "PHZ243900007", model: "Phaze II", weight: 16, location: "loc-room", status: "removed" },
];

type FakeCount = { open: CountOpen; scans: Set<string>; result: CountResult | null; lines: Omit<CountLine, "corrected" | "action">[] };
const counts = new Map<string, FakeCount>();
let nextId = 0;
const used = new Set<string>();

const inStockHere = (location: string) => balls.filter((b) => b.location === location && b.status === "in_stock");
const ok = <T,>(value: T) => ({ ok: true as const, value });
const fail = (error: string) => ({ ok: false as const, error });

function resultOf(count: FakeCount): CountResult {
  const here = count.open.location_id;
  const lines: CountLine[] = count.lines.map((line) => {
    const ball = balls.find((b) => b.serial === line.serial);
    const isHere = Boolean(ball && ball.status === "in_stock" && ball.location === here);
    const action =
      line.outcome === "missing" && isHere
        ? "remove"
        : line.outcome === "unexpected" && !ball
          ? "add"
          : line.outcome === "unexpected" && ball?.status === "in_stock" && !isHere
            ? "move"
            : line.outcome === "unexpected" && ball?.status === "sold"
              ? "put_back"
              : null;
    return { ...line, corrected: line.outcome === "missing" ? !isHere : line.outcome === "unexpected" ? isHere : false, action };
  });
  return { ...count.result!, lines };
}

export const fakeCountApi: CountApi = {
  async start(locationId) {
    const open = [...counts.values()].find((c) => c.open.location_id === locationId && !c.result);
    if (open) return ok({ ...open.open, scanned: open.scans.size, expected: inStockHere(locationId).length });
    const id = `00000000-0000-4000-8000-${String(++nextId).padStart(12, "0")}`;
    const count: FakeCount = {
      open: { id, location_id: locationId, location: NAMES[locationId] ?? "Location", started_at: new Date().toISOString(), scanned: 0, expected: inStockHere(locationId).length },
      scans: new Set(),
      result: null,
      lines: [],
    };
    counts.set(id, count);
    return ok(count.open);
  },

  async scan(countId, serial) {
    const count = counts.get(countId);
    if (!count || count.result) return fail("This count is already finished or cancelled.");
    await new Promise((resolve) => setTimeout(resolve, 250));
    const duplicate = count.scans.has(serial);
    count.scans.add(serial);
    const ball = balls.find((b) => b.serial === serial);
    const status: ScanStatus = !ball ? "not_recorded" : ball.status === "in_stock" ? (ball.location === count.open.location_id ? "found" : "other_location") : ball.status;
    const reply: ScanResult = {
      serial,
      status,
      duplicate,
      ball_id: ball?.id ?? null,
      model_name: ball?.model ?? null,
      brand: ball ? "Storm" : null,
      weight_lb: ball?.weight ?? null,
      location: status === "other_location" ? NAMES[ball!.location] : null,
      scanned: count.scans.size,
      expected: inStockHere(count.open.location_id).length,
    };
    return ok(reply);
  },

  async finish(countId) {
    const count = counts.get(countId);
    if (!count || count.result) return fail("This count is already finished or cancelled.");
    const here = count.open.location_id;
    const base = { brand: "Storm" as string | null, other_location: null as string | null, kind: null as CountLine["kind"] };
    count.lines = [
      ...inStockHere(here).map((b) => ({ ...base, serial: b.serial, ball_id: b.id, model_name: b.model, weight_lb: b.weight, outcome: count.scans.has(b.serial) ? ("found" as const) : ("missing" as const) })),
      ...[...count.scans]
        .filter((s) => !inStockHere(here).some((b) => b.serial === s))
        .map((s) => {
          const b = balls.find((x) => x.serial === s);
          const kind: CountLine["kind"] = !b ? "not_recorded" : b.status === "in_stock" ? "other_location" : b.status;
          return { ...base, serial: s, ball_id: b?.id ?? null, model_name: b?.model ?? null, weight_lb: b?.weight ?? null, outcome: "unexpected" as const, kind, other_location: kind === "other_location" ? NAMES[b!.location] : null };
        }),
    ];
    const total = (o: string) => count.lines.filter((l) => l.outcome === o).length;
    count.result = {
      ...count.open,
      status: "finished",
      finished_at: new Date().toISOString(),
      started_by: "Shmuel Ng",
      finished_by: "Shmuel Ng",
      found: total("found"),
      missing: total("missing"),
      unexpected: total("unexpected"),
      lines: [],
    };
    return ok(resultOf(count));
  },

  async cancel(countId) {
    counts.delete(countId);
    return ok(null);
  },

  async correct(countId, serial, requestId, reason) {
    const count = counts.get(countId);
    if (!count?.result) return fail("Finish the count first.");
    if (used.has(requestId)) return ok(resultOf(count));
    const line = resultOf(count).lines.find((l) => l.serial === serial);
    const ball = balls.find((b) => b.serial === serial);
    if (!line?.action || line.corrected || !ball) return fail("The stock changed a moment ago. Nothing is left to correct here.");
    if (line.action === "put_back" && !reason?.trim()) return fail("Write a reason.");
    if (line.action === "move") ball.location = count.open.location_id;
    if (line.action === "remove") ball.status = "removed";
    if (line.action === "put_back") ball.status = "in_stock";
    used.add(requestId);
    return ok(resultOf(count));
  },
};

/** A large result, for the design check: 200 balls with every kind of line. */
export function bigResult(): CountResult {
  const line = (i: number, change: Partial<CountLine>): CountLine => ({
    serial: `26PHZE${String(i).padStart(6, "0")}`,
    outcome: "found",
    kind: null,
    ball_id: `x${i}`,
    model_name: i % 7 === 0 ? "Ultimate Hybrid Pearl Reactive Special Edition" : "Phaze II",
    brand: "Storm",
    weight_lb: 12 + (i % 5),
    other_location: null,
    corrected: false,
    action: null,
    ...change,
  });
  const lines = [
    ...Array.from({ length: 6 }, (_, i) => line(i, { outcome: "missing", action: i < 4 ? "remove" : null, corrected: i >= 4 })),
    line(6, { outcome: "unexpected", kind: "other_location", other_location: "Stock room", action: "move" }),
    line(7, { outcome: "unexpected", kind: "sold", action: "put_back" }),
    line(8, { outcome: "unexpected", kind: "removed" }),
    line(9, { outcome: "unexpected", kind: "not_recorded", ball_id: null, model_name: null, weight_lb: null, action: "add" }),
    ...Array.from({ length: 190 }, (_, i) => line(10 + i, {})),
  ];
  return {
    id: "00000000-0000-4000-8000-000000000999",
    location_id: "loc-main",
    location: "Sta. Lucia East",
    status: "finished",
    started_at: new Date(Date.now() - 3_600_000).toISOString(),
    finished_at: new Date().toISOString(),
    started_by: "Carlo Reyes",
    finished_by: "Maria Concepcion dela Cruz-Villanueva",
    found: 190,
    missing: 6,
    unexpected: 4,
    lines,
  };
}

/** The result of a count finished in this preview session, or the large fixture result. */
export function fakeResult(id: string | null): CountResult {
  const count = id ? counts.get(id) : undefined;
  return count?.result ? resultOf(count) : bigResult();
}

export function historyRows(): CountRecord[] {
  const big = bigResult();
  const finished = [...counts.values()].flatMap((c) => (c.result ? [c.result] : [])).reverse();
  return [
    ...finished,
    { ...big },
    { ...big, id: "00000000-0000-4000-8000-000000000998", location: "Stock room", found: 41, missing: 0, unexpected: 0, finished_at: new Date(Date.now() - 8 * 86_400_000).toISOString(), finished_by: "Carlo Reyes" },
  ];
}
