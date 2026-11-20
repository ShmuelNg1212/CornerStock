import "server-only";
import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
import { fromBuffer } from "yauzl";
import { SaxesParser } from "saxes";
import { writeXlsx } from "@/lib/workbook";
import type { BallModel } from "@/lib/types";
import { CATALOG_FIELDS, STOCK_FIELDS, type ColumnMapping, type FileCell, type FileError, type FileFormat, type ImportKind, type ImportRow, type ImportSheet } from "./fields";
export * from "./fields";

const CSV_INSTRUCTIONS = "# Cornerstock: Blank cells keep existing values. Use __CLEAR__ to clear an optional value.";
class FileLimitError extends Error {}

export async function readWorkbook(bytes: Uint8Array, filename: string): Promise<{ sheets: ImportSheet[] }> {
  if (bytes.byteLength > 5 * 1024 * 1024) throw new Error("Files must be 5 MB or smaller. Split this file and try again.");
  if (filename.toLowerCase().endsWith(".xlsx")) return readExcel(bytes);
  if (!filename.toLowerCase().endsWith(".csv")) throw new Error("Select a CSV or .xlsx file.");
  let previousEnd = 0;
  let previousComments = 0;
  const records: { record: string[]; row: number }[] = [];
  try {
    parse(bytes, {
      bom: true, info: true, relax_column_count: true, max_record_size: 64 * 1024,
      comment: CSV_INSTRUCTIONS, comment_no_infix: true,
      on_record: (value) => {
        const entry = value as unknown as { record: string[]; info: { lines: number; comment_lines: number } };
        const row = previousEnd + 1 + entry.info.comment_lines - previousComments;
        previousEnd = entry.info.lines;
        previousComments = entry.info.comment_lines;
        if (!entry.record.some((cell) => cell.trim() !== "")) return null;
        if (records.length >= 1001) throw new FileLimitError("Use at most 1,000 data rows per file. Split this file and try again.");
        if (entry.record.length > 64) throw new FileLimitError("Use at most 64 columns per file.");
        if (records.length && entry.record.length !== records[0].record.length) throw new Error("COLUMN_COUNT");
        records.push({ record: entry.record, row });
        // Do not retain a second array of parsed records or raw source text.
        return null;
      },
    });
  } catch (error) {
    if (error instanceof FileLimitError) throw error;
    throw new Error("This CSV could not be read. Check quoted values and the number of columns.");
  }
  if (!records.length) throw new Error("This file is empty. Add a header row first.");
  if (records[0].record.length > 64) throw new Error("Use at most 64 columns per file.");
  if (records.some(({ record }) => record.length !== records[0].record.length)) throw new Error("Each CSV row must have the same number of columns as the header.");
  return { sheets: [{ name: "CSV", headers: records[0].record, rows: records.slice(1).map(({ record, row }) => ({ row, cells: record.map((text) => ({ text, csv: true })) })) }] };
}

export function mapSheet(sheet: ImportSheet, mapping: ColumnMapping) {
  const errors: FileError[] = [];
  const used = new Set<number>();
  for (const [field, index] of Object.entries(mapping)) {
    if (!(STOCK_FIELDS as readonly string[]).includes(field) || !Number.isInteger(index) || index < 0 || index >= sheet.headers.length) {
      errors.push({ row: 1, field, message: "Select a valid source column." });
    } else if (used.has(index)) {
      errors.push({ row: 1, field, message: "Map each source column to one field only." });
    }
    used.add(index);
  }
  if (errors.length) return { rows: [], errors };
  const rows: ImportRow[] = sheet.rows.map(({ row, cells }) => ({
    row,
    values: Object.fromEntries(Object.entries(mapping).map(([field, index]) => {
      const cell = cells[index];
      if (cell?.formula) errors.push({ row, field, message: "Replace this formula with a plain value." });
      if (field === "upc" && cell?.numeric && !/^\d{12}$/.test(cell.text)) errors.push({ row, field, message: "This numeric UPC has lost digits. Enter all 12 digits as text." });
      if (field === "serial" && cell?.numeric) errors.push({ row, field, message: "Enter serial numbers as text to preserve all digits." });
      let text = cell?.text ?? "";
      // CSV exports use an apostrophe to preserve IDs and disable spreadsheet formulas.
      if (cell?.csv && text.startsWith("'") && (field === "upc" || field === "serial" || csvUnsafe(text.slice(1)))) text = text.slice(1);
      return [field, text];
    })),
  }));
  return { rows, errors };
}

