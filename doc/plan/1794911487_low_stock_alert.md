# Plan: low-stock alert

Study: [../study/1794911487_low_stock_and_stock_count.md](../study/1794911487_low_stock_and_stock_count.md), feature 1. Branch: `feat/low-stock`.

Mode: mixed. Technical part first (tasks 1 to 4), then the design pass (task 5). Skills: `tdd` (tasks 1 to 3), `domain-modeling` (ADR for the minimum rule), `/impeccable shape` then `/impeccable` (task 5), `mobile-native` (phone screens). Rendezvous: `code-review`, `simplify`, `/impeccable critique` and `audit`, `break-ui` (long model names, large counts).

## OPEN QUESTIONS

1. One minimum for each model and weight, which applies to each location (recommended)? Or a different minimum for each location?
2. Who sets the minimum: the owner only (recommended, same as other catalog edits), or all staff?
3. An alert in the app only (recommended)? Or also a message to the owner (email or push)? A message needs a new service and is a separate plan.

## Goal

The owner sees in the stock view which models and weights are low or out of stock, in each location.

## Rules (to confirm, then record in an ADR)

- A model-weight has an optional minimum (0 to 99). No minimum means no alert.
- In one location: in stock less than the minimum is "Low". 0 in stock with a minimum of 1 or more is "Out".
- In "All locations": a model-weight is low when any active location is low.

## Tasks

- [ ] **1. Minimum in the database.** `tests: first`
  - Migration: add `ball_models.min_in_stock smallint null check (min_in_stock between 0 and 99)`.
  - Add a view `low_stock` (security invoker): one row for each model and active location where the minimum is set and the in-stock count is less than the minimum. Columns: `model_id`, `location_id`, `in_stock`, `min_in_stock`. It includes locations with 0 balls.
  - The catalog edit log records a change of the minimum (`record_catalog_change`).
  - Acceptance (database tests): a model with a minimum of 2 and 1 ball in location A, 3 in location B, gives one row (A). A minimum with 0 balls in a location gives a row with `in_stock` 0. No minimum gives no row. An inactive location gives no row. A staff account cannot change the minimum (row-level security). The edit log has the old and new value.
  - Done when: `npm test` passes.

- [ ] **2. Owner sets the minimum.** `tests: first` for the validation, `tests: alongside` for the form.
  - Add the field "Keep in stock (each location)" to the owner model edit. Empty clears the minimum.
  - Catalog import: an optional column `min_in_stock`. The review shows the old and new value. The catalog export includes the column.
  - Acceptance: unit tests for the field validation (empty, 0, 99, 100, text). An import test with the new column. A browser probe: the owner sets 2, the model page shows "Keep 2".
  - Done when: tests and the probe pass.

- [ ] **3. Low-stock data for the stock view.** `tests: first`
  - The stock layout reads `low_stock` for the selected location, or all locations.
  - Out-of-stock model-weights with a minimum join the list, with a count of 0.
  - A pure function gives the status of each model-weight: `ok`, `low`, `out`.
  - Acceptance: unit tests for the status function and for the join of out-of-stock rows.
  - Done when: `npm test` passes.

- [ ] **4. Filter and address.** `tests: alongside`
  - A pill "Low stock" with the count. The address keeps the filter (`?low=1`).
  - Acceptance: the probe opens `/?low=1` and sees only the low model-weights.
  - Done when: the probe passes.

- [ ] **5. Design pass.** `tests: alongside`
  - Run `/impeccable shape` for: the "Low stock" tile, the pill, the "Low" and "Out" marks on a model card, and the minimum on the model page.
  - Status marks use a label and an icon, not color alone. Motion only on a state change, none under reduced motion.
  - Acceptance: screenshots at 390 × 844 and 1280 × 800 with no overflow. The design checks are recorded here.
  - Done when: the design pass is recorded.

## Out of scope

- A message to the owner outside the app (question 3).
- A different minimum for each location (question 1), unless the human selects it.
- Purchase orders or a suggested order quantity.

## Completion

All tasks ticked. `npm test`, `npm run typecheck`, `npx eslint .`, and `npm run build` pass. ADR written. The wiki spec states the low-stock rules.
