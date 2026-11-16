import { readFileSync } from "node:fs";
import path from "node:path";
import { prepareZXingModule, readBarcodes } from "zxing-wasm/reader";
import { beforeAll, describe, expect, it } from "vitest";
import { classifyBarcodes, moduleSize, READER_OPTIONS, toFound } from "./barcodes";

describe("classifyBarcodes", () => {
  const serial = { format: "Code39", text: "23VSLE30B047", y: 1236 };
  const upc = { format: "EAN13", text: "0887970617601", y: 1370 };
  const code = { format: "Code128", text: "BBMVSL15L", y: 1490 };

  it("finds the UPC, the serial number above it, and the product code below it", () => {
    expect(classifyBarcodes([code, upc, serial])).toEqual({
      upc: "887970617601",
      serial: "23VSLE30B047",
      product_code: "BBMVSL15L",
    });
  });

  it("accepts a UPC-A result of 12 digits", () => {
    expect(classifyBarcodes([{ format: "UPCA", text: "887970617601", y: 10 }]).upc).toBe("887970617601");
  });

  it("does not use an EAN-13 code that is not a UPC", () => {
    expect(classifyBarcodes([{ format: "EAN13", text: "4006381333931", y: 10 }]).upc).toBeNull();
  });

  it("does not use a UPC with a wrong check digit", () => {
    expect(classifyBarcodes([{ format: "UPCA", text: "887970617602", y: 10 }]).upc).toBeNull();
  });

  it("takes the upper code as the serial number when the photo has no UPC", () => {
    expect(classifyBarcodes([code, serial])).toEqual({ upc: null, serial: "23VSLE30B047", product_code: "BBMVSL15L" });
  });

  it("takes one code below the UPC as the serial number when no code is above it", () => {
    // Some labels can have the serial number below the UPC. One code is more likely the serial number.
    expect(classifyBarcodes([upc, { ...serial, y: 1500 }])).toEqual({
      upc: "887970617601",
      serial: "23VSLE30B047",
      product_code: null,
    });
  });

  it("takes one code below the UPC that starts with letters as the product code", () => {
    // Photo 8: the serial barcode has glare. Only the UPC and the product code read.
    expect(classifyBarcodes([upc, code])).toEqual({ upc: "887970617601", serial: null, product_code: "BBMVSL15L" });
  });

  it("makes the serial number upper case and ignores text that cannot be a serial number", () => {
    expect(classifyBarcodes([{ format: "Code128", text: "ab12cd34", y: 1 }]).serial).toBe("AB12CD34");
    expect(classifyBarcodes([{ format: "QRCode", text: "https://example.com/a?b=1", y: 1 }]).serial).toBeNull();
  });

  it("returns nothing for a photo with no barcode", () => {
    expect(classifyBarcodes([])).toEqual({ upc: null, serial: null, product_code: null });
  });
});

describe("moduleSize", () => {
  const edge = (width: number) => ({ topLeft: { x: 0, y: 0 }, topRight: { x: width, y: 0 } });
  it("gives the width of one bar unit of a serial barcode", () => {
    // 12 characters and 2 stop characters, 16 units each.
    expect(moduleSize([{ format: "Code39", text: "23VSLE30B047", position: edge(448) }])).toBeCloseTo(2);
  });

  it("scales a UPC to the bar unit of the serial on the same label", () => {
    // 95 units. UPC bars are 1.2 times wider than the serial bars on the labels.
    expect(moduleSize([{ format: "EAN13", text: "0887970778029", position: edge(228) }])).toBeCloseTo(2);
  });

  it("is null with no barcode", () => {
    expect(moduleSize([])).toBeNull();
  });
});

describe("the sample label photo", () => {
  beforeAll(() => {
    // Load the reader from the copy that the app serves, not from the network.
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

  it("gives the serial number and the UPC", async () => {
    const photo = readFileSync(path.resolve("doc/study/assets/ball-box-label-sample.jpg"));
    const results = await readBarcodes(new Blob([photo]), READER_OPTIONS);
    expect(classifyBarcodes(toFound(results))).toMatchObject({ upc: "887970617601", serial: "23VSLE30B047" });
  });
});
