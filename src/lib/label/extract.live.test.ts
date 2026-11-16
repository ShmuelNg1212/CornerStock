import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractLabel } from "./extract";
import { validateLabel } from "./rules";

// This test calls the vision model and costs a small amount. It runs only when a key is set:
//   ANTHROPIC_API_KEY=... npm run test:unit
describe.skipIf(!process.env.ANTHROPIC_API_KEY)("extractLabel, with the real model", () => {
  it("reads the sample label", async () => {
    const photo = readFileSync(path.resolve("doc/study/assets/ball-box-label-sample.jpg"));
    const result = await extractLabel({ data: photo.toString("base64"), mediaType: "image/jpeg" });
    if (!result.ok) throw new Error(result.error);

    const { value, errors } = validateLabel(result.fields);
    expect(errors).toEqual({});
    expect(value).toMatchObject({
      serial: "23VSLE30B047",
      upc: "887970617601",
      model_name: "Solid Lock",
      nominal_weight_lb: 15,
      color: "Dark Red",
      fragrance: "Red Hot Cinnamon",
      rg: 2.48,
      diff: 0.054,
      mass_bias: 0.018,
      gross_weight_oz: 244,
      top_weight: 3.28,
      pin_min: 3,
      pin_max: 3.5,
      boxed_on: "2023-05-30",
    });
    expect(value?.coverstock).toMatch(/NeX Solid Reactive/i);
    expect(value?.weight_block).toMatch(/RAD-X/i);
    expect(value?.finish).toMatch(/1500-grit Polished/i);
  }, 60_000);
});
