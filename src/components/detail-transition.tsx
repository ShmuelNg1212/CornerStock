import { ViewTransition } from "react";

const TYPES = { "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" } as const;

/**
 * Animates a detail screen when a link opens it or goes back from it.
 * A live refresh of the data has no transition type, so it does not animate.
 */
export function DetailTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter={TYPES} exit={TYPES} default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
