export type ReorderRow = {
  model_id: string;
  location_id: string;
  model_name: string;
  brand: string | null;
  weight_lb: number;
  upc: string;
  location_name: string;
  in_stock: number;
  min_in_stock: number;
  units: number;
};

export type ReorderWorksheet = {
  start: string;
  end: string;
  rows: ReorderRow[];
  locations: { id: string; name: string }[];
};

export function reorderRowKey(row: Pick<ReorderRow, "model_id" | "location_id">): string {
  return `${row.model_id}:${row.location_id}`;
}

export function orderQuantity(text: string): number | null {
  const value = text.trim();
  // Excel preserves at most 15 significant digits in a numeric cell.
  return /^\d{0,15}$/.test(value) ? Number(value) : null;
}
