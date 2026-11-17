import { describe, expect, it } from "vitest";
import { addScan, applyScanFailure, applyScanResult, emptySession, groupResult, scanText, type CountLine, type ScanResult } from "./session";

const result = (serial: string, change: Partial<ScanResult> = {}): ScanResult => ({
  serial,
  status: "found",
  duplicate: false,
  ball_id: "b1",
  model_name: "Phaze II",
  brand: "Storm",
  weight_lb: 15,
  location: null,
  scanned: 1,
  expected: 3,
  ...change,
});

describe("count session", () => {
  it("adds a new serial as checking, newest first, and normalizes it", () => {
    const one = addScan(emptySession(3), "23vsle30b047 ");
    expect(one.added).toBe(true);
    const two = addScan(one.session, "26GRNE12A043");
    expect(two.session.scans.map((s) => [s.serial, s.state])).toEqual([
      ["26GRNE12A043", "checking"],
      ["23VSLE30B047", "checking"],
    ]);
  });

  it("does not add a serial that this phone already has", () => {
    const one = addScan(emptySession(3), "23VSLE30B047").session;
    const again = addScan(one, "23VSLE30B047");
    expect(again.added).toBe(false);
    expect(again.session.scans).toHaveLength(1);
  });

  it("refuses a serial with a bad form", () => {
    const bad = addScan(emptySession(3), "ab");
    expect(bad.added).toBe(false);
    expect(bad.error).toMatch(/6 to 30/);
  });

  it("takes the status and the totals from the server", () => {
    const session = addScan(emptySession(3), "23VSLE30B047").session;
    const next = applyScanResult(session, result("23VSLE30B047", { status: "other_location", location: "Warehouse", scanned: 4, expected: 9 }));
    expect(next.scans[0]).toMatchObject({ state: "done", status: "other_location", location: "Warehouse" });
    expect([next.scanned, next.expected]).toEqual([4, 9]);
  });

  it("keeps the larger total when an older reply arrives late", () => {
    let session = addScan(emptySession(3), "A00000001").session;
    session = addScan(session, "A00000002").session;
    session = applyScanResult(session, result("A00000002", { scanned: 2 }));
    session = applyScanResult(session, result("A00000001", { scanned: 1 }));
    expect(session.scanned).toBe(2);
  });

  it("marks a failed scan so it can be sent again", () => {
    const session = addScan(emptySession(3), "23VSLE30B047").session;
    const failed = applyScanFailure(session, "23VSLE30B047", "No connection");
    expect(failed.scans[0]).toMatchObject({ state: "failed", error: "No connection" });
    expect(addScan(failed, "23VSLE30B047").added).toBe(true);
  });

  it("describes each status with words", () => {
    expect(scanText({ status: "found", location: null })).toBe("In this location");
    expect(scanText({ status: "other_location", location: "Warehouse" })).toBe("Recorded in Warehouse");
    expect(scanText({ status: "sold", location: null })).toBe("Recorded as sold");
    expect(scanText({ status: "removed", location: null })).toBe("Recorded as removed");
    expect(scanText({ status: "not_recorded", location: null })).toBe("Not in the records");
  });
});

describe("groupResult", () => {
  const line = (serial: string, change: Partial<CountLine>): CountLine => ({
    serial,
    outcome: "found",
    kind: null,
    ball_id: "b",
    model_name: "Phaze II",
    brand: "Storm",
    weight_lb: 15,
    other_location: null,
    corrected: false,
    action: null,
    ...change,
  });

  it("sorts the lines into missing, unexpected, and found, and counts the open corrections", () => {
    const groups = groupResult([
      line("A1", { outcome: "found" }),
      line("A2", { outcome: "missing", action: "remove" }),
      line("A3", { outcome: "missing", corrected: true }),
      line("A4", { outcome: "unexpected", kind: "other_location", action: "move" }),
      line("A5", { outcome: "unexpected", kind: "removed" }),
    ]);
    expect(groups.missing.map((l) => l.serial)).toEqual(["A2", "A3"]);
    expect(groups.unexpected.map((l) => l.serial)).toEqual(["A4", "A5"]);
    expect(groups.found.map((l) => l.serial)).toEqual(["A1"]);
    expect(groups.open).toBe(2);
    expect(groups.stuck).toBe(1);
  });
});
