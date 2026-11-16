# Architecture intent

This page gives the reasons for the structure. Read the code for the structure itself.

## The database is the authority for stock

- Clients cannot write to `balls` or `stock_movements`. They call database functions (`receive_ball`, `sell_ball`, `transfer_ball`, `reverse_sale`, `remove_ball`, `adjust_ball`).
- Each function does its change and writes one movement in one transaction. Thus the stock and its history cannot disagree.
- Row-level security and the role checks in the functions are the real permission checks. The proxy and the page checks only give a better experience.
- Stock movements cannot be changed or deleted. A mistake is corrected by a new movement.

## One record for each ball

- A ball is identified by its serial number. The count for a model is the number of its balls with status `in_stock`.
- A model row is one UPC: a model at one nominal weight. The first scan of a UPC creates the model. Later scans keep the catalog values, so one bad photo cannot change a model.

## Repeated and concurrent actions

- The client makes one request id for each user action. The functions store it on the movement. A repeated submission with the same id does nothing.
- A sale updates the ball only where the status is `in_stock`. Thus only one of two concurrent sales succeeds.
- The unique serial number stops a second entry of the same ball.

## Label reading

- The phone sends one photo to `/api/extract`. A vision model returns the fields. A field that it cannot read is empty.
- The model output is a proposal. The staff member confirms it. The rules in `src/lib/label/rules.ts` validate it in the browser and again on the server. The database constraints are the last check.
- The UPC check digit catches most misread UPCs. A serial number has no check digit, so the confirm screen is the check.

## Accounts

- The first account is the owner. The owner creates the other accounts in Settings.
- An account that signs up by itself gets no access. Only accounts that the owner made are active.

## Locations

- Each ball has one location. The location selector is a cookie. It filters the stock view and sets the location of a new ball.

## Live view

- The app listens for changes to the stock tables and then reloads the page data from the server. The server query stays the one source of the view.

## Known limits

- The app does not work offline.
- `/api/extract` has no rate limit. Each call costs money. Only signed-in staff can call it.
