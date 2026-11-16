# 0002: Motion has character, and each motion has a cause

Date: 2026-11-16. Status: accepted. Decided by: the human. Replaces the motion parts of [0001](0001-brand-kit-confirmed-and-functional-motion.md).

## Context

ADR 0001 made motion functional and quick, with no animation library. The human then asked for easier navigation and "more flair in terms of motion". The human gave an inventory app shot as inspiration only.

## Decision

1. Motion has character. Springs, shared elements, rolling digits, and one authored moment after a save are permitted.
2. Each motion has a cause: a navigation, a state change, or a touch. Motion with no cause is forbidden.
3. Under the reduced-motion setting, nothing moves. Colors, marks, counts, and toasts stay.
4. The app uses the `motion` library (`motion/react`), loaded with `LazyMotion`. View transitions stay for route changes and shared elements. Each animated element has one owner.
5. No haptics.

## Not changed

The brand kit, the light theme, and "Find first" from ADR 0001 stay.

## Consequences

- Animations use transform and opacity only, and can be interrupted.
- The first-load JavaScript grows. The plan sets a budget of 25 KB gzip.

Sources: [../study/1794842063_ui_flair.md](../study/1794842063_ui_flair.md), [../plan/1794842063_ui_flair.md](../plan/1794842063_ui_flair.md).
