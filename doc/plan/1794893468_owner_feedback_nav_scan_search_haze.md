# Plan: tab bar, serial mix-up, search, and top haze

Study: [doc/study/1794893468_owner_feedback_nav_scan_search_haze.md](../study/1794893468_owner_feedback_nav_scan_search_haze.md)

Mode: mixed. Technical first (tasks 2, 3, 4, 6), then design (tasks 5, 1).
Skills: tasks 2, 3, 6 `tdd`; task 4 `tdd` (database test); task 5 `diagnosing-bugs`, `mobile-native`; task 1 `mobile-native`. Rendezvous: `code-review`, `simplify`, `break-ui` (search with odd input).

Branch: `fix/owner-feedback-nov17`. One commit for each task.

## OPEN QUESTIONS

None. Answers from the human (2026-11-17):

1. The tab bar fault is in the **staff** view. A staff screenshot shows the Settings icon and the Account icon on top of each other in the third tab.
2. All labels are from the Storm group for now. The human sends other label styles when the shop gets them. Task 2 uses the Storm forms only.
3. The human first kept the status bar, then chose the solid bar (second answer, same day). Task 1 is active again. The owner and the staff must delete the home-screen app and add it again.

## Tasks

### [ ] 1. Remove the iOS haze with a solid status bar — `tests: alongside`
- Set `statusBarStyle` to `"default"` in `src/app/layout.tsx`.
- Remove the navy safe-area band in `layout.tsx` and the safe-area top padding in `shell.tsx` only if they then show a double gap.
- Change the release marker.
- Acceptance: on an iPhone with iOS 26.1 or later, a fresh home-screen install shows no grey gradient at the top. The status bar is solid. Nothing moves under it during a scroll.
- Completion: a device screenshot from the human after deploy (the agent cannot run a real iPhone).
- Result (execute): `statusBarStyle: "default"`. The production build has `content="default"` on all 19 prerendered pages. The safe-area band and padding stay: with a solid bar, the top safe-area inset is 0, so they take no space. Waiting for the device check.

### [x] 2. Classify scan codes by shape before position — `tests: first`
- In `src/lib/label/barcodes.ts`, add `codeShape(text)`: `"serial"` (2 digits, then a letter), `"product"` (starts with a letter), or `"unknown"`.
- `classifyBarcodes` uses the shape first. It uses the position only when the shapes do not decide.
- A code with the product shape never goes into the serial number automatically.
- Tests: photo 08 (product code above the UPC) gives `serial: null`. No UPC with only a product code gives `serial: null`. All 10 fixtures keep or improve their current result.
- Acceptance: `npm test` passes, with the new cases.
- Completion: the fixture test reads photo 08 and gives `product_code: "BBMRTQ15L"`, `serial: null`.

### [x] 3. Check the serial against the catalog — `tests: first`
- `lookupLabel` also returns `serialIsProductCode: true` when the scanned serial is equal to the `product_code` of any model.
- `readLabel` in `use-scan.ts` then moves the value to the product code, clears the serial, and shows: "This is the product code. Scan or type the serial number."
- The confirm screen shows the same warning when a typed or edited serial is equal to the product code field.
- The live viewfinder does not auto-capture a frame whose serial has the product shape.
- Acceptance: a unit test for the move. A browser probe: a scan of a known model whose product code reads as the serial does not save.
- Completion: probe recorded in this plan.

### [x] 4. Refuse a product code as a serial in the database — `tests: first`
- New migration: `receive_ball` and the ball correction function raise an error when the serial is equal to the `product_code` of the label or of any model.
- The server action shows the error as a field error on the serial number.
- Acceptance: a database test that a call with `serial = product_code` fails and writes no ball and no movement.
- Completion: `npm test` passes, the database tests included.

