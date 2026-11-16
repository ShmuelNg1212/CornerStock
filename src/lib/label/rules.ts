// Rules for the fields on a ball box label.
// Each parser takes the text as printed and returns a value or an error for that field.

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T,>(value: T): Parsed<T> => ({ ok: true, value });
const fail = (error: string): Parsed<never> => ({ ok: false, error });

/** The text fields that come from a label photo or from the confirm form. */
export const LABEL_FIELDS = [
  "serial",
  "upc",
  "brand",
  "model_name",
  "nominal_weight_lb",
  "color",
  "fragrance",
  "coverstock",
  "weight_block",
  "finish",
  "rg",
  "diff",
  "mass_bias",
  "product_code",
  "gross_weight",
  "top_weight",
  "pin_distance",
  "boxed_on",
] as const;

export type LabelField = (typeof LABEL_FIELDS)[number];
export type RawLabel = Partial<Record<LabelField, string | null>>;

/** A label after validation, in the form that the database function accepts. */
export type BallLabel = {
  serial: string;
  upc: string;
  brand: string | null;
  model_name: string;
  nominal_weight_lb: number;
  color: string | null;
  fragrance: string | null;
  coverstock: string | null;
  weight_block: string | null;
  finish: string | null;
  rg: number | null;
  diff: number | null;
  mass_bias: number | null;
  product_code: string | null;
  gross_weight_oz: number | null;
  top_weight: number | null;
  pin_min: number | null;
  pin_max: number | null;
  boxed_on: string | null;
};

export function validateUpc(text: string): Parsed<string> {
  const digits = text.replace(/[\s-]/g, "");
  if (!/^\d{12}$/.test(digits)) return fail("A UPC has 12 digits.");
  let sum = 0;
  for (let i = 0; i < 11; i++) sum += Number(digits[i]) * (i % 2 === 0 ? 3 : 1);
  const check = (10 - (sum % 10)) % 10;
  if (check !== Number(digits[11])) return fail("The UPC check digit is wrong. Check each digit.");
  return ok(digits);
}

export function normalizeSerial(text: string): Parsed<string> {
  const serial = text.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z0-9-]{6,30}$/.test(serial)) {
    return fail("A serial number has 6 to 30 letters and digits.");
  }
  return ok(serial);
}

/** Parses "15 LBS 4 OZ" to total ounces. */
export function parseGrossWeight(text: string): Parsed<number> {
  const match = text.trim().match(/^(\d{1,2})\s*(?:lbs?|pounds?)\.?\s*(?:(\d{1,2})\s*(?:oz|ounces?)\.?)?$/i);
  if (!match) return fail('Write the weight as "15 lb 4 oz".');
  const pounds = Number(match[1]);
  const ounces = match[2] === undefined ? 0 : Number(match[2]);
  if (ounces > 15) return fail("Ounces must be 0 to 15.");
  if (pounds < 5 || pounds > 17) return fail("A ball weighs 5 to 17 lb.");
  return ok(pounds * 16 + ounces);
}

export function formatGrossWeight(totalOunces: number): string {
  return `${Math.floor(totalOunces / 16)} lb ${totalOunces % 16} oz`;
}

/** Parses "3-3.5" to a range in inches. One value gives an equal range. */
export function parsePinDistance(text: string): Parsed<{ min: number; max: number }> {
  const match = text.trim().match(/^(\d*\.?\d+)(?:\s*(?:-|–|to)\s*(\d*\.?\d+))?$/i);
  if (!match) return fail('Write the pin distance as "3-3.5".');
  const min = Number(match[1]);
  const max = match[2] === undefined ? min : Number(match[2]);
  if (min > max) return fail("The first value must be the smaller one.");
  if (max > 8) return fail("A pin distance is 0 to 8 inches.");
  return ok({ min, max });
}

export function parseDecimal(text: string, min: number, max: number): Parsed<number> {
  const trimmed = text.trim();
  if (!/^\d*\.?\d+$/.test(trimmed)) return fail("Write a number.");
  const value = Number(trimmed);
  if (value < min || value > max) return fail(`The value must be ${min} to ${max}.`);
  return ok(value);
}

