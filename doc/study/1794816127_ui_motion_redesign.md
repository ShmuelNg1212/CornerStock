# Study: UI and motion redesign

Date: 2026-11-16. Mode: design. Branch: `feat/ui-redesign`, made from `feat/batch-scan`.

## Request

The human asked for a redesign of the interface and its motion. References from popular tools, skills, and plugins are permitted.

## Decisions by the human (2026-11-16)

| Question | Answer |
|---|---|
| Main device | Even mix. Phones do the scans. The counter computer shows the live stock view. |
| Brand kit | Keep it. It is now confirmed: palette, Space Grotesk and Inter, the corner-bracket logo. |
| Depth | Layouts can change. Functions and data stay the same. |
| Motion | Functional and quick. This replaces "No motion pass" in AGENTS.md. |
| Structure | "Find first". The human selected it from three sketches on the impeccable decision page. |

Sketch of the selected structure: [assets/1794816127_find_first_sketch.html](assets/1794816127_find_first_sketch.html). The sample models, serial numbers, and counts in the sketch are illustrations. They are not shop data.

The two structures that were not selected: "Weight rack" (a grid of models and weights) and "Live ledger" (a feed of the movements of the day).

## Current interface: findings

Source: the code on `feat/batch-scan`. The screens behind sign-in were not opened in a browser, because no Supabase project with a test account is available.

1. All screens use one column of 768px maximum. A counter computer shows a narrow column and much empty space.
2. Each step is a full page: stock, then model, then ball. On a large screen, the staff member loses the list when a model opens.
3. Search starts only after Enter. It is one field among other content.
4. Loading shows the text "Loading stock…". There are no skeletons.
5. There is no motion, except a press scale on buttons. A live change replaces the page content with no signal.
6. `scan-flow.tsx` is one component of 740 lines with four steps. A layout change there is a risk without a split.
7. Good parts to keep: the contrast-checked tokens, 48px controls, the status badge with icon and label, tabular numerals, the phone fixes in `globals.css`.

`PRODUCT.md` and `DESIGN.md` now exist. `DESIGN.md` records the interface as it is today. Its qualitative wording is the agent's and was not reviewed by the human.

## Design brief: "Find first"

**Job and audience.** A staff member at the counter must answer "Do you have it in 15?" in seconds. A staff member in the stock room must put new balls into stock with a phone. Mode: Operate.

**Thesis.** One search field leads the app. The staff member types a model or a serial number, and the answer shows during the typing. The stock list is the search with no text in it.

**Structure.**

- Counter computer and tablet (1024px and wider): three areas. A navy rail on the left holds the logo, the navigation, and the location. The middle is the search field, the stock total, and the model rows. The right is a detail pane for the selected model or ball. The list stays on screen while the pane changes.
- Phone: the search field at the top, then the model rows. The scan button is fixed above the tab bar, at the thumb. A model or a ball opens as a full screen with a back control.
- A model row shows the name, the brand and color, one chip for each weight with its count, and the total. A chip opens that model and weight.
- A serial number result shows the serial number, the model, the weight, the location, and the status.

**Scan flow.** The same steps and rules as today. The first screen is built around the camera action. The batch screen is a list where each photo row shows its state: reading, ready, needs a check, saved. The component is split into one file for each step.

**States.** Loading skeletons in the shape of the rows. No stock yet. No search result. A search that matches a serial number only. One location and all locations. Long model names. A ball with no recorded values. Staff and owner.

**Scope.** All built screens: sign-in, the shell, stock, model, ball and its actions, scan (single and batch), settings.

**Anti-goals.** No new stock function. No change to the database functions or the label rules. No dark theme: the shop is a lit room. No dashboard charts. No decoration that does not show a state.

## Motion thesis

Motion shows a state change. It does not decorate.

- **Focal moment: a ball goes into stock.** After a save, the scanned label becomes a row in the saved list and the count of that model goes up by one. This is the one authored sequence.
- **Continuity.** The detail pane changes with a short slide and fade. On the phone, a detail screen moves in from the right and back. Rows keep their identity during a search: rows that stay move to their new place.
- **Live change.** A row that changes from another device moves in place and holds a gold mark until the staff member has seen it. Its count ticks to the new value. Source of the idea: the gate-board world in the impeccable catalog.
- **Feedback.** Press states on each control. A save button shows pending, then done. A short toast confirms sold, moved, and saved.
- **Budget.** Transform and opacity only. No blur. Routine changes take 120 to 200 ms. The pane and the sheets take 250 to 320 ms. Exit is faster than entrance. No bounce.
- **Reduced motion.** No movement. The gold mark, the color change, and the toast stay.

## References

- Brand concept board: [assets/cornerstock-brand-concept.png](assets/cornerstock-brand-concept.png). Its inventory card and status pills are the look to reach.
- impeccable catalog: "boarding pass and gate board". Kept idea: a changed row moves in place and stays marked.
- Watermelon UI (motion/react examples): "Transaction List", "Expand Details", "List Stack". They are references for row expansion and list movement. No code from them is in the plan.
- Known product patterns: a list with a detail pane (mail clients, Linear), a search-led counter screen (point-of-sale apps).

## Risks and open points

1. The screens behind sign-in cannot be checked in a browser without a test account or fixture data.
2. Search during typing is a behaviour change. Each keystroke group makes a server request.
3. Row movement and the sheets need a layout animation tool. CSS alone cannot keep row identity in a React list.
4. `feat/ball-stock-v1` and `feat/batch-scan` are not on `main`. The redesign branch stands on both.
5. Next.js 16 differs from earlier versions. Read `node_modules/next/dist/docs/` before work on the layout and the routes.
