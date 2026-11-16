// Small rules of the live camera. The viewfinder hook uses them.

export type CameraProblem = "denied" | "failed";

/** A refused permission needs a different message than a missing or busy camera. */
export function cameraProblem(error: unknown): CameraProblem {
  const name = error instanceof DOMException || error instanceof Error ? error.name : "";
  return name === "NotAllowedError" || name === "SecurityError" ? "denied" : "failed";
}

/** The frame size for the reader. A 1920 px frame reads the same codes as a full photo; a 1280 px frame does not. */
export const FRAME_LONG_SIDE = 1920;

export function frameSize(width: number, height: number) {
  const scale = Math.min(1, FRAME_LONG_SIDE / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Asks for the rear camera at a size that keeps small barcodes readable. */
export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
};