/** Validate actual ZIP expansion before ExcelJS builds the workbook in memory. */
async function checkZip(bytes: Uint8Array): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    fromBuffer(Buffer.from(bytes), { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
      if (error || !zip) { reject(new Error("This Excel file could not be read.")); return; }
      let entries = 0;
      let total = 0;
      const fail = (error: Error) => { zip.close(); reject(error); };
      zip.on("error", fail);
      zip.on("end", resolve);
      zip.on("entry", (entry) => {
        if (++entries > 256 || entry.uncompressedSize > 8 * 1024 * 1024 || total + entry.uncompressedSize > 20 * 1024 * 1024) {
          fail(new Error("This workbook expands beyond the import limit. Split it into smaller files.")); return;
        }
        zip.openReadStream(entry, (error, stream) => {
          if (error || !stream) { fail(new Error("This Excel file could not be read.")); return; }
          stream.on("error", fail);
          // Match the Excel reader's own unanchored test, so every entry it loads as a sheet is checked.
          const worksheet = /xl\/worksheets\/sheet\d+[.]xml/.test(entry.fileName);
          // Row and cell addresses are optional. A missing address follows the previous one.
          let rowNumber = 0;
          let columnNumber = 0;
          const xml = worksheet ? new SaxesParser() : null;
          const decoder = new TextDecoder();
          xml?.on("doctype", () => { throw new Error("Workbook XML must not contain a document type."); });
          xml?.on("opentag", (tag) => {
            const name = tag.name.split(":").pop();
            const address = String(tag.attributes.r ?? "");
            if (name === "mergeCell") throw new Error("Merged cells are not supported. Unmerge cells before importing.");
            if (name === "col") {
              for (const bound of [tag.attributes.min, tag.attributes.max]) {
                if (!/^[1-9]\d*$/.test(String(bound)) || Number(bound) > 64) throw new Error("Use at most 64 columns per worksheet.");
              }
            }
            if (name === "row") {
              if (address && !/^[1-9]\d*$/.test(address)) throw new Error("This Excel file could not be read.");
              rowNumber = address ? Number(address) : rowNumber + 1;
              columnNumber = 0;
              if (rowNumber > 1001) throw new Error("Use at most 1,000 data rows per worksheet. Split this file and try again.");
              if (tag.attributes.spans && !/^[1-9]\d*:[1-9]\d*$/.test(String(tag.attributes.spans))) throw new Error("Use at most 64 columns per worksheet.");
              for (const span of String(tag.attributes.spans ?? "1:1").split(":")) {
                if (Number(span) > 64) throw new Error("Use at most 64 columns per worksheet.");
              }
            }
            for (const attribute of ["ref", "sqref"]) {
              if (tag.attributes[attribute]) checkRange(String(tag.attributes[attribute]));
            }
            if (name === "c") {
              const match = address.match(/^([A-Z]+)(\d+)$/);
              if (address && !match) throw new Error("This Excel file could not be read.");
              if (match && Number(match[2]) > 1001) throw new Error("Use at most 1,000 data rows per worksheet. Split this file and try again.");
              const column = match ? [...match[1]].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) : columnNumber + 1;
              columnNumber = column;
              if (column > 64) throw new Error("Use at most 64 columns per worksheet.");
            }
          });
          stream.on("data", (chunk: Buffer) => {
            total += chunk.length;
            if (total > 20 * 1024 * 1024) {
              stream.destroy(); fail(new Error("This workbook expands beyond the import limit. Split it into smaller files."));
              return;
            }
            try { xml?.write(decoder.decode(chunk, { stream: true })); }
            catch (error) { stream.destroy(); fail(error instanceof Error ? error : new Error("This Excel file could not be read.")); }
          });
          stream.on("end", () => {
            try { xml?.write(decoder.decode()).close(); zip.readEntry(); }
            catch (error) { fail(error instanceof Error ? error : new Error("This Excel file could not be read.")); }
          });
        });
      });
      zip.readEntry();
    });
  });
}

