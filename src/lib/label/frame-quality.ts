// Checks of one camera frame, and the rules that turn a run of frames into a capture or a hint.
// The live viewfinder and the tests use them. No function here touches the camera or the page.
import { NO_CODES, type LabelBarcodes } from "./barcodes";

/**
 * All limits of the frame checks. The values come from the 10 label photos of the human
 * (doc/plan/1794837817_live_viewfinder.md). Change them here only.
 */
export const FRAME_LIMITS = {
  /** The frame is measured on a grid with this many cells on the long side. */
  gridLongSide: 320,
  /** A sharpness below this is a soft frame. Real photos give 2155 or more; a blur of sigma 4 gives 455 to 1015. */
  softBelow: 800,
  /** A pixel with all three channels at this value or more is blown out. */
  blownChannel: 250,
  /** A connected blown-out patch of this share of the frame or more is glare. The photos give 0.0001 or less. */
  glareBlobShare: 0.005,
  /**
   * A bar unit narrower than this (pixels, serial size) means the label is too far.
   * The serial reads at 1.77 px and fails at about 1.5 px. The glare photos give 2.08 px or more.
   */
  farBelow: 1.8,
  /** The capture combines the reads of the frames in this window. */
  captureWindowMs: 1500,
  /** A hint shows only when its cause lasts this long. */
  hintHoldMs: 800,
  /** The window of frames that a hint looks at. */
  hintWindowMs: 1000,
  /** With no barcode for this long, the hint asks to line up the phone with the label. */
  alignAfterMs: 4000,
  /** Frames older than this are dropped from the history. */
  historyMs: 5000,
} as const;

export type FrameScores = { sharpness: number; glareShare: number };
type FrameCodes = { codes: LabelBarcodes; moduleSize: number | null };
export type FrameRead = FrameScores & FrameCodes & { at: number };
export type FrameHint = "aim" | "hold" | "glare" | "far" | "soft" | "align" | "added";
export type FrameImage = { data: Uint8ClampedArray; width: number; height: number };

/**
 * Sharpness: the variance of the Laplacian of the brightness, on a grid of cells.
 * Glare share: the largest connected patch of blown-out cells, as a share of all cells.
 */
