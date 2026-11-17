# Study: store activity log

Date: 2026-11-17. Source: the human noticed that no page shows when a ball is added, edited, sold, cancelled, or removed.

## What exists

- Each stock change writes one row in `public.stock_movements` (`supabase/migrations/20261116000000_ball_stock.sql:70`). The row has the ball, the type, the from and to locations, the actor, the time, the reason, and the reference.
- The rows are permanent. A trigger refuses update and delete (`forbid_movement_change`).
- The types are `receive`, `sell`, `reverse_sale`, `transfer`, `adjust`, and `remove`. These match the human's list: added, sold, cancelled (reverse sale), edited (adjust), removed. Moved (transfer) is also recorded.
- `adjust` keeps the old values as JSON in `reference`. The new values are on the ball.
- All signed-in staff can read the rows (policy `staff_read`).
- The only view of the rows is the History section of one ball (`src/components/stock/ball-view.tsx:78`). No page shows the rows of all balls.
- The only index is `(ball_id, at)`. A store-wide list sorted by time needs an index on `at`.

## Gaps

1. No store-wide list. This is the main gap. The data is complete for balls.
2. Catalog model edits are not recorded. `updateModel` in `src/app/actions.ts:267` writes `ball_models` directly. No row records who changed a price or a name, or the old value.
3. Catalog imports have a batch record (`catalog_import_batches`), but stock imports write normal movements. They already show.
4. No notification. Nothing tells the owner about a change when the owner is not on the page.

## Constraints

- The phone tab bar has three items. The owner complained about crowded icons in the last release. A fourth tab is a risk.
- The rail on large screens has room for one more item.
- Stock changes stay in database functions. A model-edit log must also be written in the database, not from the client.

## Options for the phone entry point

- A: a link on the Stock screen, as "Browse catalog" is now. No change to the tab bar.
- B: a fourth tab. More direct, but it reopens the crowding problem.
- C: a link in Settings and Account only. Hidden, but quiet.

Recommendation: A, plus a rail item on large screens.
