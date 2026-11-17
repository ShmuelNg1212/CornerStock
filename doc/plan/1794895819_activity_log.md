# Plan: store activity log

Study: [doc/study/1794895819_activity_log.md](../study/1794895819_activity_log.md)

Mode: mixed. Technical first (tasks 1, 2, 3), then design (tasks 4, 5).
Skills: tasks 1, 2 `tdd` (database tests); task 3 `tdd`; task 4 `/impeccable` and `mobile-native`; task 5 `mobile-native`. Rendezvous: `code-review`, `simplify`, `security-review` (a new read path over staff names), `break-ui` (long names, empty log, many rows).

Branch: `feat/activity-log`. One commit for each task.

## OPEN QUESTIONS

1. Who can see the activity page: the owner only, or all staff? Staff can already read each ball's history. Recommendation: all staff, because the data is already visible to them.
2. Do you want catalog model edits (name, price, details) in the log too? This needs a new database table and a migration (task 2). Recommendation: yes.
3. Is a page enough, or do you also want a notification (an unread count, or a push message to the owner's phone)? Recommendation: the page only in this plan. A push message is a separate plan.
4. Where does the page open on a phone? A: a link on the Stock screen, as "Browse catalog" is now. B: a fourth tab. Recommendation: A. On large screens, the page gets a rail item in both cases.

## Tasks

### [ ] 1. Index and read function for the store-wide list — `tests: first`
- Add a migration with an index on `stock_movements (at desc, id desc)`.
- Add `public.activity_feed(p_before_at, p_before_id, p_types, p_limit)`. It returns movements, newest first, with the model name, the weight, the serial, the location names, and the actor name.
- It uses `security invoker`, so the normal read policies apply.
- Keyset paging: 50 rows for each page.
- Tests: a type filter returns only that type. Page two starts after the last row of page one with no gap and no repeat. A signed-out caller gets no rows.
- Completion: `npm test` passes with the new database tests.

### [ ] 2. Record catalog model edits — `tests: first` (only if question 2 is yes)
- Add `public.catalog_changes` (model, actor, time, old values, new values). Updates and deletes are refused, as for movements.
- Move the model edit into `public.update_model(...)`, a database function that writes the model and the change row in one transaction.
- `updateModel` in `src/app/actions.ts` calls the function. Remove the direct table write.
- `activity_feed` also returns these rows, with the type `model_edit`.
- Tests: an edit writes one change row with the old and new values. A staff caller is refused. A repeated request id writes nothing new.
- Completion: `npm test` passes. A grep finds no `.from("ball_models").update` in `src/`.

### [ ] 3. Server loader and labels — `tests: first`
- Add `loadActivity({ before, types })` in `src/lib/stock/`. It calls `activity_feed` and maps rows to a typed `Activity` item.
- Add a one-line summary for each type. Examples: "Received 15 lb Phaze II #24A1234 at Front shelf", "Sold … (ref. OR-1102)", "Sale cancelled … Reason: wrong ball", "Edited serial 24A1234 → 24A1243".
- For `adjust`, compare the old JSON with the current values and name only the changed fields.
- Tests: each type gives the expected summary. An `adjust` with two changed fields names both, and no others.
- Completion: unit tests pass.

### [ ] 4. Activity page — `tests: alongside`
- Route `src/app/(app)/activity/page.tsx`, with a preview fixture under `src/app/preview/`.
- Rows are grouped by day ("Today", "Yesterday", then the date). Each row shows the time, the type badge, the summary, and the actor. A row opens the ball (or the model for a model edit).
- Filter chips: All, Added, Sold, Cancelled, Moved, Edited, Removed. The filter is in the URL.
- "Show older" loads the next page.
- Empty state: "No activity yet."
- Motion: new rows on "Show older" appear with the list motion. Nothing moves under reduced motion.
- Acceptance: a browser probe on staging, signed in, shows a sale made in the same session at the top of the list.
- Completion: probe screenshot at phone and desktop width.

### [ ] 5. Entry points — `tests: alongside`
- Rail: add "Activity" after "Catalog".
- Phone: as chosen in question 4.
- Acceptance: on a 390 px wide screen, the tab bar is unchanged (if option A) and the link opens the page.
- Completion: probe at 390 px and 1280 px.

## Out of scope

- Push notifications and unread counts (question 3).
- Export of the log to a file.
- Location and staff-account changes.

## Checks (rendezvous)

To be filled in.
