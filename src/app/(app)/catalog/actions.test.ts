import { beforeEach, describe, expect, it, vi } from "vitest";
const { owner, client, rpc, rows } = vi.hoisted(() => {
  const rpc = vi.fn();
  const rows = { data: [] as unknown[] };
  const query = {
    select: () => query,
    in: async () => ({ data: rows.data, error: null }),
    eq: () => query,
    maybeSingle: async () => ({ data: rows.data[0] ?? null, error: null }),
  };
  return { owner: vi.fn(), rpc, rows, client: vi.fn(async () => ({ rpc, from: () => query })) };
});
vi.mock("@/lib/auth", () => ({ requireOwner: owner, getLocations: vi.fn(async () => ({ locations: [], selected: "all" })) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: client }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { commitImport, createCatalogModel, loadImportFile, previewImport } from "./actions";
import { signConfirmation } from "@/lib/catalog/confirmation";

describe("owner import actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rows.data = [];
    process.env.SUPABASE_SECRET_KEY = "test-signing-secret";
  });
  it("refuses direct file, preview and commit calls before owner authorization", async () => {
    owner.mockRejectedValue(new Error("owner required"));
    await expect(loadImportFile(new FormData())).rejects.toThrow(
      "owner required",
    );
    await expect(
      previewImport({
        kind: "catalog",
        rows: [],
        defaultLocationId: "",
        reason: "",
      }),
    ).rejects.toThrow("owner required");
    const confirmation = signConfirmation(
      { kind: "catalog", models: [], balls: [], reason: "" },
      "owner",
      "test-signing-secret",
    );
    await expect(commitImport(confirmation)).rejects.toThrow("owner required");
    expect(client).not.toHaveBeenCalled();
  });
  it("does not submit a browser-modified review to the database", async () => {
    owner.mockResolvedValue({ id: "owner" });
    const confirmation = signConfirmation(
      { kind: "catalog", models: [], balls: [], reason: "" },
      "owner",
      "test-signing-secret",
    );
    confirmation.payload.reason = "changed after review";
    const result = await commitImport(confirmation);
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/review.*again/i),
    });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("reuses the reviewed request on a retry and reports a stale database review", async () => {
    owner.mockResolvedValue({ id: "owner" });
    const confirmation = signConfirmation(
      { kind: "catalog", models: [], balls: [], reason: "" },
      "owner",
      "test-signing-secret",
    );
    rpc.mockResolvedValue({ data: null, error: { message: "STALE_REVIEW" } });
    const result = await commitImport(confirmation);
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/record changed/i),
    });
    expect(rpc).toHaveBeenCalledWith("commit_catalog_import", {
      p_request_id: confirmation.requestId,
      p_payload: confirmation.payload,
    });
  });
  it.each([
    [{ message: "LOCATION_NOT_FOUND", code: "P0001" }, /review the file again/i],
    [{ message: "IMMUTABLE_IDENTITY", code: "P0001" }, /review the file again/i],
    [{ message: "NOT_AUTHORIZED", code: "42501" }, /cannot do this/i],
    [{ message: "some internal failure", code: "XX000" }, /could not be saved/i],
  ])("maps database error %j to a message without the raw code", async (error, expected) => {
    owner.mockResolvedValue({ id: "owner" });
    const confirmation = signConfirmation({ kind: "catalog", models: [], balls: [], reason: "" }, "owner", "test-signing-secret");
    rpc.mockResolvedValue({ data: null, error });
    const result = await commitImport(confirmation);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(expected);
      expect(result.error).not.toContain(error.message);
    }
  });
  it("names an existing UPC on Add model instead of reporting a stale review", async () => {
    owner.mockResolvedValue({ id: "owner" });
    rows.data = [{ id: "model-a", upc: "012345678905", name: "Summit", nominal_weight_lb: 15, brand: null, color: null, fragrance: null, coverstock: null, weight_block: null, finish: null, rg: null, diff: null, mass_bias: null, product_code: null, selling_price: null }];
    const result = await createCatalogModel({ upc: "012345678905", model_name: "Summit", nominal_weight_lb: "15" }, crypto.randomUUID());
    expect(result).toMatchObject({ ok: false, fieldErrors: { upc: expect.stringMatching(/already in the catalog/i) } });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("reports an over-long mapped cell on its row instead of failing the whole preview", async () => {
    owner.mockResolvedValue({ id: "owner" });
    const result = await previewImport({ kind: "catalog", rows: [{ row: 412, values: { upc: "012345678905", model_name: "x".repeat(250), nominal_weight_lb: "15" } }], defaultLocationId: "", reason: "" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.review.errors).toContainEqual(expect.objectContaining({ row: 412, field: "model_name" }));
  });
});
