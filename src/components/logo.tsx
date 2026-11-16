/** The Cornerstock mark: a corner bracket that frames a bowling ball. */
export function LogoMark({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  const bracket = onDark ? "#f6f3ec" : "#172a3a";
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path d="M6 6h32v9H15v27H6z" fill={bracket} />
      <circle cx="31" cy="31" r="12" fill="#d45a32" />
      <circle cx="30" cy="25.5" r="1.9" fill="#f6f3ec" />
      <circle cx="35.5" cy="27.5" r="1.9" fill="#f6f3ec" />
      <circle cx="30.5" cy="31.5" r="1.9" fill="#f6f3ec" />
    </svg>
  );
}

export function Logo({ onDark = false }: { onDark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark className="size-7" onDark={onDark} />
      <span className="font-heading text-lg font-bold tracking-tight">CORNERSTOCK</span>
    </span>
  );
}
