# 0004: One low-stock minimum for each model and weight, applied to each location

Date: 2026-11-17. Status: accepted. Decided by: the human (answers in [../plan/1794911487_low_stock_alert.md](../plan/1794911487_low_stock_alert.md)).

## Context

Each location has its own stock. The owner must see which models are running low before a customer asks for one. A catalog entry is one UPC: one model at one weight.

## Decision

1. A catalog entry has an optional minimum: a whole number from 0 to 99. No minimum, or 0, gives no alert.
2. The minimum applies to each active location. It is not a total for the store.
3. In one location: fewer balls in stock than the minimum is "Low". No ball in stock is "Out".
4. In "All locations", a catalog entry is low when any active location is low.
5. Only the owner sets the minimum: on the model page, or with a catalog import (column `min_in_stock`). Each change is in the catalog edit log.
6. The alert shows in the app only. There is no email or push message.

## Consequences

- An out-of-stock model with a minimum must show in the stock view, although the stock view otherwise shows only models with stock.
- A location that needs a different minimum is not supported. A change needs a new decision.
- The database view `low_stock` gives the low rows. The status rule in the app is `stockStatus` in `src/lib/low-stock.ts`.
