import type { ScanStatus } from "@/lib/label/batch";
import { LABEL_FIELDS, type LabelField, type RawLabel } from "@/lib/label/rules";

export type Step = "start" | "reading" | "confirm" | "batch";

/** The last ball that a single scan saved. */
export type Saved = { ballId: string; summary: string; location: string; photoKept: boolean; preview: string | null };

/** One photo of a batch scan. */
export type BatchItem = {
  /** Also the request id of the save, so a retry adds the ball one time only. */
  id: string;
  preview: string | null;
  photo: Blob | null;
  fields: RawLabel;
  known: boolean;
  unread: LabelField[];
  existingBallId: string | null;
  message: string | null;
  status: "reading" | ScanStatus | "saving" | "saved";
  ballId?: string;
  savedTo?: string;
  photoKept?: boolean;
};

export const EMPTY: RawLabel = Object.fromEntries(LABEL_FIELDS.map((f) => [f, ""]));

export type FieldSpec = { field: LabelField; label: string; hint?: string; mode?: "decimal" | "numeric"; mono?: boolean };

export const SERIAL_FIELD: FieldSpec = { field: "serial", label: "Serial number", mono: true };
/** The values that the label shows as text only. Staff type them. */
export const VALUE_FIELDS: FieldSpec[] = [
  { field: "gross_weight", label: "Gross weight", hint: "15 lb 4 oz" },
  { field: "top_weight", label: "Top weight", mode: "decimal" },
  { field: "pin_distance", label: "Pin distance", hint: "3-3.5" },
  { field: "boxed_on", label: "Boxed on", hint: "month/day/year" },
];
export const MODEL_FIELDS: FieldSpec[] = [
  { field: "upc", label: "UPC", hint: "12 digits", mode: "numeric", mono: true },
  { field: "model_name", label: "Model" },
  { field: "nominal_weight_lb", label: "Ball weight (lb)", mode: "numeric" },
  { field: "brand", label: "Brand" },
  { field: "color", label: "Color" },
  { field: "fragrance", label: "Fragrance" },
  { field: "coverstock", label: "Coverstock" },
  { field: "weight_block", label: "Weight block" },
  { field: "finish", label: "Finish" },
  { field: "rg", label: "RG", mode: "decimal" },
  { field: "diff", label: "Diff", mode: "decimal" },
  { field: "mass_bias", label: "Mass bias", mode: "decimal" },
  { field: "product_code", label: "Product code", mono: true },
];
