import { ViewTransition } from "react";
import { SwipeBack } from "@/components/swipe-back";

const TYPES = { "nav-forward": "nav-forward", "nav-back": "nav-back", "weight-switch": "weight-switch", default: "none" } as const;

/**
 * Animates a detail screen when a link opens it or goes back from it.
 * A live refresh of the data has no transition type, so it does not animate.
 * `back` is the place that Back and the edge swipe open.
 */
export function DetailTransition({ back, children }: { back: string; children: React.ReactNode }) {
  return (
    <ViewTransition enter={TYPES} exit={TYPES} default="none">
      <div>
        <SwipeBack href={back}>{children}</SwipeBack>
      </div>
    </ViewTransition>
  );
}