function excelCell(value: ExcelJS.CellValue): FileCell {
  if (value === null || value === undefined) return { text: "" };
  if (value instanceof Date) return { text: Number.isNaN(value.valueOf()) ? "" : value.toISOString().slice(0, 10) };
  if (typeof value === "number") return { text: String(value), numeric: true };
  if (typeof value === "object") {
    if ("formula" in value || "sharedFormula" in value) return { text: "", formula: true };
    if ("richText" in value) return { text: value.richText.map((part) => part.text).join("") };
    if ("text" in value) return { text: value.text };
    return { text: "", formula: true };
  }
  return { text: String(value) };
}

async function readExcel(bytes: Uint8Array): Promise<{ sheets: ImportSheet[] }> {
  await checkZip(bytes);
  const workbook = new ExcelJS.Workbook();
  // ExcelJS declares its own pre-Node Buffer type. Runtime accepts Node buffers.
  try { await workbook.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0]); }
  catch { throw new Error("This Excel file could not be read. Save it as .xlsx and try again."); }
  const sheets: ImportSheet[] = [];
  for (const sheet of workbook.worksheets) {
    if (sheet.rowCount > 1001) throw new Error("Use at most 1,000 data rows per worksheet. Split this file and try again.");
    if (sheet.columnCount > 64) throw new Error("Use at most 64 columns per worksheet.");
    const rows: ImportSheet["rows"] = [];
    sheet.eachRow((row, rowNumber) => {
      const cells = Array.from({ length: sheet.columnCount }, (_, i) => excelCell(row.getCell(i + 1).value));
      if (cells.some((cell) => cell.text.trim() !== "" || cell.formula)) rows.push({ row: rowNumber, cells });
    });
    if (!rows.length) continue;
    const header = rows.shift()!;
    if (header.cells.some((cell) => cell.formula)) throw new Error("Worksheet headers must be plain values.");
    sheets.push({ name: sheet.name, headers: header.cells.map((cell) => cell.text), rows });
  }
  if (!sheets.length) throw new Error("This workbook is empty. Add a header row first.");
  return { sheets };
}

function checkRange(range: string) {
  for (const cell of range.split(/[\s:]+/)) {
    const match = cell.match(/^\$?([A-Z]+)\$?([1-9]\d*)$/);
    if (!match || Number(match[2]) > 1001) throw new Error("Use at most 1,000 data rows per worksheet. Split this file and try again.");
    const column = [...match[1]].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0);
    if (column > 64) throw new Error("Use at most 64 columns per worksheet.");
  }
}

function csvUnsafe(value: string) {
  return /^[\s]*[=+\-@]/.test(value) || /^[\t\r\n']/.test(value);
}

async function writeFile(headers: readonly string[], rows: (string | number | null)[][], format: FileFormat, instructions = false): Promise<Uint8Array> {
  if (format === "csv") {
    const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const content = [headers.map(quote).join(","), ...(instructions ? [CSV_INSTRUCTIONS] : []), ...rows.map((row) => row.map((value, index) => {
      let text = value === null ? "" : String(value);
      if (typeof value === "string" && (headers[index] === "upc" || headers[index] === "serial" || csvUnsafe(text))) text = `'${text}`;
      return quote(text);
    }).join(","))].join("\r\n") + "\r\n";
    return new TextEncoder().encode(`\uFEFF${content}`);
  }
  return writeXlsx("Catalog", headers, rows, instructions);
}

export async function exportCatalog(models: BallModel[], format: FileFormat): Promise<Uint8Array> {
  return writeFile(CATALOG_FIELDS, models.map((model) => CATALOG_FIELDS.map((field) => field === "model_name" ? model.name : model[field])), format);
}

export async function template(kind: ImportKind, format: FileFormat): Promise<Uint8Array> {
  return writeFile(kind === "catalog" ? CATALOG_FIELDS : STOCK_FIELDS, [], format, true);
}
