"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getLocations, requireOwner } from "@/lib/auth";
import {
  signConfirmation,
  verifyConfirmation,
  type Confirmation,
} from "@/lib/catalog/confirmation";
import { mapSheet, readWorkbook } from "@/lib/catalog/files";
import {
  CATALOG_FIELDS,
  STOCK_FIELDS,
  type ColumnMapping,
  type ImportSheet,
} from "@/lib/catalog/fields";
import {
  buildReview,
  type ImportRow,
  type ImportReview,
} from "@/lib/catalog/review";
import { createClient } from "@/lib/supabase/server";
import type { Ball, BallModel } from "@/lib/types";

const inputSchema = z.object({
  kind: z.enum(["catalog", "stock"]),
  rows: z
    .array(
      z.object({
        row: z.number().int().min(2),
        // The review reports a too-long cell on its row. This bound only limits the request.
        values: z.record(z.string().max(60), z.string().max(65536)),
      }),
    )
    .min(1)
    .max(1000),
  defaultLocationId: z.string().max(80),
  reason: z.string().max(200),
});

function signingKey() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret)
    throw new Error(
      "Import review is unavailable. The server secret is not configured.",
    );
  return secret;
}
const SAVE_FAILED =
  "The import could not be saved. No changes were saved. Review the file and try again.";
function errorMessage(error: unknown): string {
  const message = String((error as { message?: string })?.message ?? "");
  const code = (error as { code?: string })?.code;
  if (/STALE|CONFLICT|DUPLICATE/i.test(message))
    return "A record changed since review. Review the file again. No changes were saved.";
  if (/REASON_REQUIRED/.test(message))
    return "Give a reason for corrections to existing stock.";
  if (/REQUEST|REPLAY|PAYLOAD/i.test(message))
    return "This import request changed. Review the file again.";
  if (/NOT_AUTHORIZED/.test(message) || code === "42501")
    return "Your account cannot do this.";
  // These mean that a record or location changed after the review.
  if (/INVALID_IMPORT|IMMUTABLE_IDENTITY|LOCATION_NOT_FOUND|WRONG_STATUS|BALL_NOT_FOUND|INVALID_LABEL/.test(message) || ["23505", "23514", "22P02"].includes(code ?? ""))
    return "A record or location changed since review. Review the file again. No changes were saved.";
  // A database or validation error never shows its raw text. Errors thrown here are written for the owner.
  if (code || error instanceof z.ZodError || !(error instanceof Error)) return SAVE_FAILED;
  return message || SAVE_FAILED;
}

export async function loadImportFile(form: FormData) {
  await requireOwner();
  try {
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > 5 * 1024 * 1024)
      throw new Error("Choose a CSV or .xlsx file up to 5 MB.");
    const workbook = await readWorkbook(
      new Uint8Array(await file.arrayBuffer()),
      file.name,
    );
    return { ok: true as const, workbook };
  } catch (error) {
    return { ok: false as const, error: errorMessage(error) };
  }
}

async function reviewInput(
  input: z.infer<typeof inputSchema>,
): Promise<ImportReview> {
  const client = await createClient();
  const upcs = [
    ...new Set(
      input.rows.map((row) => (row.values.upc ?? "").replace(/[\s-]/g, "")),
    ),
  ];
  const serials = [
    ...new Set(
      input.rows.map((row) =>
        (row.values.serial ?? "").replace(/\s/g, "").toUpperCase(),
      ),
    ),
  ];
  const models: BallModel[] = [];
  const balls: Ball[] = [];
  for (let start = 0; start < upcs.length; start += 100) {
    const { data, error } = await client
      .from("ball_models")
      .select("*")
      .in("upc", upcs.slice(start, start + 100));
    if (error) throw new Error("Catalog lookup failed. Try the review again.");
    models.push(...(data as BallModel[]));
  }
  if (input.kind === "stock") {
    for (let start = 0; start < serials.length; start += 100) {
      const { data, error } = await client
        .from("balls")
        .select("*")
        .in("serial", serials.slice(start, start + 100));
      if (error) throw new Error("Stock lookup failed. Try the review again.");
      balls.push(...(data as Ball[]));
    }
    // A mismatched UPC must be detected even if the old model is absent from the file.
    const missing = [...new Set(balls.map((ball) => ball.model_id))].filter(
      (id) => !models.some((model) => model.id === id),
    );
    for (let start = 0; start < missing.length; start += 100) {
      const { data, error } = await client
        .from("ball_models")
        .select("*")
        .in("id", missing.slice(start, start + 100));
      if (error) throw new Error("Stock lookup failed. Try the review again.");
      models.push(...(data as BallModel[]));
    }
  }
  const { locations } = await getLocations();
  return buildReview(
    input.kind,
    input.rows as ImportRow[],
    { models, balls, locations },
    { defaultLocationId: input.defaultLocationId, reason: input.reason },
  );
}

