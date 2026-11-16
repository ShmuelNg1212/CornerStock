import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { LABEL_FIELDS, type RawLabel } from "./rules";

const field = (description: string) => z.string().nullable().describe(description);

const LabelSchema = z.object({
  serial: field("The serial number: the letters and digits printed below the largest barcode, e.g. 23VSLE30B047."),
  upc: field("The 12 digits printed below the UPC barcode, digits only, no spaces."),
  brand: field("The maker, from a logo or a web address on the label (stormbowling.com is Storm)."),
  model_name: field("The ball model name, without a trademark symbol."),
  nominal_weight_lb: field("The nominal ball weight in whole pounds, digits only. This is the pounds part of the gross weight."),
  color: field("The text after 'Color:'."),
  fragrance: field("The text below or after 'Fragrance'."),
  coverstock: field("The text after 'Coverstock:', without a trademark symbol."),
  weight_block: field("The text after 'Weight Block:' or 'Core:', without a trademark symbol."),
  finish: field("The text after 'Ball Finish:' or 'Finish:'."),
  rg: field("The number after 'RG:'."),
  diff: field("The number after 'Diff:'."),
  mass_bias: field("The number after 'Mass Bias:' or 'MB:'."),
  product_code: field("The short product code printed below the last small barcode, e.g. BBMVSL15L."),
  gross_weight: field("The gross weight as printed, e.g. '15 LBS 4 OZ'."),
  top_weight: field("The number after 'Top:' or 'Top Weight:'."),
  pin_distance: field("The text after 'Pin:', e.g. '3-3.5'."),
  boxed_on: field("The date after 'Boxed on:', as printed."),
});

const INSTRUCTIONS = `This photo shows the label on a bowling ball box. Shop staff will add the ball to their stock from it.

Copy each field exactly as it is printed. Accuracy is more important than completeness: a wrong serial number or UPC puts a wrong record in the stock list. If a field is not on the label, or you cannot read each character with confidence (blur, glare, a fold, a cut-off edge), return null for that field. Do not make a best guess and do not fill a field from what you know about the product.

For the serial number and the UPC, read the printed characters below the barcodes one at a time. Take care with characters that look alike, such as 0 and O, 1 and I, 5 and S, 8 and B.`;

export type ExtractResult = { ok: true; fields: RawLabel } | { ok: false; error: string };

export type LabelImage = { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" };

/** Reads the fields of a ball box label from one photo. Fields that the model cannot read are null. */
export async function extractLabel(image: LabelImage): Promise<ExtractResult> {
  // The client reads ANTHROPIC_API_KEY from the server environment. The key never goes to the browser.
  const client = new Anthropic();
  try {
    const response = await client.messages.parse({
      model: process.env.LABEL_MODEL ?? "claude-opus-5-5",
      max_tokens: 4000,
      output_config: { effort: "low", format: zodOutputFormat(LabelSchema) },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
            { type: "text", text: INSTRUCTIONS },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return { ok: false, error: "The label could not be read. Take the photo again or type the details." };
    }
    const fields: RawLabel = {};
    for (const name of LABEL_FIELDS) fields[name] = response.parsed_output[name]?.trim() || null;
    return { ok: true, fields };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("Label extraction: the API key is not valid.");
      return { ok: false, error: "Label reading is not set up. Tell the owner. You can type the details." };
    }
    if (error instanceof Anthropic.RateLimitError) {
      return { ok: false, error: "Label reading is busy. Try again in a moment, or type the details." };
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`Label extraction failed: ${error.status} ${error.message}`);
      return { ok: false, error: "The label could not be read. Try again, or type the details." };
    }
    throw error;
  }
}
