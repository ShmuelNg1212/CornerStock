---
version: 1
slug: "src-app-app-layout-tsx"
primary_target: "src/app/(app)/layout.tsx"
related_targets: ["src/app/(app)/page.tsx","src/app/(app)/scan/scan-flow.tsx","src/app/login/page.tsx"]
---

# Surface brief: the Cornerstock app (all screens behind sign-in, and sign-in)

Mode: Operate. Scope: the shell, stock, model, ball, scan, settings, sign-in.

Audience and job: shop staff at the counter answer "Do you have it in 15?" in seconds. Staff in the stock room put new balls into stock with a phone. Even mix of phones and counter computers.

Constraints: no change to database functions, label rules, or server actions. Light theme only. Brand kit confirmed (PRODUCT.md). No animation library; React ViewTransition and CSS.

## Direction contract

THESIS: One search field leads the app; the stock list is the search with no text in it. It refuses the single centered column of cards and the dashboard of stat tiles.

OWN-WORLD: Warm ivory ground, ink navy rail and text, white rows with a thin sand border, action orange for the one main action, maple gold for the weight tag and the "changed" mark. Space Grotesk for names and numbers, Inter for the interface, tabular numerals, monospace for serial numbers. Weight chips with a count are the recurring component.

STORY: The staff member types a few letters, sees the model and its weights with counts, opens a weight, and reads the individual balls. The list stays in view.

FIRST VIEWPORT: At 1440px: navy rail 216px on the left (logo, navigation, location at the bottom); the middle holds a 68px search field at the top, the match and stock totals below it, then model rows with weight chips and a total at the right; a 400px detail pane on the right with the model name, a gold weight tag, the count, the balls, and the scan action. At 390px: top bar, search field, model rows, scan button fixed above the tab bar.

SIGNATURE: A ball goes into stock: after a save, the scanned label becomes a saved row and the model count ticks up. A row changed from another device moves in place and holds a gold mark with a label until seen. Motion grammar: transform and opacity, 120 to 320 ms, ease-out, no bounce, nothing moves under reduced motion.

FORM: Find first, the dealt lead of the surface round, candidate 5 of 7. seed:90eb1cf2c1b0b5fd

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Not from the sketch

The sketch marks selected and changed rows with a thick stripe on the left edge. The build does not. Selected is a full navy outline. Changed is a gold tint with a gold dot and a label.
