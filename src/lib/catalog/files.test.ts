import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { exportCatalog, mapSheet, readWorkbook, template } from "./files";
import { CATALOG_FIELDS, STOCK_FIELDS } from "./fields";
import type { BallModel } from "@/lib/types";

const bytes = (text: string) => new TextEncoder().encode(text);

describe("catalog file import", () => {
  it("preserves identifier zeroes and quoted multiline text with source rows", async () => {
    const { sheets } = await readWorkbook(bytes('UPC,Name,Color\r\n001234567895,"A ball, special","Red\nBlue"\r\n'), "stock.csv");
    expect(sheets[0].headers).toEqual(["UPC", "Name", "Color"]);
    expect(mapSheet(sheets[0], { upc: 0, model_name: 1, color: 2 })).toEqual({
      rows: [{ row: 2, values: { upc: "001234567895", model_name: "A ball, special", color: "Red\nBlue" } }], errors: [],
    });
  });

  it("rejects oversized files, excessive rows, and invalid mappings", async () => {
    await expect(readWorkbook(new Uint8Array(5 * 1024 * 1024 + 1), "stock.csv")).rejects.toThrow("5 MB");
    await expect(readWorkbook(bytes("upc\n" + "001234567895\n".repeat(1001)), "stock.csv")).rejects.toThrow("1,000");
    const { sheets } = await readWorkbook(bytes("Code,Name\n001234567895,Ball\n"), "stock.csv");
    expect(mapSheet(sheets[0], { upc: 0, model_name: 0 }).errors).toEqual([
      { row: 1, field: "model_name", message: "Map each source column to one field only." },
    ]);
    expect(mapSheet(sheets[0], { upc: 12 }).errors[0].message).toContain("column");
  });

  it("reports physical CSV line numbers after empty and multiline rows", async () => {
    const { sheets } = await readWorkbook(bytes('upc,model_name\n\n001234567895,"First\nBall"\n887970617601,Other\n'), "stock.csv");
    expect(sheets[0].rows.map((r) => r.row)).toEqual([3, 5]);
  });

  it("lists Excel sheets, preserves text IDs and dates, and rejects mapped formulas and damaged numeric IDs", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Stock");
    sheet.addRow(["upc", "serial", "model_name", "boxed_on"]);
    sheet.addRow(["001234567895", "ABC123", { formula: '"Ball"', result: "Ball" }, new Date("2026-11-17T00:00:00Z")]);
    sheet.addRow([1234567895, "DEF456", "Other", ""]);
    workbook.addWorksheet("Other").addRow(["upc"]);
    const { sheets } = await readWorkbook(new Uint8Array(await workbook.xlsx.writeBuffer()), "stock.xlsx");
    expect(sheets.map((s) => s.name)).toEqual(["Stock", "Other"]);
    const mapped = mapSheet(sheets[0], { upc: 0, serial: 1, model_name: 2, boxed_on: 3 });
    expect(mapped.rows[0].values).toEqual({ upc: "001234567895", serial: "ABC123", model_name: "", boxed_on: "2026-11-17" });
    expect(mapped.errors).toEqual([
      { row: 2, field: "model_name", message: "Replace this formula with a plain value." },
      { row: 3, field: "upc", message: "This numeric UPC has lost digits. Enter all 12 digits as text." },
    ]);
    expect(mapSheet(sheets[0], { upc: 0 }).errors).toHaveLength(1);
  });

  it.each(["csv", "xlsx"] as const)("exports %s with stable headers, safe text, and a lossless identifier round trip", async (format) => {
    const model: BallModel = {
      id: "model-id", upc: "001234567895", name: '=HYPERLINK("https://example.com")',
      nominal_weight_lb: 15, brand: "Bowlérs, Corner", color: "'Red / Blue", fragrance: null,
      coverstock: "Solid", weight_block: null, finish: "2000", rg: 2.48, diff: 0.048,
      mass_bias: null, product_code: "-CODE", selling_price: 12500.5, min_in_stock: 2,
    };
    const output = await exportCatalog([model], format);
    const { sheets } = await readWorkbook(output, `catalog.${format}`);
    expect(sheets[0].headers).toEqual([...CATALOG_FIELDS]);
    const mapped = mapSheet(sheets[0], Object.fromEntries(CATALOG_FIELDS.map((f, i) => [f, i])));
    expect(mapped.errors).toEqual([]);
    expect(mapped.rows[0].values).toMatchObject({
      upc: "001234567895", model_name: model.name, brand: model.brand, color: model.color,
      nominal_weight_lb: "15", selling_price: "12500.5", product_code: "-CODE", fragrance: "",
    });
    if (format === "csv") {
      const csv = new TextDecoder().decode(output);
      expect(csv).toContain("'001234567895");
      expect(csv).toContain("'=HYPERLINK");
    }
  });

  it.each(["csv", "xlsx"] as const)("provides blank catalog and stock templates in %s", async (format) => {
    for (const kind of ["catalog", "stock"] as const) {
      const workbook = await readWorkbook(await template(kind, format), `template.${format}`);
      expect(workbook.sheets[0].headers).toEqual([...(kind === "catalog" ? CATALOG_FIELDS : STOCK_FIELDS)]);
      expect(workbook.sheets[0].rows).toEqual([]);
    }
  });

  it("bounds Excel worksheet dimensions and compressed expansion before loading cells", async () => {
    const oversized = new ExcelJS.Workbook();
    const rows = oversized.addWorksheet("Stock");
    rows.getCell("A1002").value = "Too far";
    await expect(readWorkbook(new Uint8Array(await oversized.xlsx.writeBuffer()), "stock.xlsx")).rejects.toThrow("1,000");
    const wide = new ExcelJS.Workbook();
    wide.addWorksheet("Stock").getCell("BM1").value = "Too wide";
    await expect(readWorkbook(new Uint8Array(await wide.xlsx.writeBuffer()), "stock.xlsx")).rejects.toThrow("64 columns");
    const expanded = new ExcelJS.Workbook();
    expanded.addWorksheet("Stock").getCell("A1").value = "x".repeat(9 * 1024 * 1024);
    await expect(readWorkbook(new Uint8Array(await expanded.xlsx.writeBuffer()), "stock.xlsx")).rejects.toThrow("expands");
  });

  it("rejects merged cells and oversized worksheet metadata before expanding them", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Stock");
    sheet.addRow(["upc"]);
    const source = await workbook.xlsx.writeBuffer();
    const merged = await JSZip.loadAsync(source);
    merged.file("xl/worksheets/sheet1.xml", (await merged.file("xl/worksheets/sheet1.xml")!.async("string"))
      .replace("</worksheet>", '<mergeCells count="1"><mergeCell ref="A1:BM1"/></mergeCells></worksheet>'));
    await expect(readWorkbook(await merged.generateAsync({ type: "uint8array" }), "stock.xlsx")).rejects.toThrow("Merged cells");
    for (const metadata of [
      '<dimension ref="A1:XFD1048576"/>',
      '<cols><col min="1" max="16384" width="12"/></cols>',
      '<sheetData><row r="1" spans="1:16384"><c r="A1" t="inlineStr"><is><t>upc</t></is></c></row></sheetData>',
    ]) {
      const zip = await JSZip.loadAsync(source);
      const xml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
      zip.file("xl/worksheets/sheet1.xml", xml.replace(/<dimension[^>]*\/>/, "").replace(/<sheetData>[\s\S]*?<\/sheetData>/, "")
        .replace("</worksheet>", `${metadata}</worksheet>`));
      await expect(readWorkbook(await zip.generateAsync({ type: "uint8array" }), "stock.xlsx")).rejects.toThrow(/64 columns|1,000 data rows/);
    }
  });

  it("checks every entry that the Excel reader treats as a worksheet", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Stock").addRow(["upc"]);
    const zip = await JSZip.loadAsync(await workbook.xlsx.writeBuffer());
    const xml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    zip.file("x/xl/worksheets/sheet1.xml", xml.replace("</worksheet>", '<mergeCells count="1"><mergeCell ref="A1:XFD1048576"/></mergeCells></worksheet>'));
    await expect(readWorkbook(await zip.generateAsync({ type: "uint8array" }), "stock.xlsx")).rejects.toThrow("Merged cells");
  });
  it("asks for a resave, not a row limit, when rows and cells have no address", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Stock").addRows([["upc", "model_name"], ["012345678905", "Summit"]]);
    const zip = await JSZip.loadAsync(await workbook.xlsx.writeBuffer());
    const xml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    zip.file("xl/worksheets/sheet1.xml", xml.replace(/<dimension[^>]*\/>/, "").replace(/ r="[A-Z]*\d+"/g, ""));
    await expect(readWorkbook(await zip.generateAsync({ type: "uint8array" }), "stock.xlsx")).rejects.toThrow("Save it as .xlsx");
  });
  it("still bounds rows without an address", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Stock").addRows(Array.from({ length: 1003 }, () => ["x"]));
    const zip = await JSZip.loadAsync(await workbook.xlsx.writeBuffer());
    const xml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    zip.file("xl/worksheets/sheet1.xml", xml.replace(/<dimension[^>]*\/>/, "").replace(/ r="[A-Z]*\d+"/g, ""));
    await expect(readWorkbook(await zip.generateAsync({ type: "uint8array" }), "stock.xlsx")).rejects.toThrow("1,000 data rows");
  });
  it("stops CSV parsing at the row limit before processing a malformed tail", async () => {
    const content = 'upc\n' + '001234567895\n'.repeat(1001) + '"' + 'bad'.repeat(1000);
    await expect(readWorkbook(bytes(content), "stock.csv")).rejects.toThrow("1,000");
  });

  it("includes blank and clear instructions in downloadable templates without adding import rows", async () => {
    const csv = new TextDecoder().decode(await template("catalog", "csv"));
    expect(csv).toContain("# Cornerstock: Blank cells keep existing values. Use __CLEAR__ to clear an optional value.");
    const { sheets } = await readWorkbook(bytes(csv + '001234567895,Test,15,,,,,,,,,,,,\r\n'), "catalog.csv");
    expect(sheets[0].rows[0].row).toBe(3);
    const xlsx = new ExcelJS.Workbook();
    await xlsx.xlsx.load(await template("stock", "xlsx") as unknown as Parameters<typeof xlsx.xlsx.load>[0]);
    const note = xlsx.worksheets[0].getCell("A1").note;
    expect(typeof note === "string" ? note : JSON.stringify(note)).toContain("__CLEAR__");
  });
});
