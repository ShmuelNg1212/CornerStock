import "server-only";
import ExcelJS from "exceljs";

export async function writeXlsx(
  sheetName: string,
  headers: readonly string[],
  rows: (string | number | null)[][],
  instructions = false,
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow([...headers]);
  for (const row of rows) sheet.addRow(row);
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.getRow(1).font = { bold: true };
  if (instructions) sheet.getRow(1).eachCell((cell) => { cell.note = "Blank cells keep existing values. Use __CLEAR__ to clear an optional value. Enter UPC and serial numbers as text."; });
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, rows.length + 1), column: headers.length } };
  sheet.columns.forEach((column, index) => {
    column.width = headers[index] === "model_name" ? 32 : 20;
    if (headers[index] === "upc" || headers[index] === "serial") column.numFmt = "@";
  });
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
