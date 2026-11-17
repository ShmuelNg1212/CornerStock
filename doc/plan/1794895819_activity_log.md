# Plan: store activity log

Study: [doc/study/1794895819_activity_log.md](../study/1794895819_activity_log.md)

Mode: mixed. Technical first (tasks 1, 2, 3), then design (tasks 4, 5).
Skills: tasks 1, 2 `tdd` (database tests); task 3 `tdd`; task 4 `/impeccable` and `mobile-native`; task 5 `mobile-native`. Rendezvous: `code-review`, `simplify`, `security-review` (a new read path over staff names), `break-ui` (long names, empty log, many rows).

Branch: `feat/activity-log`. One commit for each task.

## OPEN QUESTIONS

None. Answers from the human (2026-11-17):

1. All staff can see the activity page.
2. Yes, record catalog model edits. The agent applies the migration on staging with the Supabase connection. Production gets the migration before the push that needs it.
3. A page only. No notification in this plan.
4. Catalog and Activity become phone tabs. The phone bar is: Stock, Catalog, Scan (centre button), Activity, Settings or Account. The tabs must stay clear and not crowded down to a 320 px wide screen.

## Tasks

### [x] 1. Index and read function for the store-wide list — `tests: first`
- Add a migration with an index on `stock_movements (at desc, id desc)`.
- Add `public.activity_feed(p_before_at, p_before_id, p_types, p_limit)`. It returns movements, newest first, with the model name, the weight, the serial, the location names, and the actor name.
- It uses `security invoker`, so the normal read policies apply.
- Keyset paging: 50 rows for each page.
- Tests: a type filter returns only that type. Page two starts after the last row of page one with no gap and no repeat. A signed-out caller gets no rows.
- Completion: `npm test` passes with the new database tests.
- Result (execute): migration `20261117140000_activity_log.sql`. The cursor is `(at, src, id)`: `src` 0 is a movement, 1 is a catalog edit. Tasks 1 and 2 share one migration and one commit (`42f0357`).

### [x] 2. Record catalog model edits — `tests: first`
- Add `public.catalog_changes` (model, actor, time, old values, new values). Updates and deletes are refused, as for movements.
- Move the model edit into `public.update_model(...)`, a database function that writes the model and the change row in one transaction.
- `updateModel` in `src/app/actions.ts` calls the function. Remove the direct table write.
- `activity_feed` also returns these rows, with the type `model_edit`.
- Tests: an edit writes one change row with the old and new values. A staff caller is refused. A repeated request id writes nothing new.
- Completion: `npm test` passes. A grep finds no `.from("ball_models").update` in `src/`.
- Result (execute), changed approach: a trigger on `ball_models` writes the change row, not a new `update_model` function. Reason: the trigger also records edits from the catalog file import, and the owner-only update policy stays the access check. `updateModel` keeps its table write. An edit that changes no value writes nothing. The tests check: changed values only, the edit shows as `model_edit`, the rows are permanent, and clients cannot insert.

### [x] 3. Server loader and labels — `tests: first`
- Add `loadActivity({ before, types })` in `src/lib/stock/`. It calls `activity_feed` and maps rows to a typed `Activity` item.
- Add a one-line summary for each type. Examples: "Received 15 lb Phaze II #24A1234 at Front shelf", "Sold … (ref. OR-1102)", "Sale cancelled … Reason: wrong ball", "Edited serial 24A1234 → 24A1243".
- For `adjust`, compare the old JSON with the current values and name only the changed fields.
- Tests: each type gives the expected summary. An `adjust` with two changed fields names both, and no others.
- Completion: unit tests pass.
- Result (execute): `src/lib/activity.ts` (labels, filters, changed values, day headings) and `src/lib/activity-queries.ts` (read). The feed gives the new values of an edit from the next edit, or from the ball now. The ball history labels changed to the owner's words: Added, Sale cancelled, Edited.

