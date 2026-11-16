import { CircleCheck, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const TONE = {
  error: { className: "bg-danger-surface text-destructive", icon: TriangleAlert, role: "alert" },
  warn: { className: "bg-warn-surface text-warn", icon: TriangleAlert, role: "alert" },
  ok: { className: "bg-ok-surface text-ok", icon: CircleCheck, role: "status" },
} as const;

/** A message about the result of an action. It has an icon and text, not color alone. */
export function Notice({ tone, children, className }: { tone: keyof typeof TONE; children: React.ReactNode; className?: string }) {
  const { className: toneClass, icon: Icon, role } = TONE[tone];
  return (
    <div role={role} className={cn("flex animate-enter items-start gap-2.5 rounded-lg px-3.5 py-3 font-medium", toneClass, className)}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 break-words">{children}</div>
    </div>
  );
}
