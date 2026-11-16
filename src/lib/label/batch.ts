// Rules for the result of one label photo. The single scan and the batch scan use them.
import type { LabelBarcodes } from "./barcodes";

/** The message to show after a photo read, or null when the read is complete. */
export function readMessage(codes: LabelBarcodes | null, lookupFailed: boolean): string | null {
  if (!codes) return "The photo could not be read on this device. Type the details.";
  if (!codes.upc && !codes.serial) return "No barcode was found in the photo. Take the photo again, closer and straight, or type the details.";
  if (!codes.serial) return "The serial number barcode was not found. Take the photo again, or type the serial number.";
  if (!codes.upc) return "The UPC barcode was not found. Take the photo again, or type the 12 digits below the barcode.";
  if (lookupFailed) return "The catalog was not checked. Check the connection. You can continue and type the details.";
  return null;
}

export type ScanStatus = "ready" | "needs_details" | "duplicate";

/**
 * Sorts one photo of a batch.
 * "ready": the batch can save the ball from the barcodes and the catalog alone.
 * "needs_details": a staff member must open the form and complete it.
 * "duplicate": the serial number is already recorded, or an earlier photo of the batch has it.
 */
export function scanStatus(input: {
  codes: LabelBarcodes | null;
  knownModel: boolean;
  existingBallId: string | null;
  lookupFailed: boolean;
  /** The serial numbers of the earlier photos in the batch. */
  serialsBefore: string[];
}): ScanStatus {
  const { codes } = input;
  if (codes?.serial && (input.existingBallId || input.serialsBefore.includes(codes.serial))) return "duplicate";
  if (!codes?.serial || !codes.upc || input.lookupFailed || !input.knownModel) return "needs_details";
  return "ready";
}
