import type { Transition } from "motion/react";

/**
 * Motion presets. Each motion has a cause: a navigation, a state change, or a touch (ADR 0002).
 * Springs can be interrupted: a new target starts from the current place and speed.
 */
export const spring = {
  /** Presses, chips, small moves. */
  snappy: { type: "spring", stiffness: 520, damping: 34, mass: 0.7 },
  /** The indicator of the current tab. */
  tab: { type: "spring", stiffness: 420, damping: 32 },
  /** Cards that move to a new place in the list. */
  layout: { type: "spring", stiffness: 380, damping: 36 },
  /** Sheets and screens. Settles in about 350 ms. */
  sheet: { type: "spring", stiffness: 340, damping: 34 },
} satisfies Record<string, Transition>;

/** New items arrive one after another: 30 ms apart, and no more than 6 items wait. */
export function stagger(index: number) {
  return Math.min(index, 6) * 0.03;
}
