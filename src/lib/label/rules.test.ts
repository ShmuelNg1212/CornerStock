import { describe, expect, it } from "vitest";
import {
  PRODUCT_CODE_AS_SERIAL,
  formatGrossWeight,
  normalizeSerial,
  parseBoxedDate,
  parseDecimal,
  parseGrossWeight,
  parsePinDistance,
  validateLabel,
  validateModelDetails,
  validateUpc,
} from "./rules";

describe("validateUpc", () => {
  it("accepts the sample label UPC with spaces", () => {
    expect(validateUpc("8 87970 61760 1")).toEqual({ ok: true, value: "887970617601" });
  });
  it("rejects a wrong check digit", () => {
    expect(validateUpc("887970617602").ok).toBe(false);
  });
  it("rejects a misread digit", () => {
    expect(validateUpc("887970617001").ok).toBe(false);
  });
  it("rejects the wrong length", () => {
    expect(validateUpc("88797061760").ok).toBe(false);
  });
  it("rejects letters", () => {
    expect(validateUpc("88797061760A").ok).toBe(false);
  });
});

describe("parseGrossWeight", () => {
  it("parses the sample label weight to ounces", () => {
    expect(parseGrossWeight("15 LBS 4 OZ")).toEqual({ ok: true, value: 244 });
  });
  it("parses compact and lower case forms", () => {
    expect(parseGrossWeight("15lb 4oz")).toEqual({ ok: true, value: 244 });
    expect(parseGrossWeight("14 lbs 15 oz")).toEqual({ ok: true, value: 239 });
  });
  it("parses pounds with no ounces", () => {
    expect(parseGrossWeight("16 LBS")).toEqual({ ok: true, value: 256 });
  });
  it("rejects 16 or more ounces", () => {
    expect(parseGrossWeight("15 LBS 16 OZ").ok).toBe(false);
  });
  it("rejects a weight that no bowling ball has", () => {
    expect(parseGrossWeight("40 LBS 1 OZ").ok).toBe(false);
    expect(parseGrossWeight("2 LBS 1 OZ").ok).toBe(false);
  });
  it("rejects text with no number", () => {
    expect(parseGrossWeight("heavy").ok).toBe(false);
  });
});

describe("formatGrossWeight", () => {
  it("shows pounds and ounces", () => {
    expect(formatGrossWeight(244)).toBe("15 lb 4 oz");
  });
});

describe("parsePinDistance", () => {
  it("parses the sample label range", () => {
    expect(parsePinDistance("3-3.5")).toEqual({ ok: true, value: { min: 3, max: 3.5 } });
  });
  it("parses a range with spaces", () => {
    expect(parsePinDistance("2 - 2.5")).toEqual({ ok: true, value: { min: 2, max: 2.5 } });
  });
  it("parses one value as an equal range", () => {
    expect(parsePinDistance("4")).toEqual({ ok: true, value: { min: 4, max: 4 } });
  });
  it("rejects a reversed range", () => {
    expect(parsePinDistance("3.5-3").ok).toBe(false);
  });
  it("rejects a value that is too large", () => {
    expect(parsePinDistance("3-35").ok).toBe(false);
  });
});

describe("parseDecimal", () => {
  it("parses a value with no leading zero", () => {
    expect(parseDecimal(".054", 0, 1)).toEqual({ ok: true, value: 0.054 });
  });
  it("rejects a value out of range", () => {
    expect(parseDecimal("24.8", 2, 3).ok).toBe(false);
  });
  it("rejects text", () => {
    expect(parseDecimal("n/a", 0, 1).ok).toBe(false);
  });
});

describe("parseBoxedDate", () => {
  it("parses the sample label date as month/day/year", () => {
    expect(parseBoxedDate("5/30/2023")).toEqual({ ok: true, value: "2023-05-30" });
  });
  it("accepts an ISO date", () => {
    expect(parseBoxedDate("2023-05-30")).toEqual({ ok: true, value: "2023-05-30" });
  });
  it("rejects a date that does not exist", () => {
    expect(parseBoxedDate("2/30/2023").ok).toBe(false);
  });
  it("rejects a month above 12", () => {
    expect(parseBoxedDate("30/5/2023").ok).toBe(false);
  });
});

describe("normalizeSerial", () => {
  it("removes spaces and makes upper case", () => {
    expect(normalizeSerial(" 23vsle30b047 ")).toEqual({ ok: true, value: "23VSLE30B047" });
  });
  it("rejects a serial that is too short", () => {
    expect(normalizeSerial("12").ok).toBe(false);
  });
  it("rejects symbols", () => {
    expect(normalizeSerial("23VSLE30B047!").ok).toBe(false);
  });
});

