# Sales report study

Date 2026-11-20. This study proposes a report for bowling ball sales.

## Need

The [feature ideas](1794907617_feature_ideas.md) propose daily, weekly, and monthly sales by model and weight. The report also needs a peso amount based on the selling price.

## Current data

- The ball page, single scan, and batch scan use the same `sell_ball` function. It marks the ball sold and writes one permanent movement. The movement has the sale time, the location, and an optional receipt number. See [the stock migration](../../supabase/migrations/20261116000000_ball_stock.sql).
- The catalog has one optional selling price for each model and weight. The owner can change the price. A sale has no amount from the receipt. [The catalog edit log](../../supabase/migrations/20261117140000_activity_log.sql) records price edits after the log was installed. It does not record what a customer paid.
- A cancellation puts the ball back in stock and writes a separate movement. A ball can sell again. Pair a cancellation with its sale in movement order. Use the location of each sale even if staff move the ball later.
- The stock screen counts today's sales in Manila time. Its [summary rule](../../src/lib/stock/today.ts) only subtracts a sale cancelled on the same day. It does not give historical totals.
- Staff can read the movement log through the database. An owner-only report needs a separate owner check in the database. If the price at sale is private, keep its record outside the staff-readable log.

## Recommended rules

- Save the catalog price at the time of each new sale. Save it in the same transaction as the sale movement. This covers all sale paths and keeps later catalog edits out of prior totals.
- Call the amount **Sales value at catalog prices**. If the report must show what customers paid, the sale flow needs a field or a checkout source for that amount. Staff would need a way to provide it during batch sales too.
- Count older sales and sales without a price. Show how many sales have no saved price. Sum only the sales with a saved price. A saved zero is a known price.
- Remove a cancelled sale from the period in which it occurred. For example, a Tuesday cancellation of a Sunday sale changes Sunday's report. A later sale of the same ball counts on its own date and at its own location.
- Start with an owner-only report in the app. Use Manila calendar periods. Let the owner view all locations or one location.

The [plan](../plan/1795163398_sales_report.md) asks the owner to confirm the price, access, and cancellation rules.
