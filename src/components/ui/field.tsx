import { cn } from "@/lib/utils";

export const inputClass =
  "h-12 w-full rounded-lg border border-input bg-card px-3.5 text-base text-foreground outline-none transition-[border-color,box-shadow] duration-(--dur-fast) placeholder:text-muted-foreground hover:border-foreground/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15 disabled:opacity-60";

const buttonBase =
  "inline-flex h-12 items-center justify-center gap-2 rounded-lg px-5 text-base outline-none transition-[background-color,border-color,transform] duration-(--dur-fast) ease-out focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60";

export const buttonClass = {
  /** The one main action of a screen. */
  action: `${buttonBase} bg-action font-semibold text-action-foreground hover:bg-[#a5411f]`,
  primary: `${buttonBase} bg-primary font-semibold text-primary-foreground hover:bg-[#22394c]`,
  quiet: `${buttonBase} border border-input bg-card font-medium text-foreground hover:border-foreground/40 hover:bg-muted`,
  /** A small button in a row of a list. */
  small:
    "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-input bg-card px-3 text-sm font-medium outline-none transition-[background-color,border-color,transform] duration-(--dur-fast) hover:border-foreground/40 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60",
  /** A text action inside content. */
  link: "inline-flex h-10 items-center rounded-md font-medium text-action underline decoration-action/40 underline-offset-4 outline-none transition-colors duration-(--dur-fast) hover:decoration-action focus-visible:ring-3 focus-visible:ring-ring/40",
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
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-sm font-medium text-destructive">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-sm text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}

/** The heading of a section inside a screen. */
export function SectionTitle({ id, children, className }: { id?: string; children: React.ReactNode; className?: string }) {
  return (
    <h2 id={id} className={cn("text-sm font-semibold text-muted-foreground", className)}>
      {children}
    </h2>
  );
}