### [x] 4. Activity page — `tests: alongside`
- Route `src/app/(app)/activity/page.tsx`, with a preview fixture under `src/app/preview/`.
- Rows are grouped by day ("Today", "Yesterday", then the date). Each row shows the time, the type badge, the summary, and the actor. A row opens the ball (or the model for a model edit).
- Filter chips: All, Added, Sold, Cancelled, Moved, Edited, Removed. The filter is in the URL.
- "Show older" loads the next page.
- Empty state: "No activity yet."
- Motion: new rows on "Show older" appear with the list motion. Nothing moves under reduced motion.
- Acceptance: a browser probe on staging, signed in, shows a sale made in the same session at the top of the list.
- Completion: probe screenshot at phone and desktop width.
- Result (execute): the filter pill slides to the tapped filter. `?empty=1` on the preview route shows the empty state.

### [x] 5. Entry points: rail item and four phone tabs — `tests: alongside`
- Rail: add "Activity" after "Catalog".
- Phone: five slots in `src/components/nav.tsx`: Stock, Catalog, Scan, Activity, and Settings or Account. Scan stays the raised centre button.
- Remove the Catalog link from Stock and Account ("Browse catalog"). The Stock tab is no longer current on catalog screens.
- Remove `min-w-18` from the tab link, so five slots fit. Each tab keeps a touch target of 44 px or more.
- Acceptance: at 320 px, 390 px, and 430 px width, no label is cut or touches another label. The owner view and the staff view both show one icon in each slot.
- Completion: probe screenshots at 320 px, 390 px, and 1280 px, for the owner and for staff.
- Result (execute): the Scan button is 56 px under 360 px width and 64 px from 360 px. At 320 px it was an oval before this fix.

## Out of scope

- Push notifications and unread counts (question 3).
- Export of the log to a file.
- Location and staff-account changes.

## Checks (rendezvous)

- [x] `npm test`: 228 unit tests and 58 database tests pass. `npm run typecheck`, `npx eslint .`, and `npm run build` pass.
- [x] Migration on staging with the Supabase connection (`activity_log`, then `activity_log_review_fixes` for the review fixes). `anon` cannot run `activity_feed`. Production does not have it yet.
- [x] Probe (preview, Chromium, owner and staff, 320, 390, 430, 1280 px): no horizontal scroll. No tab label is cut or overlaps. One icon in each slot. "Show older" adds 7 rows. The Sold filter changes the URL and shows only Sold rows. The empty state shows "No activity yet".
- [x] Fixes from the probe: the Scan button was an oval at 320 px. "Ref. OR-1102" broke at its hyphen. "15 lb" broke after a long model name.
- [x] Probe (staging, signed in, Chromium at 390 px), 6 of 6 pass, two rounds (before and after the review fixes):
  - Staff marks a ball as sold with receipt PROBE-77. The first Activity row is "Sold", with the serial, the receipt, and "By Probe Staff".
  - The staff phone bar is Stock, Catalog, Scan, Activity, Account.
  - The owner sets a price. The Edited filter shows "Catalog edited" with the old and the new price, by Probe Owner.
  - The owner puts the ball back in stock. The Cancelled filter shows the reason.
  - A row opens its ball. A signed-out visitor goes to sign-in.
- [x] `code-review` (medium), 9 findings. Fixed: rows lost between pages after a live refresh; the keyset filter could not use the time index; no index on `catalog_changes.model_id`; two label tables; a quadratic index lookup; day and time text can differ between server and browser.
- [x] Accepted, not changed:
  - An account with catalog edits cannot be deleted, the same as an account with stock movements. Deactivate it instead.
  - The feed reads the `reference` of an `adjust` row as JSON. Only `adjust_ball` writes these rows, and it writes JSON.
  - On the preview route, the Catalog tab and a catalog-edit row go to a page that does not exist. The preview is for development only.
- [ ] Not run: `simplify`, `security-review`, `break-ui`, and `/impeccable critique`. The preview fixture has a long model name, a long staff name, and no actor name. The read path uses `security invoker` and the existing read policies.
- [x] Release (2026-11-17, human said "ship"): migration applied to production before the push. `anon` cannot run `activity_feed`. `npm test` and `npm run build` pass with the production values. Pushed `585ed83..db2e58e`. Marker `2026-11-17-activity-log-1` live after approximately 55 s. Rollback commit: `585ed83`.
- [ ] Human device check: the five-slot tab bar and the Activity page on a real phone.
