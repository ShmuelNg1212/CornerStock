import { describe, expect, it } from "vitest";
import { readMessage, scanStatus } from "./batch";

const codes = { upc: "887970617601", serial: "23VSLE30B047", product_code: "BBMVSL15L" };

describe("readMessage", () => {
  it("is empty when both barcodes were read and the catalog was checked", () => {
    expect(readMessage(codes, false)).toBeNull();
  });

  it("says when the photo could not be read", () => {
    expect(readMessage(null, false)).toMatch(/could not be read/);
  });

  it("says when no barcode was found", () => {
    expect(readMessage({ upc: null, serial: null, product_code: null }, false)).toMatch(/No barcode/);
  });

  it("names the missing serial number or UPC", () => {
    expect(readMessage({ ...codes, serial: null }, false)).toMatch(/serial number barcode/);
    expect(readMessage({ ...codes, upc: null }, false)).toMatch(/UPC barcode/);
  });

  it("says when the catalog was not checked", () => {
    expect(readMessage(codes, true)).toMatch(/catalog was not checked/);
  });
});

describe("scanStatus", () => {
  const base = { codes, knownModel: true, existingBallId: null, lookupFailed: false, serialsBefore: [] as string[] };

  it("is ready when both barcodes are read, the model is known, and the serial is new", () => {
    expect(scanStatus(base)).toBe("ready");
  });

  it("needs details when the UPC is not in the catalog", () => {
    expect(scanStatus({ ...base, knownModel: false })).toBe("needs_details");
  });

  it("needs details when a barcode was not read", () => {
    expect(scanStatus({ ...base, codes: { ...codes, serial: null } })).toBe("needs_details");
    expect(scanStatus({ ...base, codes: null })).toBe("needs_details");
  });

  it("needs details when the catalog was not checked", () => {
    expect(scanStatus({ ...base, lookupFailed: true })).toBe("needs_details");
  });

  it("is a duplicate when the serial number is already recorded", () => {
    expect(scanStatus({ ...base, existingBallId: "b1" })).toBe("duplicate");
  });

  it("is a duplicate when an earlier photo in the batch has the same serial number", () => {
    expect(scanStatus({ ...base, serialsBefore: ["23VSLE30B047"] })).toBe("duplicate");
  });
});
