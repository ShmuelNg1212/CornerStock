// Small rules of the live camera. The viewfinder hook uses them.

export type CameraProblem = "denied" | "failed";

/** A refused permission needs a different message than a missing or busy camera. */
export function cameraProblem(error: unknown): CameraProblem {
  const name = error instanceof DOMException || error instanceof Error ? error.name : "";
  return name === "NotAllowedError" || name === "SecurityError" ? "denied" : "failed";
}

/**
 * The frame size for the reader. The serial barcode is the thinnest code on the label. At the
 * normal distance it reads in a 1440 px wide portrait frame, not in a 1080 px wide one.
 */
export const FRAME_LONG_SIDE = 2560;

export function frameSize(width: number, height: number) {
  const scale = Math.min(1, FRAME_LONG_SIDE / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Asks for the rear camera at 1440p, so the serial barcode reads at a normal distance. A phone
 * that cannot give it gives a smaller stream. The stream is not stored: the label photo is shrunk before the upload.
 */
export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: { ideal: "environment" }, width: { ideal: 2560 }, height: { ideal: 1440 } },
};
