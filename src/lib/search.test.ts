import { describe, expect, it } from "vitest";
import { matches } from "./search";

describe("matches", () => {
  it("matches all for an empty search", () => {
    expect(matches("Storm Phaze II", "  ")).toBe(true);
  });

  it("ignores case and accents", () => {
    expect(matches("Storm Phaze II", "PHAZE")).toBe(true);
    expect(matches("Storm Phazé", "phaze")).toBe(true);
  });

  it("reads ! and | as the letter i", () => {
    expect(matches("Storm !Q Tour 78/U", "iq")).toBe(true);
    expect(matches("Storm !Q Tour 78/U", "IQ tour")).toBe(true);
    expect(matches("Storm !Q Tour 78/U", "!q")).toBe(true);
  });

  it("ignores spaces and punctuation", () => {
    expect(matches("Storm Hy-Road", "hyroad")).toBe(true);
    expect(matches("Storm Hy-Road", "hy road")).toBe(true);
    expect(matches("Storm !Q Tour 78/U", "iqtour")).toBe(true);
    expect(matches("Storm !Q Tour 78/U", "78u")).toBe(true);
  });

  it("finds each word in any order", () => {
    expect(matches("Storm Hy-Road Pearl", "pearl storm")).toBe(true);
    expect(matches("Storm Hy-Road Pearl", "pearl hammer")).toBe(false);
  });

  it("accepts one wrong, missing, extra, or swapped letter in a word of 5 or more letters", () => {
    expect(matches("Storm Phaze II", "phaxe")).toBe(true);
    expect(matches("Storm Phaze II", "phaz ii")).toBe(true);
    expect(matches("Storm Phaze II", "phhaze")).toBe(true);
    expect(matches("Storm Phaze II", "pahze")).toBe(true);
    expect(matches("Storm Absolute PTLP", "absolu")).toBe(true);
    expect(matches("Storm Absolute PTLP", "abzolu")).toBe(true);
  });

  it("does not accept a wrong letter in a short word", () => {
    expect(matches("Storm Phaze II", "stom")).toBe(false);
    expect(matches("Roto Grip Hustle", "rodo")).toBe(false);
  });

  it("does not accept two wrong letters", () => {
    expect(matches("Storm Phaze II", "pxaxe")).toBe(false);
  });
});