describe("validateLabel", () => {
  const sample = {
    serial: "23VSLE30B047",
    upc: "8 87970 61760 1",
    brand: "Storm",
    model_name: "Solid Lock",
    nominal_weight_lb: "15",
    color: "Dark Red",
    fragrance: "Red Hot Cinnamon",
    coverstock: "NeX Solid Reactive",
    weight_block: "RAD-X Core",
    finish: "1500-grit Polished",
    rg: "2.48",
    diff: ".054",
    mass_bias: ".018",
    product_code: "BBMVSL15L",
    gross_weight: "15 LBS 4 OZ",
    top_weight: "3.28",
    pin_distance: "3-3.5",
    boxed_on: "5/30/2023",
  };

  it("accepts the sample label", () => {
    const result = validateLabel(sample);
    expect(result.errors).toEqual({});
    expect(result.value).toEqual({
      serial: "23VSLE30B047",
      upc: "887970617601",
      brand: "Storm",
      model_name: "Solid Lock",
      nominal_weight_lb: 15,
      color: "Dark Red",
      fragrance: "Red Hot Cinnamon",
      coverstock: "NeX Solid Reactive",
      weight_block: "RAD-X Core",
      finish: "1500-grit Polished",
      rg: 2.48,
      diff: 0.054,
      mass_bias: 0.018,
      product_code: "BBMVSL15L",
      gross_weight_oz: 244,
      top_weight: 3.28,
      pin_min: 3,
      pin_max: 3.5,
      boxed_on: "2023-05-30",
    });
  });

  it("requires serial, UPC, model name, and nominal weight", () => {
    const result = validateLabel({});
    expect(result.value).toBeNull();
    expect(Object.keys(result.errors).sort()).toEqual(["model_name", "nominal_weight_lb", "serial", "upc"]);
  });

  it("permits empty optional fields", () => {
    const result = validateLabel({
      serial: sample.serial,
      upc: sample.upc,
      model_name: sample.model_name,
      nominal_weight_lb: "15",
      fragrance: "",
      top_weight: null,
    });
    expect(result.errors).toEqual({});
    expect(result.value?.fragrance).toBeNull();
    expect(result.value?.top_weight).toBeNull();
    expect(result.value?.gross_weight_oz).toBeNull();
  });

  it("gives an error for the bad field only", () => {
    const result = validateLabel({ ...sample, pin_distance: "abc" });
    expect(result.value).toBeNull();
    expect(Object.keys(result.errors)).toEqual(["pin_distance"]);
  });

  it("rejects a nominal weight that is not a ball weight", () => {
    expect(validateLabel({ ...sample, nominal_weight_lb: "25" }).errors.nominal_weight_lb).toBeDefined();
  });
});

describe("validateLabel with a product code in the serial number", () => {
  const base = { upc: "887970617601", model_name: "Solid Lock", nominal_weight_lb: "15" };
  it("refuses a serial number that is the product code", () => {
    const { value, errors } = validateLabel({ ...base, serial: "bbmvsl15l", product_code: "BBMVSL15L" });
    expect(value).toBeNull();
    expect(errors.serial).toBe(PRODUCT_CODE_AS_SERIAL);
  });
  it("accepts a different serial number", () => {
    expect(validateLabel({ ...base, serial: "23VSLE30B047", product_code: "BBMVSL15L" }).value).not.toBeNull();
  });
});

describe("validateModelDetails", () => {
  const details = {
    brand: " Storm ",
    model_name: "Phaze II",
    color: "Pearl",
    fragrance: "",
    coverstock: "TX-16",
    weight_block: "Velocity",
    finish: "1500 Polished",
    rg: "2.48",
    diff: "0.051",
    mass_bias: "",
    product_code: "",
  };

  it("trims text and turns empty fields into null", () => {
    const { value, errors } = validateModelDetails(details);
    expect(errors).toEqual({});
    expect(value).toEqual({
      brand: "Storm",
      name: "Phaze II",
      color: "Pearl",
      fragrance: null,
      coverstock: "TX-16",
      weight_block: "Velocity",
      finish: "1500 Polished",
      rg: 2.48,
      diff: 0.051,
      mass_bias: null,
      product_code: null,
    });
  });
  it("needs a model name", () => {
    const { value, errors } = validateModelDetails({ ...details, model_name: "  " });
    expect(value).toBeNull();
    expect(errors.model_name).toBeDefined();
  });
  it("rejects numbers out of range, as the database does", () => {
    const { value, errors } = validateModelDetails({ ...details, rg: "3.2", diff: "0.2", mass_bias: "abc" });
    expect(value).toBeNull();
    expect(Object.keys(errors).sort()).toEqual(["diff", "mass_bias", "rg"]);
  });
  it("rejects text that is too long", () => {
    expect(validateModelDetails({ ...details, color: "x".repeat(121) }).errors.color).toMatch(/120 characters/);
  });
});
