// The state of a stock count on one phone, and the words for its statuses.
// Rules: doc/adr/0005-stock-count-rules.md. The server keeps the count; this state only shows it.
import { normalizeSerial } from "@/lib/label/rules";

/** The reply of a count action. */
export type CountReply<T> = { ok: true; value: T } | { ok: false; error: string };
/** The reply of `start_count`: the open count of a location and its totals. */
export type CountOpen = { id: string; location_id: string; location: string; started_at: string; scanned: number; expected: number };

/** The actions of a count. The app uses the server actions; the preview uses fixture data. */
export type CountApi = {
  start: (locationId: string) => Promise<CountReply<CountOpen>>;
  scan: (countId: string, serial: string) => Promise<CountReply<ScanResult>>;
  finish: (countId: string) => Promise<CountReply<CountResult>>;
  cancel: (countId: string) => Promise<CountReply<null>>;
  correct: (countId: string, serial: string, requestId: string, reason: string | null) => Promise<CountReply<CountResult>>;
};

/** The status of a scanned serial, from the server. */
export type ScanStatus = "found" | "other_location" | "sold" | "removed" | "not_recorded";

/** The reply of `add_count_scan`. */
export type ScanResult = {
  serial: string;
  status: ScanStatus;
  /** Another phone, or this phone, scanned this serial before in the same count. */
  duplicate: boolean;
  ball_id: string | null;
  model_name: string | null;
  brand: string | null;
  weight_lb: number | null;
  /** For "other_location": the location of the ball. */
  location: string | null;
  scanned: number;
  expected: number;
};

export type CountScan = {
  serial: string;
  state: "checking" | "done" | "failed";
  status?: ScanStatus;
  duplicate?: boolean;
  ballId?: string | null;
  model?: string | null;
  location?: string | null;
  error?: string;
};

export type CountSession = {
  /** Newest first. */
  scans: CountScan[];
  /** Serials in the count, from all phones. */
  scanned: number;
  /** Balls in stock in the location now. */
  expected: number;
};

export const emptySession = (expected: number, scanned = 0): CountSession => ({ scans: [], scanned, expected });

/**
 * Adds a serial as "checking". A serial that this phone already has, and that did not fail, adds nothing.
 * The server also keeps each serial one time; this check saves a request.
 */
export function addScan(session: CountSession, text: string): { session: CountSession; added: boolean; serial?: string; error?: string } {
  const parsed = normalizeSerial(text);
  if (!parsed.ok) return { session, added: false, error: parsed.error };
  const serial = parsed.value;
  const before = session.scans.find((s) => s.serial === serial);
  if (before && before.state !== "failed") return { session, added: false, serial };
  const scans = [{ serial, state: "checking" as const }, ...session.scans.filter((s) => s.serial !== serial)];
  return { session: { ...session, scans }, added: true, serial };
}

const modelOf = (r: ScanResult) => (r.model_name ? `${r.model_name}${r.weight_lb ? ` ${r.weight_lb} lb` : ""}` : null);

export function applyScanResult(session: CountSession, result: ScanResult): CountSession {
  return {
    scans: session.scans.map((s) =>
      s.serial === result.serial
        ? { serial: s.serial, state: "done", status: result.status, duplicate: result.duplicate, ballId: result.ball_id, model: modelOf(result), location: result.location }
        : s,
    ),
    // Replies can arrive out of order. The totals only grow during a count.
    scanned: Math.max(session.scanned, result.scanned),
    expected: result.expected,
  };
}

export function applyScanFailure(session: CountSession, serial: string, error: string): CountSession {
  return { ...session, scans: session.scans.map((s) => (s.serial === serial ? { serial, state: "failed", error } : s)) };
}

/** The status of a scan in words. Each status also has an icon on screen; color is never the only sign. */
export function scanText({ status, location }: { status: ScanStatus; location: string | null | undefined }): string {
  switch (status) {
    case "found":
      return "In this location";
    case "other_location":
      return `Recorded in ${location ?? "another location"}`;
    case "sold":
      return "Recorded as sold";
    case "removed":
      return "Recorded as removed";
    case "not_recorded":
      return "Not in the records";
  }
}

// ---------------------------------------------------------------------------
// Result of a finished count
// ---------------------------------------------------------------------------

export type CountOutcome = "found" | "missing" | "unexpected";
export type CountKind = "other_location" | "sold" | "removed" | "not_recorded";
/** The correction that the current stock allows. */
export type CountAction = "move" | "remove" | "put_back" | "add";

export type CountLine = {
  serial: string;
  outcome: CountOutcome;
  kind: CountKind | null;
  ball_id: string | null;
  model_name: string | null;
  brand: string | null;
  weight_lb: number | null;
  other_location: string | null;
  /** The stock now agrees with the count for this line. */
  corrected: boolean;
  action: CountAction | null;
};

export type CountResult = {
  id: string;
  location_id: string;
  location: string;
  status: "finished";
  started_at: string;
  finished_at: string;
  started_by: string | null;
  finished_by: string | null;
  found: number;
  missing: number;
  unexpected: number;
  lines: CountLine[];
};

export type CountRecord = Omit<CountResult, "lines" | "status">;

/** Sorts the lines for the result screen. `open`: lines that still have a correction to make. */
export function groupResult(lines: CountLine[]) {
  return {
    missing: lines.filter((l) => l.outcome === "missing"),
    unexpected: lines.filter((l) => l.outcome === "unexpected"),
    found: lines.filter((l) => l.outcome === "found"),
    open: lines.filter((l) => l.action !== null && !l.corrected).length,
  };
}

/** The kind of an unexpected line in words. */
export const kindText = (line: Pick<CountLine, "kind" | "other_location">) =>
  line.kind ? scanText({ status: line.kind, location: line.other_location }) : "";