/** Parses "5/30/2023" (month/day/year, as US makers print it) or an ISO date. */
export function parseBoxedDate(text: string): Parsed<string> {
  const trimmed = text.trim();
  let year: number, month: number, day: number;
  const us = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (us) [month, day, year] = [Number(us[1]), Number(us[2]), Number(us[3])];
  else if (iso) [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else return fail('Write the date as month/day/year, for example "5/30/2023".');
  const date = new Date(Date.UTC(year, month - 1, day));
  const real = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!real || year < 1990) return fail("This date does not exist. The label order is month/day/year.");
  return ok(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
}

function parseNominalWeight(text: string): Parsed<number> {
  const match = text.trim().match(/^(\d{1,2})(?:\s*(?:lbs?|pounds?))?$/i);
  const pounds = match ? Number(match[1]) : NaN;
  if (!(pounds >= 6 && pounds <= 16)) return fail("A ball weight is 6 to 16 lb.");
  return ok(pounds);
}

export type LabelErrors = Partial<Record<LabelField, string>>;

/** Validates all the fields. `value` is null when one or more fields have an error. */
export function validateLabel(raw: RawLabel): { value: BallLabel | null; errors: LabelErrors } {
  const errors: LabelErrors = {};
  const text = (field: LabelField) => (raw[field] ?? "").trim();

  function required<T>(field: LabelField, parse: (t: string) => Parsed<T>): T | null {
    if (text(field) === "") {
      errors[field] = "This field is necessary.";
      return null;
    }
    return optional(field, parse);
  }
  function optional<T>(field: LabelField, parse: (t: string) => Parsed<T>): T | null {
    if (text(field) === "") return null;
    const result = parse(text(field));
    if (result.ok) return result.value;
    errors[field] = result.error;
    return null;
  }
  const plain = (t: string): Parsed<string> => (t.length <= 120 ? ok(t) : fail("This text is too long."));

  const pin = optional("pin_distance", parsePinDistance);
  const value = {
    serial: required("serial", normalizeSerial),
    upc: required("upc", validateUpc),
    brand: optional("brand", plain),
    model_name: required("model_name", plain),
    nominal_weight_lb: required("nominal_weight_lb", parseNominalWeight),
    color: optional("color", plain),
    fragrance: optional("fragrance", plain),
    coverstock: optional("coverstock", plain),
    weight_block: optional("weight_block", plain),
    finish: optional("finish", plain),
    rg: optional("rg", (t) => parseDecimal(t, 2, 3)),
    diff: optional("diff", (t) => parseDecimal(t, 0, 0.1)),
    mass_bias: optional("mass_bias", (t) => parseDecimal(t, 0, 0.1)),
    product_code: optional("product_code", plain),
    gross_weight_oz: optional("gross_weight", parseGrossWeight),
    top_weight: optional("top_weight", (t) => parseDecimal(t, 0, 10)),
    pin_min: pin?.min ?? null,
    pin_max: pin?.max ?? null,
    boxed_on: optional("boxed_on", parseBoxedDate),
  };

  if (Object.keys(errors).length > 0) return { value: null, errors };
  return { value: value as BallLabel, errors };
}

/** The model fields that the owner can change after the first save. UPC and weight identify the model and stay fixed. */
export const MODEL_DETAIL_FIELDS = [
  "brand",
  "model_name",
  "color",
  "fragrance",
  "coverstock",
  "weight_block",
  "finish",
  "rg",
  "diff",
  "mass_bias",
  "product_code",
] as const satisfies readonly LabelField[];

export type ModelDetailField = (typeof MODEL_DETAIL_FIELDS)[number];
export type RawModelDetails = Partial<Record<ModelDetailField, string | null>>;
export type ModelDetailErrors = Partial<Record<ModelDetailField, string>>;

/** The model details in the form of the ball_models columns. */
export type ModelDetails = {
  brand: string | null;
  name: string;
  color: string | null;
  fragrance: string | null;
  coverstock: string | null;
  weight_block: string | null;
  finish: string | null;
  rg: number | null;
  diff: number | null;
  mass_bias: number | null;
  product_code: string | null;
};

/** Validates the model details with the same rules as a label. `value` is null when a field has an error. */
export function validateModelDetails(raw: RawModelDetails): { value: ModelDetails | null; errors: ModelDetailErrors } {
  // Fill the ball fields with valid values so that only the model fields can fail.
  const { value, errors } = validateLabel({
    ...raw,
    serial: "PLACEHOLDER",
    upc: "887970617601",
    nominal_weight_lb: "15",
    gross_weight: "",
    top_weight: "",
    pin_distance: "",
    boxed_on: "",
  });
  if (!value) return { value: null, errors: errors as ModelDetailErrors };
  return {
    value: {
      brand: value.brand,
      name: value.model_name,
      color: value.color,
      fragrance: value.fragrance,
      coverstock: value.coverstock,
      weight_block: value.weight_block,
      finish: value.finish,
      rg: value.rg,
      diff: value.diff,
      mass_bias: value.mass_bias,
      product_code: value.product_code,
    },
    errors: {},
  };
}
