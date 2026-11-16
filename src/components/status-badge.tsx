import { Ban, CircleCheck, Tag } from "lucide-react";
import type { BallStatus } from "@/lib/types";

// A status always shows an icon and a label, not color alone.
const STATUS = {
  in_stock: { label: "In stock", icon: CircleCheck, className: "bg-ok-surface text-ok" },
  sold: { label: "Sold", icon: Tag, className: "bg-muted text-foreground" },
  removed: { label: "Removed", icon: Ban, className: "bg-danger-surface text-destructive" },
} as const;

export function StatusBadge({ status }: { status: BallStatus }) {
  const { label, icon: Icon, className } = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium ${className}`}>
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </span>
  );
}
