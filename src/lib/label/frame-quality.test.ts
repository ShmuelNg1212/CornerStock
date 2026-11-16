import { describe, expect, it } from "vitest";
import { decideFrame, frameHasGlare, FRAME_LIMITS, frameScores, type FrameRead } from "./frame-quality";

/** A gray image of the given size. `paint` sets the brightness of each pixel. */
function image(width: number, height: number, paint: (x: number, y: number) => number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const v = paint(x, y);
      data.set([v, v, v, 255], (y * width + x) * 4);
    }
  return { data, width, height };
}

const stripes = (x: number) => (Math.floor(x / 6) % 2 ? 20 : 230);

describe("frameScores", () => {
  it("gives a flat image a sharpness below the limit", () => {
    expect(frameScores(image(640, 480, () => 128)).sharpness).toBeLessThan(FRAME_LIMITS.softBelow);
  });

  it("gives an image of sharp black and white stripes a sharpness above the limit", () => {
    expect(frameScores(image(640, 480, stripes)).sharpness).toBeGreaterThanOrEqual(FRAME_LIMITS.softBelow);
  });

  it("finds a large white patch as glare", () => {
    const patch = image(640, 480, (x, y) => (x > 200 && x < 400 && y > 150 && y < 300 ? 255 : stripes(x)));
    expect(frameScores(patch).glareShare).toBeGreaterThanOrEqual(FRAME_LIMITS.glareBlobShare);
  });

  it("does not find small white dots as glare", () => {
    const dots = image(640, 480, (x, y) => (x % 100 < 4 && y % 100 < 4 ? 255 : stripes(x)));
    expect(frameScores(dots).glareShare).toBeLessThan(FRAME_LIMITS.glareBlobShare);
  });
});

const read = (at: number, change: Partial<FrameRead> = {}): FrameRead => ({
  at,
  codes: { upc: "887970617601", serial: "23VSLE30B047", product_code: null },
  sharpness: 3000,
  glareShare: 0,
  moduleSize: 2.5,
  ...change,
});
const none = { upc: null, serial: null, product_code: null };

describe("frameHasGlare", () => {
  it("is true for a sharp frame where one barcode reads and a neighbour does not", () => {
    expect(frameHasGlare(read(0, { codes: { upc: null, serial: "26GRNE12B037", product_code: "BBMGRN14L" } }))).toBe(true);
  });

  it("is false for a frame with no barcode, or with the UPC and the serial", () => {
    expect(frameHasGlare(read(0, { codes: none }))).toBe(false);
    expect(frameHasGlare(read(0))).toBe(false);
  });

  it("is false when the barcodes are too small to read: the label is too far, not in glare", () => {
    expect(frameHasGlare(read(0, { codes: { upc: "887970778029", serial: null, product_code: null }, moduleSize: 1.5 }))).toBe(false);
  });

  it("is true for a frame with a large white patch", () => {
    expect(frameHasGlare(read(0, { codes: none, glareShare: 0.05 }))).toBe(true);
  });
});

describe("decideFrame", () => {
  it("captures when two frames in a row give the same UPC and serial", () => {
    expect(decideFrame([read(0), read(200)], 200)).toEqual({ capture: true, hint: "hold" });
  });

  it("waits after one complete frame", () => {
    expect(decideFrame([read(0, { codes: none }), read(200)], 200)).toEqual({ capture: false, hint: "hold" });
  });

  it("waits when the serial changes between frames", () => {
    expect(decideFrame([read(0, { codes: { upc: "887970617601", serial: "OTHER1", product_code: null } }), read(200)], 200).capture).toBe(false);
  });

  it("does not capture a soft frame, and says why", () => {
    expect(decideFrame([read(0), read(200, { sharpness: 10 })], 200)).toEqual({ capture: false, hint: "soft" });
  });

  it("does not capture a serial in the skip list, and says it is added", () => {
    expect(decideFrame([read(0), read(200)], 200, ["23VSLE30B047"])).toEqual({ capture: false, hint: "added" });
  });

  it("shows the glare hint after glare lasts for the hold time", () => {
    const glare = { codes: { upc: null, serial: "26GRNE12B037", product_code: "BBMGRN14L" } };
    const frames = [0, 200, 400, 600, 800, 1000].map((at) => read(at, glare));
    expect(decideFrame(frames.slice(0, 2), 200).hint).toBe("hold");
    expect(decideFrame(frames, 1000).hint).toBe("glare");
  });

  it("asks to move closer when a partial read stays too small", () => {
    const far = { codes: { upc: "887970778029", serial: null, product_code: null }, moduleSize: 1.5 };
    const frames = [0, 200, 400, 600, 800, 1000].map((at) => read(at, far));
    expect(decideFrame(frames, 1000).hint).toBe("far");
  });

  it("shows the soft hint when frames with no barcode stay soft", () => {
    const frames = [0, 300, 600, 900, 1200].map((at) => read(at, { codes: none, sharpness: 10 }));
    expect(decideFrame(frames, 1200).hint).toBe("soft");
  });

  it("asks to line up the phone after a time with no barcode", () => {
    const frames = [0, 1000, 2000, 3000, 4000, 4500].map((at) => read(at, { codes: none }));
    expect(decideFrame(frames.slice(0, 3), 2000).hint).toBe("aim");
    expect(decideFrame(frames, 4500).hint).toBe("align");
  });

  it("starts with the aim hint", () => {
    expect(decideFrame([], 0)).toEqual({ capture: false, hint: "aim" });
  });
});
