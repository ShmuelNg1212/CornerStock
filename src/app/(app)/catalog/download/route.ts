import { requireOwner } from "@/lib/auth";
import { exportCatalog, template } from "@/lib/catalog/files";
import { readCatalog } from "@/lib/catalog/queries";

export async function GET(request: Request) {
  await requireOwner();
  const params = new URL(request.url).searchParams;
  const format = params.get("format") === "xlsx" ? "xlsx" : "csv";
  const kind = params.get("template");
  if (kind && kind !== "catalog" && kind !== "stock")
    return new Response("Unknown template", { status: 400 });
  const bytes =
    kind === "catalog" || kind === "stock"
      ? await template(kind, format)
      : await exportCatalog(await readCatalog(), format);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type":
        format === "csv"
          ? "text/csv; charset=utf-8"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="cornerstock-${kind ? `${kind}-template` : "catalog"}.${format}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