export async function previewImport(input: z.infer<typeof inputSchema>) {
  const owner = await requireOwner();
  try {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success)
      throw new Error(
        "Check the file rows and reason. A file can contain up to 1,000 rows.",
      );
    const review = await reviewInput(parsed.data);
    const confirmation = review.errors.length
      ? null
      : signConfirmation(review.payload, owner.id, signingKey());
    return { ok: true as const, review, confirmation };
  } catch (error) {
    return { ok: false as const, error: errorMessage(error) };
  }
}

export async function commitImport(confirmation: Confirmation) {
  const owner = await requireOwner();
  try {
    const payload = verifyConfirmation(confirmation, owner.id, signingKey());
    const client = await createClient();
    const { data, error } = await client.rpc("commit_catalog_import", {
      p_request_id: confirmation.requestId,
      p_payload: payload,
    });
    if (error) throw error;
    revalidatePath("/", "layout");
    return { ok: true as const, result: data as ImportReview["summary"] };
  } catch (error) {
    return { ok: false as const, error: errorMessage(error) };
  }
}

export async function createCatalogModel(
  values: Record<string, string>,
  requestId: string,
) {
  await requireOwner();
  try {
    if (!z.uuid().safeParse(requestId).success)
      throw new Error("Open the model form again.");
    const parsed = inputSchema.parse({
      kind: "catalog",
      rows: [{ row: 2, values }],
      defaultLocationId: "",
      reason: "",
    });
    const client = await createClient();
    const upc = (values.upc ?? "").replace(/[\s-]/g, "");
    const { data: existing, error: lookupError } = await client
      .from("ball_models")
      .select("*")
      .eq("upc", upc)
      .maybeSingle();
    if (lookupError) throw new Error("Catalog lookup failed. Try again.");
    if (existing)
      return {
        ok: false as const,
        error: "Check the marked fields.",
        fieldErrors: {
          upc: "This UPC is already in the catalog. Open that entry to edit it.",
        },
      };
    const review = buildReview(
      "catalog",
      parsed.rows,
      { models: [], balls: [], locations: [] },
      { defaultLocationId: "", reason: "" },
    );
    if (review.errors.length)
      return {
        ok: false as const,
        error: "Check the marked fields.",
        fieldErrors: Object.fromEntries(
          review.errors.map((error) => [error.field, error.message]),
        ),
      };
    const { error } = await client.rpc("commit_catalog_import", {
      p_request_id: requestId,
      p_payload: review.payload,
    });
    if (error) throw error;
    revalidatePath("/", "layout");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: errorMessage(error) };
  }
}

const sheetSchema = z.object({
  name: z.string().max(200),
  headers: z.array(z.string().max(5000)).min(1).max(64),
  rows: z
    .array(
      z.object({
        row: z.number().int().min(2).max(100000),
        cells: z
          .array(
            z.object({
              text: z.string().max(65536),
              formula: z.boolean().optional(),
              numeric: z.boolean().optional(),
              csv: z.boolean().optional(),
            }),
          )
          .max(64),
      }),
    )
    .min(1)
    .max(1000),
});

export async function previewImportSheet(input: {
  kind: "catalog" | "stock";
  sheet: ImportSheet;
  mapping: ColumnMapping;
  defaultLocationId: string;
  reason: string;
}) {
  await requireOwner();
  try {
    const parsed = z
      .object({
        kind: z.enum(["catalog", "stock"]),
        sheet: sheetSchema,
        mapping: z.record(
          z.string().max(60),
          z.number().int().min(0).max(63).optional(),
        ),
        defaultLocationId: z.string().max(80),
        reason: z.string().max(200),
      })
      .safeParse(input);
    if (!parsed.success)
      throw new Error(
        "Check the worksheet. Import 1 to 1,000 rows with at most 64 columns.",
      );
    const fields = parsed.data.kind === "stock" ? STOCK_FIELDS : CATALOG_FIELDS;
    const mapping = Object.fromEntries(
      Object.entries(parsed.data.mapping).filter(
        ([, index]) => index !== undefined,
      ),
    ) as ColumnMapping;
    if (
      Object.keys(mapping).some(
        (field) => !(fields as readonly string[]).includes(field),
      )
    )
      throw new Error("Only map fields for the selected import type.");
    const mapped = mapSheet(parsed.data.sheet, mapping);
    if (mapped.errors.length) {
      return {
        ok: true as const,
        review: {
          payload: {
            kind: input.kind,
            reason: input.reason,
            models: [],
            balls: [],
          },
          summary: {
            models_added: 0,
            models_updated: 0,
            balls_added: 0,
            balls_updated: 0,
            unchanged: 0,
          },
          changes: [],
          errors: mapped.errors,
        } as ImportReview,
        confirmation: null,
      };
    }
    return previewImport({
      kind: input.kind,
      rows: mapped.rows,
      defaultLocationId: input.defaultLocationId,
      reason: input.reason,
    });
  } catch (error) {
    return { ok: false as const, error: errorMessage(error) };
  }
}
