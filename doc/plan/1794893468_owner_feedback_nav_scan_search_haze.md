# Plan: tab bar, serial mix-up, search, and top haze

Study: [doc/study/1794893468_owner_feedback_nav_scan_search_haze.md](../study/1794893468_owner_feedback_nav_scan_search_haze.md)

Mode: mixed. Technical first (tasks 2, 3, 4, 6), then design (task 5).
Skills: tasks 2, 3, 6 `tdd`; task 4 `tdd` (database test); task 5 `diagnosing-bugs`, `mobile-native`. Rendezvous: `code-review`, `simplify`, `break-ui` (search with odd input).

Branch: `fix/owner-feedback-nov17`. One commit for each task.

## OPEN QUESTIONS

None. Answers from the human (2026-11-17):

1. The tab bar fault is in the **staff** view. A staff screenshot shows the Settings icon and the Account icon on top of each other in the third tab.
2. All labels are from the Storm group for now. The human sends other label styles when the shop gets them. Task 2 uses the Storm forms only.
3. The human likes the status bar as it is. Do not change `statusBarStyle`. Task 1 is dropped. The grey gradient is drawn by iOS 26.1 and later over a `black-translucent` bar. CSS cannot remove it. This is a known limit, not a fault in the app.

## Tasks

### [-] 1. Remove the iOS haze — DROPPED
- The human keeps the current status bar (answer 3). No change.

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

### [ ] 5. Fix the stacked icons in the staff tab bar — `tests: alongside`
- Cause (to confirm in execute with the preview shell): the third tab swaps its icon in `AnimatePresence mode="popLayout"`, keyed by the label. When `owner` changes while the app is open, the Settings icon starts an exit and stays on screen next to the new Account icon.
- Fix: give the third tab a `key` from its route, so that a role change mounts a new tab with no exit. Keep the icon swap animation only on the Stock/Back tab, where the cause is a navigation.
- Check the Stock/Back tab for the same fault: go to a model and back fast, several times.
- Acceptance: in the preview shell, a change from owner to staff shows only the Account icon. At 320, 375, and 430 px wide, no icon or label overlaps another or the scan button.
- Completion: probe screenshots before and after the role change, at the three widths.

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
- [ ] Probe: preview shell, owner to staff, third tab shows one icon
