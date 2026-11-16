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

- The human selected free barcode reading. No AI service reads the label.
- The browser reads the barcodes in the photo with `zxing-wasm`. The app serves the reader file itself (`public/zxing_reader.wasm`), so a scan does not depend on a CDN.
- The barcodes give the UPC, the serial number, and the product code. A barcode read is exact or it fails.
- A known UPC fills the model details from the catalog. For a new UPC, the staff member types the model details one time.
- The staff member types the values that are printed only as text: gross weight, top weight, pin distance, and the boxed date. These fields are optional.
- The rules in `src/lib/label/rules.ts` validate the values in the browser and again on the server. The database constraints are the last check.
- The photo is kept as a record of the label.
- An earlier version read the photo with a vision model on the server. It is in the git history (commit `0e091fb`).

## Accounts

- The first account is the owner. The owner creates the other accounts in Settings.
- An account that signs up by itself gets no access. Only accounts that the owner made are active.

## Locations

- Each ball has one location. The location selector is a cookie. It filters the stock view and sets the location of a new ball.

## Live view

- The app listens for changes to the stock tables and then reloads the page data from the server. The server query stays the one source of the view.

## Known limits

- The app does not work offline.
- The UPC field accepts 12 digits (UPC-A) only. A label with only an EAN-13 code that does not start with 0 is not supported.
- The reader takes the barcode above the UPC as the serial number. This order comes from one sample label.
