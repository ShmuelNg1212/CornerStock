import { describe, expect, it, vi } from "vitest";
const { range, createClient } = vi.hoisted(() => {
  const range = vi.fn();
  return {
    range,
    createClient: vi.fn(async () => ({
      from: () => ({ select: () => ({ order: () => ({ range }) }) }),
    })),
  };
});
vi.mock("@/lib/supabase/server", () => ({ createClient }));
import { readCatalog } from "./queries";

describe("complete catalog reads", () => {
  it("reads beyond the default API page without truncating exports", async () => {
    range
      .mockResolvedValueOnce({
        data: Array.from({ length: 500 }, (_, id) => ({ id: `a${id}` })),
        error: null,
      })
      .mockResolvedValueOnce({
        data: Array.from({ length: 500 }, (_, id) => ({ id: `b${id}` })),
        error: null,
      })
      .mockResolvedValueOnce({ data: [{ id: "last-model" }], error: null });
    const rows = await readCatalog();
    expect(rows).toHaveLength(1001);
    expect(rows.at(-1)?.id).toBe("last-model");
    expect(range).toHaveBeenLastCalledWith(1000, 1499);
  });
  it("does not return a partial catalog after a failed page", async () => {
    range.mockResolvedValueOnce({ data: null, error: { message: "offline" } });
    await expect(readCatalog()).rejects.toThrow(/could not be loaded/);
  });
});
