# Sales report plan

Study [sales report](../study/1795163398_sales_report.md). Implementation branch `feat/sales-report`.

Technical mode. Use the existing app components. Use `tdd` for the sale and report rules, `domain-modeling` for the approved rules, and `mobile-native` for the phone view. At rendezvous use `code-review` and `break-ui`. Review database access as part of the code review.

## Approved rules

The owner approved this plan on 2026-11-20. See [sales report rules](../adr/0006-sales-report-rules.md).

1. Save the catalog selling price when each sale occurs. Label the result **Sales value at catalog prices**. Include old sales in the unit counts. Show how many sales have no saved price.
2. The owner opens the report from Activity. Keep the sale price records out of the staff activity log.
3. A cancellation removes a sale from its original period. A resale is a separate sale.

## Goal

The owner can choose a day, week, or month and see balls sold by model and weight. The owner can see the totals for the store or for one location.

## Tasks

- [x] **1. Save the catalog price during a sale.** `tests: first`
  - Add a private sale price table keyed to the sale movement. Update the existing `sell_ball` function to save the catalog price in the same transaction. Keep the current function arguments and receipt behavior.
  - Acceptance: a priced sale, a zero price, and an unset price keep their distinct values. A later catalog edit does not change a saved price. A repeated request does not add a price row. A failed sale writes no price row. Staff and anonymous users cannot read the private table.
  - Done when the database tests pass for each case and the existing sale tests pass.

- [x] **2. Read the report for the chosen period.** `tests: first`
  - Add an owner-checked database function. Group uncancelled sales by model and weight. Return units sold, known sales value, and the number with no saved price. Use the location on the sale movement. Match cancellations by sale order for each ball, including cancellations after the period ends. Use exact decimal arithmetic for the sums.
  - Validate the period and date in the server query. Use Manila calendar dates, Monday through Sunday for a week, and half-open time ranges. Show all locations by default. Include inactive locations that have sales history in the location choices.
  - Acceptance: tests cover Manila midnight, the week and month boundaries, location filters, missing and zero prices, a cancellation in a later period, and resale at a different location. A staff or anonymous request cannot get the report. The totals cover all report rows even when there are more rows than the API returns by default.
  - Done when the database and unit tests pass for each case.

- [x] **3. Add the Sales report page.** `tests: alongside`
  - Add an owner-only link on Activity and a server-rendered report. Default to the current Manila month. Add Day, Week, and Month controls, a date control, and a location filter. Preserve the selection in the address.
  - Show total balls sold, sales value at catalog prices, and the count of sales without a saved price. Show the same figures for each model and weight. Give an empty period a clear message. Show an unavailable amount as such when every sale lacks a saved price.
  - Acceptance: an owner can enter the report from Activity, select a period and location, and reload the same selection. At phone and desktop widths, long model names and large totals fit. A staff account cannot open the report by its address.
  - Done when signed-in browser checks pass on a phone width and a desktop width.

## Rendezvous and sync

- Run `npm test`, `npm run typecheck`, `npx eslint .`, and `npm run build`. Review the sale transaction, amount visibility, and cancellation rules.
- In a signed-in test environment, record a sale through the normal scan flow. Open the report as owner. Check the model, weight, location, and saved amount. Cancel the sale and check the report again. Use a staff session to check access.
- Record the approved reporting rules in an ADR and sync `doc/wiki/spec.md` after implementation. Record the checks here before freezing the plan.

## Checks on 2026-11-20

- `npm test` passed with 279 unit tests and 91 database tests. Typecheck, ESLint, and the production build passed.
- The standards and spec reviews found two formatting errors. The page now keeps exact cents when it formats a large total and uses UTC to display the report dates. Tests cover both fixes. The database review confirmed owner checks and tested a sale during a stock import.
- Signed-in Chrome used the production build with a local test database. The owner scanned a label photo and sold the ball. Activity opened the report with the correct model, weight, location, and price. The period and location stayed selected after reload. Cancelling the sale removed it from the report. A staff account saw no link and could not open the report address.
- Chrome layout checks covered 320, 390, 700, and 1280 px. A 120-character model name, a value of ₱19,999,999,980.00, and a missing price fit in the report. The date and amount had room at 320 px after a layout fix. No physical phone was used.
- The implementation stays on `feat/sales-report` pending release approval. The migration ran in local test databases.

## Scope

This plan covers the in-app ball sales report. It leaves receipt reconciliation, export, and profit reporting for separate work.
