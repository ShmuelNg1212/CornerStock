import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { orderQuantity, reorderRowKey } from "@/lib/reorder-worksheet";
import { readReorderWorksheet } from "@/lib/reorder-worksheet-query";
import { writeXlsx } from "@/lib/workbook";

const selectionSchema = z.array(z.object({
  model_id: z.uuid().transform((id) => id.toLowerCase()),
  location_id: z.uuid().transform((id) => id.toLowerCase()),
  in_stock: z.number().int().nonnegative(),
  min_in_stock: z.number().int().positive(),
  quantity: z.string(),
}));

const headers = [
  "model_name", "brand", "weight_lb", "upc", "location", "in_stock", "minimum",
  "gap_to_minimum", "units_sold", "order_quantity", "sales_start", "sales_end",
];
const noStore = { "Cache-Control": "private, no-store" };

function errorResponse(error: string, status: number) {
  return Response.json({ error }, { status, headers: noStore });
}

export async function POST(request: Request) {
  await requireOwner();
  const input = selectionSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return errorResponse("Check the order lines and try again.", 400);

  const quantities = new Map<string, { quantity: number; in_stock: number; min_in_stock: number }>();
  for (const line of input.data) {
    const key = reorderRowKey(line);
    const quantity = orderQuantity(line.quantity);
    if (quantity === null) return errorResponse("Use whole numbers of up to 15 digits for order quantities.", 400);
    if (quantities.has(key)) return errorResponse("Each order line can appear only once.", 400);
    quantities.set(key, { ...line, quantity });
  }

  const selected = [...quantities].filter(([, line]) => line.quantity > 0);
  if (!selected.length) return errorResponse("Enter an order quantity above zero.", 400);

  try {
    const worksheet = await readReorderWorksheet();
    const current = new Map(worksheet.rows.map((row) => [reorderRowKey(row), row]));
    const stale = selected.some(([key, line]) => {
      const row = current.get(key);
      return !row || row.in_stock !== line.in_stock || row.min_in_stock !== line.min_in_stock;
    });
    if (stale) {
      return Response.json({
        error: "Stock changed. Review the updated lines before you download again.",
        worksheet,
      }, { status: 409, headers: noStore });
    }

    const rows = worksheet.rows.flatMap((row) => {
      const line = quantities.get(reorderRowKey(row));
      if (!line?.quantity) return [];
      return [[row.model_name, row.brand, row.weight_lb, row.upc, row.location_name,
        row.in_stock, row.min_in_stock, row.min_in_stock - row.in_stock, row.units,
        line.quantity, worksheet.start, worksheet.end]];
    });
    const bytes = await writeXlsx("Reorder worksheet", headers, rows);
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...noStore,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="cornerstock-reorder-${worksheet.end}.xlsx"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return errorResponse("The worksheet could not be downloaded. Try again.", 500);
  }
}