### [x] 5. Fix the stacked icons in the staff tab bar — `tests: alongside`
- Cause (to confirm in execute with the preview shell): the third tab swaps its icon in `AnimatePresence mode="popLayout"`, keyed by the label. When `owner` changes while the app is open, the Settings icon starts an exit and stays on screen next to the new Account icon.
- Fix: give the third tab a `key` from its route, so that a role change mounts a new tab with no exit. Keep the icon swap animation only on the Stock/Back tab, where the cause is a navigation.
- Check the Stock/Back tab for the same fault: go to a model and back fast, several times.
- Acceptance: in the preview shell, a change from owner to staff shows only the Account icon. At 320, 375, and 430 px wide, no icon or label overlaps another or the scan button.
- Completion: probe screenshots before and after the role change, at the three widths.

- Result (execute): the third tab has a `key` from its route. The Stock/Back tab keeps both icons mounted in one grid cell and changes only opacity and scale. No icon change depends on an exit animation now.
- Probe (WebKit, preview shell, new cookie `preview-role`): owner and staff at 320, 375, and 430 px show one icon in the third tab and no overlap. An owner-to-staff change on an open page shows one icon. Five fast Stock/Back swaps end with one icon.
- Not reproduced: the same probes pass on the old code too, also with a role change while the shell is hidden (`/preview/login`). The stack in the human's screenshot needs the phone's hidden-page path. The fix is structural: two icons cannot stack in a column now. Confirm on the phone after deploy.

### [x] 6. Make the search forgiving — `tests: first`
- New `src/lib/search.ts` with `matches(text, query)`:
  - Fold case and accents (NFKD).
  - Fold look-alikes: `!`, `|`, and `¡` → `i`. (Changed in execute: digits are not folded. Model names have real digits, for example "78/U", and a fold gives false matches.)
  - Remove spaces and punctuation, then also try a compact match ("hyroad" finds "Hy-Road", "iqtour" finds "!Q Tour").
  - Allow one wrong, missing, or extra letter for each word of 5 or more letters.
- Use `matches` in `filterGroups` and in `catalog-list.tsx`.
- Tests: "iq" → "!Q Tour 78/U"; "hyroad" and "hy road" → "Hy-Road"; "phaze" → "Phaze II"; "stom" (one missing letter, only 4 letters) does not match; an empty query matches all.
- Acceptance: `npm test` passes. A browser probe on the stock screen: "iq" shows the !Q Tour row.
- Completion: probe recorded in this plan.

## Rendezvous checks (2026-11-17)

- [x] `npm test`: 218 unit tests and 51 database tests pass. `npm run typecheck` and `npx eslint .` are clean. `npm run build` passes.
- [x] Review: two read-only reviewers (standards, spec). Round 1 fixes (commit 6e3f979):
  - The search gave one wrong digit to codes (a UPC with one wrong digit matched another UPC). Now a word with a digit must match exactly. Test added.
  - A moved product code was erased when the catalog model had no product code. Fixed in `readLabel`.
  - The read message and the field error now use the same text.
- [x] Accepted, not changed:
  - The database trigger checks the catalog, not the label's own product code when the model already exists. The server action refuses that case with `validateLabel`.
  - An owner can change a model's product code to the serial of an existing ball. The trigger checks only ball writes. This is rare and owner-only.
  - The compact search matches across word boundaries ("hyroad" needs this).
- [x] Probe (staging, staff account, WebKit at 390 px, real scan flow), 10 of 10 pass:
  - Photo 08 leaves the serial number empty, and the product code is BBMRTQ15L.
  - A typed serial equal to the product code shows "This is the product code. Scan or type the serial number." No ball is written.
  - A real serial saves. Photo 09 reads its serial number.
  - The stock search finds "!Q Tour 78/U" for "iq" and "IQ TOUR", and "Hy-Road" for "hyroad" and "hy road". The old search fails all four.
- [x] Probe (preview shell): see task 5.
- [ ] Migration `20261117120000_serial_not_product_code.sql` on staging and production. The human runs it in the SQL Editor before the push.
- [ ] Release marker: set at the push.
- [ ] Human device check after deploy: a fresh home-screen install shows a solid status bar with no grey gradient, and the staff tab bar shows one icon.
