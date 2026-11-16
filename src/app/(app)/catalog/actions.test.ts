import { beforeEach, describe, expect, it, vi } from "vitest";
const { owner, client, rpc } = vi.hoisted(() => {
  const rpc = vi.fn();
  return { owner: vi.fn(), rpc, client: vi.fn(async () => ({ rpc })) };
});
vi.mock("@/lib/auth", () => ({ requireOwner: owner, getLocations: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: client }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { commitImport, loadImportFile, previewImport } from "./actions";
import { signConfirmation } from "@/lib/catalog/confirmation";

describe("owner import actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
