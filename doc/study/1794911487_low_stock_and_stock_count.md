# Study: low-stock alert and stock count

Date: 2026-11-17. Source: items 1 and 2 of [1794907617_feature_ideas.md](1794907617_feature_ideas.md). The human asked to start them on 2026-11-17.

Deferred: the slow scan of some boxes (15 to 30 s on some labels). The probable cause is glare on glossy labels. The human deferred it. Next step when it resumes: get 2 or 3 screenshots of the `?debug=1` panel and photos of the slow labels.

## Current model (facts from the code)

- `ball_models`: one row for each UPC. A UPC is one model at one weight. The stock view groups the rows by model name and shows a count for each weight.
- `balls`: one row for each ball, with `serial`, `model_id`, `location_id`, and `status` (`in_stock`, `sold`, `removed`).
- `stock_counts`: a view with the in-stock count for each model row and location.
- Each stock change goes through a database function (`receive_ball`, `sell_ball`, `transfer_ball`, `remove_ball`, `reverse_sale`, `adjust_ball`). Each writes a row in `stock_movements`, and the activity log shows it.
- Roles: owner and staff. Only the owner edits the catalog and removes a ball.
- Each location has its own stock. The stock view shows one location or all locations.

## Feature 1: low-stock alert

### What it does

The owner sets a minimum for a model at a weight, for example "Phaze II 15 lb: keep 2". When the stock in a location is less than the minimum, the stock view marks that model and weight as low.

### Design proposal

- Data: a new nullable column `ball_models.min_in_stock` (0 to 99). Null means "no minimum".
- The minimum applies to each location. A location with fewer balls than the minimum is low. A location with 0 balls and a minimum is "Out of stock".
- The owner sets the minimum on the model page, in the existing owner edit. A catalog import can also set it (a new optional column). The change is recorded in the catalog edit log.
- Stock view:
  - A fifth summary tile, "Low stock", with the count of low model-weights in the selected location. A tap filters the list.
  - A filter pill "Low stock".
  - On a model card, a low weight shows a label and an icon ("Low", "Out"), not color alone (brand rule).
- In "All locations", a model-weight is low when any active location is low. The model page shows which location.
- Out-of-stock models: the stock view now shows only models with stock. A model at 0 with a minimum must show in the "Low stock" filter, or the alert misses the worst case.

### Open points

1. Is one minimum for all locations enough, or does each location need its own minimum?
2. Can staff set the minimum, or the owner only?
3. Is an alert in the app enough, or must the owner also get a message (email, push)?

## Feature 2: stock count

### What it does

A staff member selects a location and scans every ball on the shelf. The app compares the scans with the records of that location. It shows three lists: found, missing (recorded but not scanned), and unexpected (scanned but not recorded here).

### Design proposal

- A count is a record on the server: location, who started it, start time, status (open, finished, cancelled). Each scan adds a row: count, serial, who, when. Two staff can count one location together on two phones, and a page reload does not lose the scans.
- Name: "stock count" in the interface. The table name must not collide with the existing view `stock_counts`. Proposal: `counts` and `count_scans`.
- The scan uses the batch viewfinder. A count needs only the serial number, not the UPC. The capture can thus use the serial alone, confirmed in 2 frames. This is faster than the intake scan.
- Each scan shows at once: "Found", "Not in this location (recorded in X)", "Sold", "Removed", or "Not recorded".
- The comparison runs at the finish, against the stock at that time. A ball sold during the count is not missing.
- Results:
  - Found: no action.
  - Missing: the owner can mark it removed, with the reason "Not found in the stock count". This uses `remove_ball`.
  - In a different location: one tap moves it here. This uses `transfer_ball`.
  - Sold or removed but found: the owner reviews it. A sold ball uses `reverse_sale`.
  - Not recorded: the normal scan intake adds it.
- No result changes stock without a tap. Each action goes through the existing database functions, so the activity log records it.
- The finished count stays as a record: date, location, who counted, and the three totals.

### Open points

4. Does a count cover the whole location, or can it cover a part (for example one brand or one shelf)?
5. Who can finish a count and apply the corrections: staff, or the owner only?
6. Is the record of past counts necessary, or is the result screen enough?

## Order

The low-stock alert is smaller: one column, one filter, one tile. The stock count needs two tables, new database functions, a scan mode, and a result screen. Recommendation: build the low-stock alert first, then the stock count. Each has its own plan and release.

## Design

Both features change product screens. After the human answers the open points, run `/impeccable shape` for the stock view changes and for the count screens. PRODUCT.md and DESIGN.md exist.
