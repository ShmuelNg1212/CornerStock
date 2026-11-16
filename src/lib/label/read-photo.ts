"use client";

import { prepareZXingModule, readBarcodes } from "zxing-wasm/reader";
import { classifyBarcodes, READER_OPTIONS, toFound, type LabelBarcodes } from "./barcodes";

let prepared = false;

/** Reads the barcodes of a label photo in the browser. The photo does not leave the device for this. */
export async function readLabelPhoto(file: Blob): Promise<LabelBarcodes> {
  if (!prepared) {
    // The app serves its own copy of the reader, so a scan does not depend on a CDN.
    prepareZXingModule({
      overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? "/zxing_reader.wasm" : prefix + path) },
    });
    prepared = true;
  }
  // Draw the photo first: this applies the rotation that the camera recorded and accepts
  // each image type that the browser can show. Small barcodes need the detail, so keep the photo large.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, 3200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const results = await readBarcodes(context.getImageData(0, 0, canvas.width, canvas.height), READER_OPTIONS);
  return classifyBarcodes(toFound(results));
}
