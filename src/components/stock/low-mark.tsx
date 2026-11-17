import { CircleSlash, TriangleAlert } from "lucide-react";
import type { StockStatus } from "@/lib/low-stock";

/** The words and icon of each low-stock status. A status shows a word and an icon, not color alone. */
export const LOW_MARK = {
  low: { label: "Low stock", short: "Low", Icon: TriangleAlert },
  out: { label: "Out of stock", short: "Out", Icon: CircleSlash },
} as const satisfies Record<Exclude<StockStatus, "ok">, unknown>;

/** "Low stock · keep 2", or with the locations that are low: "Low stock in Warehouse · keep 2". */
export function LowMark({ status, minimum, places }: { status: StockStatus; minimum: number | null; places?: string[] }) {
  if (status === "ok") return null;
  const { label, Icon } = LOW_MARK[status];
  return (
    <p className="tabular inline-flex items-center gap-1.5 rounded-full bg-warn-surface px-2.5 py-1 text-sm font-semibold text-warn">
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span>
        {label}
        {places?.length ? ` in ${places.join(", ")}` : ""}
        <span className="font-normal"> · keep {minimum}</span>
      </span>
    </p>
  );
}
