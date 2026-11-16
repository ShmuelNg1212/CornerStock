import { useId } from "react";
import { ballSwatches } from "@/lib/stock/ball-colors";
import { cn } from "@/lib/utils";

/**
 * A bowling ball with three finger holes, in the colors of the model.
 * It is a picture only. The color also shows as text next to it.
 */
export function BallGlyph({ color, className }: { color: string | null; className?: string }) {
  const id = useId().replace(/:/g, "");
  const swatches = ballSwatches(color);
  // Two or three colors mix in a swirl at an angle, like the coverstock of a ball.
  const stops = swatches.flatMap((swatch, index) => {
    const from = (index / swatches.length) * 100;
    const to = ((index + 1) / swatches.length) * 100;
    return [
      <stop key={`${index}a`} offset={`${from + (index ? 8 : 0)}%`} stopColor={swatch} />,
      <stop key={`${index}b`} offset={`${to - (index < swatches.length - 1 ? 8 : 0)}%`} stopColor={swatch} />,
    ];
  });
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={cn("shrink-0", className)}>
      <defs>
        <linearGradient id={`${id}-c`} x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(-18 .5 .5)">
          {stops}
        </linearGradient>
        <radialGradient id={`${id}-l`} cx="0.32" cy="0.28" r="0.75">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="45%" stopColor="#fff" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.28" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="20" fill={`url(#${id}-c)`} />
      <circle cx="24" cy="24" r="20" fill={`url(#${id}-l)`} />
      <g fill="#172a3a" fillOpacity="0.78" stroke="#f6f3ec" strokeOpacity="0.55" strokeWidth="0.8">
        <circle cx="20.5" cy="16" r="2.6" />
        <circle cx="28" cy="18" r="2.6" />
        <circle cx="22" cy="24.5" r="3" />
      </g>
    </svg>
  );
}
