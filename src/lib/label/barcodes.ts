// Finds the label values that are printed as barcodes: the UPC, the serial number, and the product code.
// A barcode read is exact or it fails. It does not misread one character, as a text read from a photo can.
import type { ReaderOptions, ReadResult } from "zxing-wasm/reader";
import { normalizeSerial, validateUpc } from "./rules";

export const READER_OPTIONS: ReaderOptions = {
  // Only the formats of the labels. This reads 4 times faster than all formats, with the same codes.
  // The Storm-group labels use UPC-A and Code 39. Code 128 stays for labels of other brands; it costs almost nothing.
  formats: ["UPC-A", "EAN-13", "Code39", "Code128"],
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

export type CodeShape = "serial" | "product" | "unknown";

/**
 * The form of a code on the Storm-group labels. Both codes are Code 39, so only the text tells them apart.
 * A serial number starts with the 2-digit year, then letters (23VSLE30B047).
 * A product code starts with letters and ends with the weight (BBMVSL15L).
 */
export function codeShape(text: string): CodeShape {
  if (/^\d{2}[A-Z]/.test(text)) return "serial";
  if (/^[A-Z]/.test(text)) return "product";
  return "unknown";
}

const UPC_FORMATS = ["UPCA", "UPC-A", "EAN13", "EAN-13"];

/**
 * Sorts the barcodes of one label photo into fields.
 * The form of the text decides first. A code with the product code form never becomes the serial number:
 * a missing serial number is safe, because the staff member must then scan or type it.
 * The position decides only between codes of the same form. On the labels, the serial number is above
 * the UPC and the product code is below it. The staff member sees the result on the confirm screen.
 */
export function classifyBarcodes(found: FoundBarcode[]): LabelBarcodes {
  let upc: string | null = null;
  let upcY: number | null = null;
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
    if (text.ok && !others.some((o) => o.text === text.value)) others.push({ text: text.value, y: code.y });
  }
  others.sort((a, b) => a.y - b.y);

  // The serial number: the lowest code above the UPC, else the top code.
  const pickSerial = (list: typeof others) => (upcY === null ? list[0] : (list.filter((o) => o.y < upcY!).at(-1) ?? list[0]));
  // The product code: the top code below the UPC, else the top code.
  const pickProduct = (list: typeof others) => (upcY === null ? list[0] : (list.find((o) => o.y >= upcY!) ?? list[0]));

  const of = (shape: CodeShape) => others.filter((o) => codeShape(o.text) === shape);
  const serial = pickSerial(of("serial")) ?? pickSerial(of("unknown"));
  const rest = others.filter((o) => o !== serial && codeShape(o.text) !== "serial");
  const productCode = pickProduct(rest.filter((o) => codeShape(o.text) === "product")) ?? pickProduct(rest);
  return { upc, serial: serial?.text ?? null, product_code: productCode?.text ?? null };
}
