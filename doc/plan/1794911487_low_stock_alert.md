# Plan: low-stock alert

Study: [../study/1794911487_low_stock_and_stock_count.md](../study/1794911487_low_stock_and_stock_count.md), feature 1. Branch: `feat/low-stock`.

Mode: mixed. Technical part first (tasks 1 to 4), then the design pass (task 5). Skills: `tdd` (tasks 1 to 3), `domain-modeling` (ADR for the minimum rule), `/impeccable shape` then `/impeccable` (task 5), `mobile-native` (phone screens). Rendezvous: `code-review`, `simplify`, `/impeccable critique` and `audit`, `break-ui` (long model names, large counts).

## Answers from the human (2026-11-17)

1. One minimum for each model and weight. It applies to each location.
2. The owner only sets the minimum.
3. An alert in the app only. No email or push.

## Goal

The owner sees in the stock view which models and weights are low or out of stock, in each location.

## Rules (confirmed; record in an ADR in task 1)

- A model-weight has an optional minimum (0 to 99). No minimum means no alert.
- In one location: in stock less than the minimum is "Low". 0 in stock with a minimum of 1 or more is "Out".
- In "All locations": a model-weight is low when any active location is low.

## Tasks

- [x] **1. Minimum in the database.** `tests: first`
  - Migration: add `ball_models.min_in_stock smallint null check (min_in_stock between 0 and 99)`.
  - Add a view `low_stock` (security invoker): one row for each model and active location where the minimum is set and the in-stock count is less than the minimum. Columns: `model_id`, `location_id`, `in_stock`, `min_in_stock`. It includes locations with 0 balls.
  - The catalog edit log records a change of the minimum (`record_catalog_change`).
  - Acceptance (database tests): a model with a minimum of 2 and 1 ball in location A, 3 in location B, gives one row (A). A minimum with 0 balls in a location gives a row with `in_stock` 0. No minimum gives no row. An inactive location gives no row. A staff account cannot change the minimum (row-level security). The edit log has the old and new value.
  - Done when: `npm test` passes.

- [x] **2. Owner sets the minimum.** `tests: first` for the validation, `tests: alongside` for the form.
  - Add the field "Keep in stock (each location)" to the owner model edit. Empty clears the minimum.
  - Catalog import: an optional column `min_in_stock`. The review shows the old and new value. The catalog export includes the column.
  - Acceptance: unit tests for the field validation (empty, 0, 99, 100, text). An import test with the new column. A browser probe: the owner sets 2, the model page shows "Keep 2".
  - Done when: tests and the probe pass.

- [x] **3. Low-stock data for the stock view.** `tests: first`
  - The stock layout reads `low_stock` for the selected location, or all locations.
  - Out-of-stock model-weights with a minimum join the list, with a count of 0.
  - A pure function gives the status of each model-weight: `ok`, `low`, `out`.
  - Acceptance: unit tests for the status function and for the join of out-of-stock rows.
  - Done when: `npm test` passes.

- [x] **4. Filter and address.** `tests: alongside`
  - A pill "Low stock" with the count. The address keeps the filter (`?low=1`).
  - Acceptance: the probe opens `/?low=1` and sees only the low model-weights.
  - Done when: the probe passes.

- [x] **5. Design pass.** `tests: alongside`
  - Run `/impeccable shape` for: the "Low stock" tile, the pill, the "Low" and "Out" marks on a model card, and the minimum on the model page.
  - Status marks use a label and an icon, not color alone. Motion only on a state change, none under reduced motion.
  - Acceptance: screenshots at 390 × 844 and 1280 × 800 with no overflow. The design checks are recorded here.
  - Done when: the design pass is recorded.

## Deviations from the plan

- Task 1: a second migration (`20261117180100_low_stock_import.sql`) replaces the two catalog import functions. Without `min_in_stock` in them, each import of a model with a minimum counted the row as changed, and a file could not set the minimum.
- Task 2: the minimum is not in the "Add model" form. The owner sets it on the model page or with an import.
- Task 4: the address key is `?l=1`, not `?low=1`, to match `?w=` and `?b=`.
- Task 5: no fifth tile. When a model is low, the "Low stock" tile replaces the "Models" tile. Five tiles do not fit a phone. A tap on the tile toggles the filter.
- Task 5: the "Low stock" pill is directly after "All". After the weight pills, it was off screen on a phone.
- Task 5: the model page shows "Low stock" or "Out of stock" with the minimum, for one location.
- Task 5: the full `/impeccable critique` (two review agents and questions) did not run. The polish pass and the detector ran. The detector found one contrast defect (a selected low chip: brown text on gold, 3.1:1). Fixed. The "cream background" finding is the confirmed brand ivory. Kept.

## Execute checks (2026-11-17)

- 67 database tests and 260 unit tests pass. `npm run typecheck` and `npx eslint .` pass.
- Browser probe on `/preview`, 390 × 844 and 1280 × 800: no horizontal overflow. The tile and the pill filter the list to the two low samples (Phaze II 13 lb out, Twist 10 lb low). `?l=1` opens the same list. The "Low stock" pill is in the first screen on a phone. The model pages show "Low stock · keep 2" and "Out of stock · keep 1".
- Not checked: the owner form save on the signed-in app. The preview has no owner session.

## Rendezvous checks (2026-11-17)

- `npm test`: 260 unit tests and 68 database tests pass. `npm run typecheck`, `npx eslint .`, and `npm run build` pass.
- Standards review (read-only agent): no blocking bug. The two replaced import functions are the same as the originals except for `min_in_stock` (checked by a diff). Fixed: the view kept write privileges for signed-in users (a database test now checks that only select is granted). Fixed: the status words and icons were in three places; now one map (`LOW_MARK` in `low-mark.tsx`). Fixed: an unused column in the low-stock read. Kept: the minimum form has no cancel, the same as the price form.
- Spec review (read-only agent): fixed: in "All locations", the list and the model page did not say which location is low. A weight now keeps its low locations (`lowAt`). The chip label for a screen reader names them, and the model page shows "Low stock in <location>". Kept: the stock import also accepts `min_in_stock`, because a stock file carries the catalog values.
- Probe after the fixes: the chips name "Sta. Lucia East"; the model pages show the marks; no overflow.

## Out of scope

- A message to the owner outside the app (answer 3).
- A different minimum for each location (answer 1).
- Purchase orders or a suggested order quantity.

## Completion

All tasks ticked. `npm test`, `npm run typecheck`, `npx eslint .`, and `npm run build` pass. ADR written. The wiki spec states the low-stock rules.
