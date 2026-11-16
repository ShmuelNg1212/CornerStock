import { describe, expect, it } from "vitest";
import { ballSwatches, FALLBACK_SWATCH } from "./ball-colors";

describe("ballSwatches", () => {
  it("gives one swatch for each known color word, in order", () => {
    expect(ballSwatches("Red / Blue / Purple")).toHaveLength(3);
    const [red, blue] = ballSwatches("Red / Blue");
    expect(red).not.toBe(blue);
  });

  it("gives three swatches at most", () => {
    expect(ballSwatches("Red / Blue / Purple / Gold / Teal")).toHaveLength(3);
  });

  it("reads words in any case, and with other separators", () => {
    expect(ballSwatches("sky blue, PINK")).toEqual(ballSwatches("Sky Blue / Pink"));
    expect(ballSwatches("Carbon/Lime")).toHaveLength(2);
  });

  it("knows two-word colors before their last word", () => {
    expect(ballSwatches("Sky Blue")[0]).not.toBe(ballSwatches("Blue")[0]);
  });

  it("skips unknown words and gives navy when no word is known", () => {
    expect(ballSwatches("Ultramarine / Black")).toHaveLength(2);
    expect(ballSwatches("Xyzzy")).toEqual([FALLBACK_SWATCH]);
    expect(ballSwatches("")).toEqual([FALLBACK_SWATCH]);
    expect(ballSwatches(null)).toEqual([FALLBACK_SWATCH]);
  });

  it("does not repeat a swatch", () => {
    expect(ballSwatches("Black / Black")).toHaveLength(1);
  });
});
