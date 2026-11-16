import { cn } from "@/lib/utils";

export const inputClass =
  "h-12 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15 disabled:opacity-60";

export const buttonClass = {
  action:
    "inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-action px-5 text-base font-semibold text-action-foreground outline-none transition-transform hover:bg-action/90 focus-visible:ring-3 focus-visible:ring-ring/40 active:scale-[0.98] disabled:opacity-60",
  primary:
    "inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-base font-semibold text-primary-foreground outline-none transition-transform hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/40 active:scale-[0.98] disabled:opacity-60",
  quiet:
    "inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-input bg-card px-5 text-base font-medium text-foreground outline-none transition-transform hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 active:scale-[0.98] disabled:opacity-60",
};

/** A labelled form field with an error line. */
export function Field({
  label,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-sm font-medium text-foreground">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-sm font-medium text-destructive">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-sm text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}
