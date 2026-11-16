// Reads one camera frame: the barcodes and the frame checks. The viewfinder worker runs it.
import { readBarcodes } from "zxing-wasm/reader";
import { classifyBarcodes, READER_OPTIONS, toFound, type LabelBarcodes } from "./barcodes";
import { frameScores, type FrameImage, type FrameScores } from "./frame-quality";

export type { FrameImage };
export type FrameAnalysis = FrameScores & { codes: LabelBarcodes };

export async function analyzeFrame(image: FrameImage): Promise<FrameAnalysis> {
  // The reader takes any object with the fields of ImageData. Node has no ImageData class.
  const results = await readBarcodes(image as ImageData, READER_OPTIONS);
  return { codes: classifyBarcodes(toFound(results)), ...frameScores(image) };
}
