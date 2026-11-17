import { readFileSync } from "node:fs";
import path from "node:path";
import { prepareZXingModule, readBarcodes } from "zxing-wasm/reader";
import { beforeAll, describe, expect, it } from "vitest";
import { classifyBarcodes, codeShape, mergeLabelCodes, moduleSize, READER_OPTIONS, toFound } from "./barcodes";

describe("READER_OPTIONS", () => {
  // Fewer formats read 4 times faster. Code 128 stays for labels of other brands.
  it("reads only the barcode formats of the ball box labels", () => {
    expect(READER_OPTIONS.formats).toEqual(["UPC-A", "EAN-13", "Code39", "Code128"]);
  });
});

describe("mergeLabelCodes", () => {
  const live = { upc: "887970617601", serial: "23VSLE30B047", product_code: null };

  it("keeps the codes of the live camera when the photo read misses them", () => {
    expect(mergeLabelCodes(live, { upc: null, serial: "23VSLE30B047", product_code: "BBMVSL15L" })).toEqual({
      ...live,
      product_code: "BBMVSL15L",
    });
  });

  it("keeps the live codes when the photo read fails", () => {
    expect(mergeLabelCodes(live, null)).toEqual(live);
  });

  it("prefers the live serial and UPC: several frames confirmed them", () => {
    expect(mergeLabelCodes(live, { upc: "887970778029", serial: "26GRNE12A043", product_code: null })).toEqual(live);
  });

  it("gives the photo read when there are no live codes", () => {
    const read = { upc: "887970778029", serial: null, product_code: null };
    expect(mergeLabelCodes(undefined, read)).toBe(read);
    expect(mergeLabelCodes(undefined, null)).toBeNull();
  });
});

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
    expect(classifyBarcodes([{ format: "Code128", text: "23ab45cd", y: 1 }]).serial).toBe("23AB45CD");
    expect(classifyBarcodes([{ format: "QRCode", text: "https://example.com/a?b=1", y: 1 }]).serial).toBeNull();
  });

  it("never takes a code with the product code form as the serial number, at any position", () => {
    // Photo 8: the label is turned, and the product code is above the UPC.
    expect(classifyBarcodes([{ ...code, y: 1200 }, upc])).toEqual({ upc: "887970617601", serial: null, product_code: "BBMVSL15L" });
    // No UPC read: the product code is the only code.
    expect(classifyBarcodes([code])).toEqual({ upc: null, serial: null, product_code: "BBMVSL15L" });
  });

  it("uses the form of the codes before their position", () => {
    // The product code is above the serial number, for example on an upside-down read.
    expect(classifyBarcodes([{ ...code, y: 100 }, upc, { ...serial, y: 1600 }])).toEqual({
      upc: "887970617601",
      serial: "23VSLE30B047",
      product_code: "BBMVSL15L",
    });
  });

  it("uses the position when two codes have the serial form", () => {
    const other = { format: "Code39", text: "23VSLE30B048", y: 1500 };
    expect(classifyBarcodes([other, upc, serial])).toMatchObject({ serial: "23VSLE30B047" });
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

describe("codeShape", () => {
  it("knows the serial number form and the product code form", () => {
    expect(codeShape("23VSLE30B047")).toBe("serial");
    expect(codeShape("BBMGRN14L")).toBe("product");
    expect(codeShape("123456")).toBe("unknown");
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

  // The values that each fixture photo must give. A field that does not read is null, never a wrong value.
  const expected: Record<string, { upc: string | null; serial: string | null; product_code: string | null }> = {
    "label-01.jpg": { upc: "887970617601", serial: "23VSLE30B047", product_code: "BBMVSL15L" },
    "label-02.jpg": { upc: "887970778029", serial: "26GRNE12A043", product_code: "BBMGRN14L" },
    "label-03.jpg": { upc: "887970777992", serial: "26GRNE08B001", product_code: "BBMGRN13L" },
    "label-04.jpg": { upc: null, serial: "26GRNE12B037", product_code: "BBMGRN14L" },
    "label-05.jpg": { upc: null, serial: "26GRNE08A025", product_code: "BBMGRN13L" },
    "label-06.jpg": { upc: "887970752517", serial: null, product_code: null },
    "label-07.jpg": { upc: null, serial: null, product_code: null },
    "label-08.jpg": { upc: "887970760116", serial: null, product_code: "BBMRTQ15L" },
    "label-09.jpg": { upc: "887970760086", serial: "25RTQI26I031", product_code: "BBMRTQ14L" },
    "label-10.jpg": { upc: "887970760086", serial: "25RTQI26J031", product_code: "BBMRTQ14L" },
  };
  it.each(Object.keys(expected))("sorts the codes of %s", async (name) => {
    const photo = readFileSync(path.resolve("src/lib/label/__fixtures__", name));
    const results = await readBarcodes(new Blob([photo]), READER_OPTIONS);
    expect(classifyBarcodes(toFound(results))).toEqual(expected[name]);
  }, 30000);
});
