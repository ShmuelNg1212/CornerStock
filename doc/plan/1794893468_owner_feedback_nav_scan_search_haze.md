# Plan: tab bar, serial mix-up, search, and top haze

Study: [doc/study/1794893468_owner_feedback_nav_scan_search_haze.md](../study/1794893468_owner_feedback_nav_scan_search_haze.md)

Mode: mixed. Technical first (tasks 2, 3, 4), then design (tasks 1, 5).
Skills: task 2 and 3 `tdd`; task 4 `tdd` (database test); task 1 `mobile-native`; task 5 `mobile-native`, `impeccable` (polish). Rendezvous: `code-review`, `simplify`, `break-ui` (search with odd input).

Branch: `fix/owner-feedback-nov17`. One commit for each task.

## OPEN QUESTIONS

1. **Tab bar fault.** The code and your screenshot show a correct bar. Please send a screenshot from the owner's phone that shows the crowded icons. Until then, task 5 is blocked. My guess: the owner sees two account controls (the "S" at the top and Settings at the bottom). If that is the fault, the fix is to remove the "S" from the top bar for the owner, because Settings already holds the account panel.
2. **Other makers.** Do you stock balls from makers outside the Storm group (Brunswick, Hammer, Motiv, Roto Grip is Storm)? If yes, please send one label photo of each. Task 2 treats a code that starts with letters as a product code. A maker whose serial numbers start with letters then needs a typed serial until we add its form.
3. **Status bar.** Task 1 changes the top of the home-screen app. The clock and battery then sit on a solid bar, not over the page. The owner must delete the home-screen app and add it again. Is that acceptable?

## Tasks

### [ ] 1. Remove the iOS haze — `tests: alongside`
- Set `statusBarStyle` to `"default"` in `src/app/layout.tsx`.
- Remove the navy safe-area band in `layout.tsx` and the safe-area top padding in `shell.tsx` only if they then show a double gap.
- Change the release marker.
- Acceptance: on an iPhone with iOS 26.1 or later, a fresh home-screen install shows no grey gradient at the top. The status bar is navy or a plain solid colour. Nothing moves under it during a scroll.
- Completion: a device screenshot from the human after deploy (the agent cannot run a real iPhone).

### [ ] 2. Classify scan codes by shape before position — `tests: first`
- In `src/lib/label/barcodes.ts`, add `codeShape(text)`: `"serial"` (2 digits, then a letter), `"product"` (starts with a letter), or `"unknown"`.
- `classifyBarcodes` uses the shape first. It uses the position only when the shapes do not decide.
- A code with the product shape never goes into the serial number automatically.
- Tests: photo 08 (product code above the UPC) gives `serial: null`. No UPC with only a product code gives `serial: null`. All 10 fixtures keep or improve their current result.
- Acceptance: `npm test` passes, with the new cases.
- Completion: the fixture test reads photo 08 and gives `product_code: "BBMRTQ15L"`, `serial: null`.

### [ ] 3. Check the serial against the catalog — `tests: first`
- `lookupLabel` also returns `serialIsProductCode: true` when the scanned serial is equal to the `product_code` of any model.
- `readLabel` in `use-scan.ts` then moves the value to the product code, clears the serial, and shows: "This is the product code. Scan or type the serial number."
- The confirm screen shows the same warning when a typed or edited serial is equal to the product code field.
- The live viewfinder does not auto-capture a frame whose serial has the product shape.
- Acceptance: a unit test for the move. A browser probe: a scan of a known model whose product code reads as the serial does not save.
- Completion: probe recorded in this plan.

### [ ] 4. Refuse a product code as a serial in the database — `tests: first`
- New migration: `receive_ball` and the ball correction function raise an error when the serial is equal to the `product_code` of the label or of any model.
- The server action shows the error as a field error on the serial number.
- Acceptance: a database test that a call with `serial = product_code` fails and writes no ball and no movement.
- Completion: `npm test` passes, the database tests included.

### [ ] 5. Fix the tab bar — `tests: alongside` — BLOCKED on open question 1
- Fix the fault that the owner's screenshot shows.
- Acceptance: at 320, 375, and 430 px wide, and with the largest browser text size, no icon or label overlaps another or the scan button.
- Completion: probe screenshots at the three widths.

### [ ] 6. Make the search forgiving — `tests: first`
- New `src/lib/search.ts` with `matches(text, query)`:
  - Fold case and accents (NFKD).
  - Fold look-alikes: `!` and `|` and `1` → `i` only in the letter position, `0` → `o` only next to letters.
  - Remove spaces and punctuation, then also try a compact match ("hyroad" finds "Hy-Road", "iqtour" finds "!Q Tour").
  - Allow one wrong, missing, or extra letter for each word of 5 or more letters.
- Use `matches` in `filterGroups` and in `catalog-list.tsx`.
- Tests: "iq" → "!Q Tour 78/U"; "hyroad" and "hy road" → "Hy-Road"; "phaze" → "Phaze II"; "stom" (one missing letter, only 4 letters) does not match; an empty query matches all.
- Acceptance: `npm test` passes. A browser probe on the stock screen: "iq" shows the !Q Tour row.
- Completion: probe recorded in this plan.

## Rendezvous checks (to fill)

- [ ] `npm test`, `npm run typecheck`, `npx eslint .`, `npm run build`
- [ ] Probe: stock search "iq" and "hyroad" behind sign-in, on staging
- [ ] Probe: scan flow with photo 08 shows no serial and the product code warning
- [ ] Human device check for task 1 after deploy