export function frameScores({ data, width, height }: FrameImage): FrameScores {
  const cell = Math.max(1, Math.round(Math.max(width, height) / FRAME_LIMITS.gridLongSide));
  const gw = Math.floor(width / cell);
  const gh = Math.floor(height / cell);
  const gray = new Float32Array(gw * gh);
  const blown = new Uint8Array(gw * gh);

  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      let sum = 0;
      let white = 0;
      for (let y = gy * cell; y < (gy + 1) * cell; y++) {
        for (let x = gx * cell, i = (y * width + x) * 4; x < (gx + 1) * cell; x++, i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          sum += 0.299 * r + 0.587 * g + 0.114 * b;
          if (r >= FRAME_LIMITS.blownChannel && g >= FRAME_LIMITS.blownChannel && b >= FRAME_LIMITS.blownChannel) white++;
        }
      }
      const n = cell * cell;
      gray[gy * gw + gx] = sum / n;
      blown[gy * gw + gx] = white * 2 >= n ? 1 : 0;
    }
  }

  let total = 0;
  let squares = 0;
  let count = 0;
  for (let y = 1; y < gh - 1; y++) {
    for (let x = 1, i = y * gw + 1; x < gw - 1; x++, i++) {
      const laplacian = gray[i - 1] + gray[i + 1] + gray[i - gw] + gray[i + gw] - 4 * gray[i];
      total += laplacian;
      squares += laplacian * laplacian;
      count++;
    }
  }
  const sharpness = count ? squares / count - (total / count) ** 2 : 0;

  // The largest patch of blown-out cells that touch at a side.
  const seen = new Uint8Array(gw * gh);
  const stack: number[] = [];
  let largest = 0;
  for (let start = 0; start < gw * gh; start++) {
    if (!blown[start] || seen[start]) continue;
    let size = 0;
    seen[start] = 1;
    stack.push(start);
    while (stack.length) {
      const k = stack.pop()!;
      size++;
      const x = k % gw;
      const neighbours = [x > 0 ? k - 1 : -1, x < gw - 1 ? k + 1 : -1, k - gw, k + gw];
      for (const j of neighbours) {
        if (j >= 0 && j < gw * gh && blown[j] && !seen[j]) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    largest = Math.max(largest, size);
  }

  return { sharpness, glareShare: gw * gh ? largest / (gw * gh) : 0 };
}

const found = (codes: LabelBarcodes) => [codes.upc, codes.serial, codes.product_code].filter(Boolean).length;
const complete = (codes: LabelBarcodes) => Boolean(codes.upc && codes.serial);

/**
 * Glare on the label. Two signs count:
 * - a large blown-out patch;
 * - a sharp frame where a barcode reads but the UPC or the serial does not, and the bars
 *   are large enough to read. On the label photos, glossy ink that reflects the light makes
 *   the bars silver. The bars do not go white, so the patch check does not see it. The
 *   neighbour barcode reads, which shows that the frame is sharp and the label is in view.
 */
export function frameHasGlare(frame: FrameScores & FrameCodes): boolean {
  if (frame.glareShare >= FRAME_LIMITS.glareBlobShare) return true;
  return partial(frame) && frame.sharpness >= FRAME_LIMITS.softBelow && !tooFar(frame);
}

const partial = (frame: FrameCodes) => found(frame.codes) > 0 && !complete(frame.codes);
const tooFar = (frame: FrameCodes) => frame.moduleSize !== null && frame.moduleSize < FRAME_LIMITS.farBelow;

/**
 * The codes to capture from the frames of the capture window, or null.
 * - The latest frame reads the serial, so the captured photo shows the label.
 * - One frame reads the UPC and the serial together. This pairs them on one label: a UPC from
 *   one box never joins a serial from the next box.
 * - One more frame reads the same serial. The serial is the thinnest barcode, so it can read
 *   alone; the UPC does not need to read again.
 * - No frame of the window reads a different serial or UPC. The phone is then on one label.
 * A barcode reads exactly or fails, so reads from nearby frames can be combined.
 * No sharpness limit applies: when the barcodes read, the frame is sharp enough.
 */
function captureCodes(history: FrameRead[], now: number): LabelBarcodes | null {
  const window = history.filter((f) => f.at >= now - FRAME_LIMITS.captureWindowMs);
  const serial = window.at(-1)?.codes.serial;
  if (!serial) return null;
  if (window.some((f) => f.codes.serial !== null && f.codes.serial !== serial)) return null;
  const paired = window.findLast((f) => f.codes.serial === serial && f.codes.upc !== null);
  if (!paired) return null;
  const upc = paired.codes.upc;
  if (window.some((f) => f.codes.upc !== null && f.codes.upc !== upc)) return null;
  const sameSerial = window.filter((f) => f.codes.serial === serial);
  if (sameSerial.length < 2) return null;
  const productCode = sameSerial.findLast((f) => f.codes.product_code !== null)?.codes.product_code ?? null;
  return { upc, serial, product_code: productCode };
}

/**
 * Decides on the latest frame. `history` is in time order and ends with the latest frame.
 * On a capture, `codes` are the combined codes of the capture window. Otherwise they are the codes of the latest frame.
 */
export function decideFrame(
  history: FrameRead[],
  now: number,
  skipSerials: readonly string[] = [],
): { capture: boolean; hint: FrameHint; codes: LabelBarcodes } {
  const last = history.at(-1);
  if (!last) return { capture: false, hint: "aim", codes: NO_CODES };
  const wait = (hint: FrameHint) => ({ capture: false, hint, codes: last.codes });

  if (last.codes.serial && skipSerials.includes(last.codes.serial)) return wait("added");
  const codes = captureCodes(history, now);
  if (codes) return { capture: true, hint: "hold", codes };
  if (complete(last.codes)) return wait("hold");

  // A cause counts only when every frame of the last window has it, and the window is long enough.
  const window = history.filter((f) => f.at >= now - FRAME_LIMITS.hintWindowMs);
  const lasts = (test: (f: FrameRead) => boolean) =>
    window.length > 0 && window[0].at <= now - FRAME_LIMITS.hintHoldMs && window.every(test);

  // Distance first: small bars do not read, with or without glare, and a closer label also moves out of a reflection.
  if (lasts((f) => partial(f) && tooFar(f))) return wait("far");
  if (lasts(frameHasGlare)) return wait("glare");
  if (lasts((f) => found(f.codes) === 0 && f.sharpness < FRAME_LIMITS.softBelow)) return wait("soft");

  const lastCode = history.findLast((f) => found(f.codes) > 0);
  const since = lastCode ? lastCode.at : history[0].at;
  if (now - since >= FRAME_LIMITS.alignAfterMs) return wait("align");

  return wait(found(last.codes) > 0 ? "hold" : "aim");
}

/** Drops the frames that no rule looks at any more. */
export function trimHistory(history: FrameRead[], now: number): FrameRead[] {
  return history.filter((f) => f.at >= now - FRAME_LIMITS.historyMs);
}
