import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { owner, rpc } = vi.hoisted(() => ({ owner: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireOwner: owner }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));

import { POST } from "./route";

const model = "298b9435-7f17-41bb-840c-ef1ff81b4c7d";
const mall = "d429ac69-c498-4076-a202-3342e44fb3cc";
const store = "68a08d3d-0d3e-4fab-bbea-d5292ef2a7ad";
const rival = "fcee13b5-b42f-49f8-9f43-583faf7d0250";
const row = {
  model_id: model, location_id: mall, model_name: "=A1", brand: "Storm", weight_lb: 15,
  upc: "087970619007", location_name: "Mall", in_stock: 1, min_in_stock: 3, units: 4,
};
const worksheet = {
  start: "2026-10-22", end: "2026-11-20",
  rows: [row, { ...row, location_id: store, location_name: "Warehouse" }, { ...row, model_id: rival }],
  locations: [{ id: mall, name: "Mall" }, { id: store, name: "Warehouse" }],
};
const line = { model_id: model, location_id: mall, in_stock: 1, min_in_stock: 3, quantity: "5" };
const request = (lines: unknown) => new Request("http://localhost/activity/reorder/download", {
  method: "POST", body: JSON.stringify(lines), headers: { "Content-Type": "application/json" },
});

describe("reorder worksheet download", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    owner.mockResolvedValue({ id: "owner" });
    rpc.mockResolvedValue({ data: worksheet, error: null });
  });

  it("exports ordered lines with trusted values, distinct locations, and text UPCs", async () => {
    const response = await POST(request([
      { ...line, upc: "tampered" }, { ...line, location_id: store, quantity: "2" },
      { ...line, model_id: rival, quantity: "0" },
    ]));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toMatch(/\.xlsx/);
    expect(response.headers.get("Cache-Control")).toMatch(/no-store/);
    expect(rpc.mock.calls).toEqual([["reorder_worksheet"]]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await response.arrayBuffer());
    const sheet = workbook.getWorksheet("Reorder worksheet")!;
    expect(sheet.rowCount).toBe(3);
    expect(sheet.getRow(2).values).toEqual([
      , "=A1", "Storm", 15, "087970619007", "Mall", 1, 3, 2, 4, 5, "2026-10-22", "2026-11-20",
    ]);
    expect(sheet.getCell("D2").type).toBe(ExcelJS.ValueType.String);
    expect(sheet.getCell("E3").value).toBe("Warehouse");
    expect(sheet.getCell("J3").value).toBe(2);
  });

  it.each(["-1", "1.5", "1e2", "9007199254740992"])("rejects invalid quantity %s", async (quantity) => {
    expect((await POST(request([{ ...line, quantity }]))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects empty and duplicate selections", async () => {
    expect((await POST(request([{ ...line, quantity: "  " }]))).status).toBe(400);
    expect((await POST(request([line, line]))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    { ...line, in_stock: 2 },
    { ...line, min_in_stock: 2 },
    { ...line, location_id: rival },
  ])("returns current rows if a selected line changed", async (stale) => {
    const response = await POST(request([stale]));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ worksheet });
    expect(response.headers.get("Content-Disposition")).toBeNull();
  });

  it("requires an owner session before loading rows", async () => {
    owner.mockRejectedValue(new Error("owner required"));
    await expect(POST(request([line]))).rejects.toThrow("owner required");
    expect(rpc).not.toHaveBeenCalled();
  });
});
