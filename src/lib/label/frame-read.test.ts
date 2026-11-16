import { readFileSync } from "node:fs";
import path from "node:path";
import jpeg from "jpeg-js";
import { prepareZXingModule } from "zxing-wasm/reader";
import { beforeAll, describe, expect, it } from "vitest";
import { analyzeFrame, type FrameImage } from "./frame-read";
import { frameHasGlare, FRAME_LIMITS } from "./frame-quality";

const fixture = (n: number): FrameImage => {
  const file = path.resolve(`src/lib/label/__fixtures__/label-${String(n).padStart(2, "0")}.jpg`);
  const { data, width, height } = jpeg.decode(readFileSync(file), { useTArray: true });
  return { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), width, height };
};

// The codes that each label photo gives at 1920 px. See doc/plan/1794837817_live_viewfinder.md.
const EXPECTED: Record<number, { upc?: string; serial?: string; product_code?: string }> = {
  1: { upc: "887970617601", serial: "23VSLE30B047", product_code: "BBMVSL15L" },
  2: { upc: "887970778029", serial: "26GRNE12A043", product_code: "BBMGRN14L" },
  3: { upc: "887970777992", serial: "26GRNE08B001", product_code: "BBMGRN13L" },
  4: { serial: "26GRNE12B037", product_code: "BBMGRN14L" },
  5: { serial: "26GRNE08A025", product_code: "BBMGRN13L" },
  6: { upc: "887970752517" },
  7: {},
  8: { upc: "887970760116", product_code: "BBMRTQ15L" },
  9: { upc: "887970760086", serial: "25RTQI26I031" },
  10: { upc: "887970760086", serial: "25RTQI26J031", product_code: "BBMRTQ14L" },
};

describe("analyzeFrame on the label photos", () => {
  beforeAll(() => {
    const wasm = readFileSync(path.resolve("public/zxing_reader.wasm"));
    prepareZXingModule({
      overrides: {
        instantiateWasm(imports, done) {
          WebAssembly.instantiate(wasm, imports).then(({ instance }) => done(instance));
          return {};
        },
      },
    });
  });

  for (const [n, expected] of Object.entries(EXPECTED)) {
    it(`photo ${n} gives at least the expected codes, and no wrong code`, async () => {
      const { codes } = await analyzeFrame(fixture(Number(n)));
      for (const field of ["upc", "serial", "product_code"] as const) {
        if (expected[field]) expect(codes[field]).toBe(expected[field]);
        // A code that did not read is null. It is never a different code.
        else if (codes[field] !== null) expect(Object.values(EXPECTED).some((e) => e[field] === codes[field])).toBe(true);
      }
    });
  }

  it("reports glare on the photos with glare, and no glare on the clean photos", async () => {
    for (const n of [4, 5, 8]) expect(frameHasGlare(await analyzeFrame(fixture(n))), `photo ${n}`).toBe(true);
    for (const n of [2, 3, 10]) expect(frameHasGlare(await analyzeFrame(fixture(n))), `photo ${n}`).toBe(false);
  });

  it("finds the barcodes of the glare photos large enough, so the hint is glare and not distance", async () => {
    for (const n of [4, 5, 8]) expect((await analyzeFrame(fixture(n))).moduleSize, `photo ${n}`).toBeGreaterThanOrEqual(FRAME_LIMITS.farBelow);
  });

  it("finds all real photos sharp", async () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      expect((await analyzeFrame(fixture(n))).sharpness, `photo ${n}`).toBeGreaterThanOrEqual(FRAME_LIMITS.softBelow);
    }
  });
});
