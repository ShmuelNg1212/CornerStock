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

/** One barcode in the photo. `y` is the distance from the top of the photo. */
export type FoundBarcode = { format: string; text: string; y: number };
export type LabelBarcodes = { upc: string | null; serial: string | null; product_code: string | null };

export function toFound(results: ReadResult[]): FoundBarcode[] {
  return results.filter((r) => r.isValid).map((r) => ({ format: r.format, text: r.text, y: r.position.topLeft.y }));
}

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
