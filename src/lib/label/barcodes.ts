// Finds the label values that are printed as barcodes: the UPC, the serial number, and the product code.
// A barcode read is exact or it fails. It does not misread one character, as a text read from a photo can.
import type { ReaderOptions, ReadResult } from "zxing-wasm/reader";
import { normalizeSerial, validateUpc } from "./rules";

export const READER_OPTIONS: ReaderOptions = {
  tryHarder: true,
  tryRotate: true,
  tryDownscale: true,
  maxNumberOfSymbols: 8,
};

/** One barcode in the photo. `y` is the distance from the top of the label, not of the photo. */
export type FoundBarcode = { format: string; text: string; y: number };
export type LabelBarcodes = { upc: string | null; serial: string | null; product_code: string | null };

export function toFound(results: ReadResult[]): FoundBarcode[] {
  return results
    .filter((r) => r.isValid)
    .map((r) => {
      const { topLeft, topRight, bottomLeft, bottomRight } = r.position;
      const x = (topLeft.x + topRight.x + bottomLeft.x + bottomRight.x) / 4;
      const y = (topLeft.y + topRight.y + bottomLeft.y + bottomRight.y) / 4;
      // The orientation is the turn of the barcode, clockwise. The label turns with it.
      // Measure along the label's own top-to-bottom line, so an upside-down label keeps its order.
      const turn = (r.orientation * Math.PI) / 180;
      return { format: r.format, text: r.text, y: y * Math.cos(turn) - x * Math.sin(turn) };
    });
}

type Point = { x: number; y: number };
const isUpc = (format: string) => format.startsWith("EAN") || format.startsWith("UPC");
/** On the labels, the bars of the UPC are 1.2 times wider than the bars of the serial barcode. */
const UPC_TO_SERIAL = 1.2;

/**
 * The width in pixels of one bar unit, in the size of the serial barcode, for the smallest
 * barcode that read. A small value means the label is far from the camera. Null with no barcode.
 * Code 39 has 16 units for each character, with a start and a stop character. A UPC has 95 units.
 */
export function moduleSize(results: { format: string; text: string; position: { topLeft: Point; topRight: Point } }[]): number | null {
  let smallest: number | null = null;
  for (const r of results) {
    const width = Math.hypot(r.position.topRight.x - r.position.topLeft.x, r.position.topRight.y - r.position.topLeft.y);
    const size = isUpc(r.format) ? width / 95 / UPC_TO_SERIAL : width / ((r.text.length + 2) * 16);
    smallest = smallest === null ? size : Math.min(smallest, size);
  }
  return smallest;
}

/** A product code on the labels starts with letters (BBMVSL15L). A serial number starts with the year (23VSLE30B047). */
const startsWithLetter = (text: string) => /^[A-Z]/.test(text);

const UPC_FORMATS = ["UPCA", "UPC-A", "EAN13", "EAN-13"];

/**
 * Sorts the barcodes of one label photo into fields.
 * On the labels that the shop gets, the serial number is above the UPC and the product code is below it.
 * The staff member sees the result on the confirm screen and can correct it.
 */
export function classifyBarcodes(found: FoundBarcode[]): LabelBarcodes {
  let upc: string | null = null;
  let upcY = 0;
  const others: { text: string; y: number }[] = [];

  for (const code of found) {
    if (UPC_FORMATS.includes(code.format)) {
      // A reader can give a UPC-A code as EAN-13 with a 0 in front.
      const digits = code.format.startsWith("EAN") && /^0\d{12}$/.test(code.text) ? code.text.slice(1) : code.text;
      const checked = validateUpc(digits);
      if (checked.ok && upc === null) {
        upc = checked.value;
        upcY = code.y;
      }
      continue;
    }
    const text = normalizeSerial(code.text);
    if (text.ok) others.push({ text: text.value, y: code.y });
  }
  others.sort((a, b) => a.y - b.y);

  if (upc !== null && others.length === 1 && others[0].y >= upcY && startsWithLetter(others[0].text)) {
    // One code below the UPC, with the form of a product code: the serial barcode did not read.
    return { upc, serial: null, product_code: others[0].text };
  }
  if (upc === null || others.length < 2) {
    // With no UPC for reference, or only one other code, the upper code is the serial number.
    return { upc, serial: others[0]?.text ?? null, product_code: others[1]?.text ?? null };
  }
  const above = others.filter((o) => o.y < upcY);
  const below = others.filter((o) => o.y >= upcY);
  const serial = above.at(-1) ?? below[0];
  const productCode = below.find((o) => o !== serial) ?? above.find((o) => o !== serial);
  return { upc, serial: serial.text, product_code: productCode?.text ?? null };
}
