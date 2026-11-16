# 0001: The brand kit is confirmed, and motion is functional

Date: 2026-11-16. Status: accepted. Decided by: the human. Decision 2 and the motion consequences are replaced by [0002](0002-motion-with-character.md). The rest stays.

## Context

The brand kit was a proposal in the handoff document. AGENTS.md said "No motion pass". The human then asked for a redesign of the interface and its motion.

## Decision

1. The brand kit is confirmed: the name, the endorsement "For Bowlers Corner", the corner-bracket logo, the palette (ink navy `#172A3A`, warm ivory `#F6F3EC`, maple gold `#D7A55B`, signal orange `#D45A32`, slate gray `#6B747A`), and the type (Space Grotesk for headings, Inter for interface and data).
2. The interface has motion. Motion is functional and quick. It shows a state change. It does not decorate. Under the reduced-motion setting, nothing moves.
3. The app structure is "Find first": one search field leads the app. Large screens show the stock list and a detail pane together.
4. The interface has a light theme only.

## Not decided

- The tagline "Every item. Accounted for." is a proposal. It shows on the sign-in screen only.
- The tech stack is still a recommendation.

## Consequences

- The actions use `#B94A25`, because white text on `#D45A32` has a contrast of 4.0 only. This stays.
- Motion uses React `<ViewTransition>` and CSS. No animation library is added.
- Each animation must have a reason that is a state change. An animation with no such reason is removed.

Sources: [../study/1794816127_ui_motion_redesign.md](../study/1794816127_ui_motion_redesign.md), [../plan/1794816220_ui_motion_redesign.md](../plan/1794816220_ui_motion_redesign.md).
