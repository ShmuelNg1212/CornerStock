# Feature ideas

Date: 2026-11-17. Status: ideas only. Nothing here is approved. Each idea needs its own study and plan before work starts.

## Basis

The main function is seamless recording of ball stock, a live stock view, and intake by a scan. The list below excludes what is built: scan intake, batch scan, sale from a scan, catalog, file import and export, and the activity log. See [../wiki/spec.md](../wiki/spec.md), section "Built".

## High value, near the current scope

1. **Stock count.** Select a location. Scan all balls on the shelf. The app shows missing balls (recorded, not scanned) and unexpected balls (scanned, not recorded). Batch scan already supplies most of the flow.
2. **Low-stock alert.** The owner sets a minimum quantity for each model and weight. The stock view shows a "Low stock" pill and a tile for low items. The spec proposes this (first-version scope, item 5).
3. **Scan reliability.** Scan capture fails intermittently. Add a diagnostic view: camera resolution, frame read time, sharpness, and which barcode failed. Then adjust the thresholds. The current thresholds came from ten still photos. Do this before new features.
4. **Sales report.** Balls sold each day, week, or month, by model and weight. Use the selling price for revenue.
5. **Stock age.** List balls in stock for more than 90 or 180 days. The owner can then reduce the price or move them to a different location.

## Medium value

6. **Hold for a customer.** A deposit holds a ball. The ball stays on hand but is not available for sale. The spec proposes on-hand, reserved, and available quantities (first-version scope, item 4).
7. **Batch transfer.** Scan a group of balls and send them to a different location. The receiving location confirms the arrival.
8. **Purchase orders and suppliers.** Record an order to a supplier. Compare the scanned intake with the order. The app shows a short shipment. The spec proposes this (first-version scope, item 6).
9. **Customer on a sale.** An optional customer name on a sale. This helps with drilling records and warranty claims.

## Later, or blocked by an open question

10. Shoes, bags, and accessories. These use quantities, not serial numbers. This is a larger model change.
11. A manager role. Open question in the spec.
12. Offline operation. Open question in the spec. Needs a sync and conflict design.
13. Checkout integration. Open question in the spec.

## Recommended order

Do item 3 first. Then items 1 and 2. Each fits one small plan.
