import { NextResponse } from "next/server";
import { extractLabel, type LabelImage } from "@/lib/label/extract";
import { normalizeSerial, validateUpc, type RawLabel } from "@/lib/label/rules";
import { createClient } from "@/lib/supabase/server";
import type { BallModel } from "@/lib/types";

export const maxDuration = 60;

const MAX_BYTES = 6 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type ExtractResponse = {
  fields: RawLabel;
  /** True when the UPC is already in the catalog. The model fields then come from the catalog. */
  knownModel: boolean;
  /** Set when a ball with this serial number is already recorded. */
  existingBallId: string | null;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("current_staff_role");
  if (!role) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const photo = form?.get("photo");
  if (!(photo instanceof File)) return NextResponse.json({ error: "No photo was sent." }, { status: 400 });
  if (!TYPES.includes(photo.type as LabelImage["mediaType"])) {
    return NextResponse.json({ error: "Send a JPEG, PNG, or WebP photo." }, { status: 415 });
  }
  if (photo.size > MAX_BYTES) return NextResponse.json({ error: "The photo is too large." }, { status: 413 });

  const result = await extractLabel({
    data: Buffer.from(await photo.arrayBuffer()).toString("base64"),
    mediaType: photo.type as LabelImage["mediaType"],
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });

  const fields = result.fields;
  let knownModel = false;
  let existingBallId: string | null = null;

  const upc = fields.upc ? validateUpc(fields.upc) : null;
  if (upc?.ok) {
    const { data: model } = await supabase.from("ball_models").select("*").eq("upc", upc.value).maybeSingle<BallModel>();
    if (model) {
      knownModel = true;
      const text = (value: string | number | null) => (value === null ? null : String(value));
      Object.assign(fields, {
        brand: model.brand,
        model_name: model.name,
        nominal_weight_lb: String(model.nominal_weight_lb),
        color: model.color,
        fragrance: model.fragrance,
        coverstock: model.coverstock,
        weight_block: model.weight_block,
        finish: model.finish,
        rg: text(model.rg),
        diff: text(model.diff),
        mass_bias: text(model.mass_bias),
        product_code: model.product_code,
      } satisfies RawLabel);
    }
  }

  const serial = fields.serial ? normalizeSerial(fields.serial) : null;
  if (serial?.ok) {
    const { data: ball } = await supabase.from("balls").select("id").eq("serial", serial.value).maybeSingle<{ id: string }>();
    existingBallId = ball?.id ?? null;
  }

  return NextResponse.json({ fields, knownModel, existingBallId } satisfies ExtractResponse);
}
