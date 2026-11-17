# 0005: Stock count rules

Date: 2026-11-17. Status: accepted. Decided by: the human (answers in [../plan/1794911487_stock_count.md](../plan/1794911487_stock_count.md)).

## Context

Staff must check that the balls on the shelf agree with the records. A ball has a serial number on its box label. The scan reads the serial alone for a count. The UPC is not necessary, because the ball is already recorded.

## Terms

- **Count**: one check of one whole location. A count is open, finished, or cancelled.
- **Count scan**: one serial number that staff scanned or typed in an open count.
- **Found**: a ball in stock in the location of the count, with a count scan.
- **Missing**: a ball in stock in the location of the count, with no count scan.
- **Unexpected**: a count scan with no ball in stock in the location of the count. The kind tells why: in a different location, sold, removed, or not recorded.
- **Correction**: one stock change, from one line of the result of a finished count.

## Decision

1. A count covers the whole location. A count of a part of a location is not supported.
2. Each location has one open count or none. A start in a location with an open count gives that count. Staff on several phones add scans to the same count.
3. A count records each serial number one time. A second scan of the same serial adds nothing.
4. The comparison runs when a staff member finishes the count. It uses the in-stock balls of the location at that time. A ball sold during the count is thus not missing.
5. The finish keeps the result. The result of a past count does not change when stock changes later. The result marks a line as "Resolved" when the stock now agrees with it, from a correction or from any later change.
6. A count changes no stock. Only a correction changes stock, through the existing stock functions:
   - Unexpected, in a different location: any staff member moves the ball to the location of the count.
   - Missing: only the owner marks the ball as removed. The reason names the count.
   - Unexpected, sold: only the owner puts the ball back in stock, with a reason.
   - Not recorded: the normal intake scan adds the ball.
   - Unexpected, removed: no correction from the count.
7. The reason of each correction names the date and the location of the count, so the activity log shows the cause.
8. The app keeps a record of past counts: date, location, who started and finished, and the totals.

## Consequences

- The count tables are written only by database functions. Clients have no direct table access.
- A move from a count has a reason, so the activity log shows its cause. Only the count functions set it (`transfer_ball_with_reason` is internal). A client move still has no reason.
- A count that nobody finishes stays open. Any staff member can cancel it.
- A ball recorded as removed that is on the shelf has no correction from the count. The result asks staff to tell the owner.
