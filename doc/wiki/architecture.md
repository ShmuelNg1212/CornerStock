# Architecture intent

This page gives the reasons for the structure. Read the code for the structure itself.

## The database is the authority for stock

- Clients cannot write to `balls` or `stock_movements`. They call database functions (`receive_ball`, `sell_ball`, `transfer_ball`, `reverse_sale`, `remove_ball`, `adjust_ball`, `commit_catalog_import`).
- Each function does its change and writes one movement in one transaction. Thus the stock and its history cannot disagree.
- Row-level security and the role checks in the functions are the real permission checks. The proxy and the page checks only give a better experience.
- Stock movements cannot be changed or deleted. A mistake is corrected by a new movement.

## One record for each ball

- A ball is identified by its serial number. The count for a model is the number of its balls with status `in_stock`.
- A model row is one UPC: a model at one nominal weight. The first scan of a UPC creates the model. Later scans keep the catalog values, so one bad photo cannot change a model.
- The owner can also create a model in the catalog or by an import. Only the owner's model edit and an owner import change catalog values.

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

## Catalog and file imports

- The server builds the review from the database, not from the browser. The browser sends the file rows and the column mapping only. The rules are in `src/lib/catalog/review.ts`. The same rules check the single Add model form.
- The browser sends only the mapped columns. Other columns of the file never reach the server.
- The server signs the reviewed payload with the secret key (HMAC), for the owner and for 30 minutes. The commit refuses a payload that the browser changed.
- `commit_catalog_import` saves the complete batch in one transaction. It checks each record against its reviewed value again. A changed record stops the batch with no write.
- Each batch has a permanent record with the actor, the request id, the payload, the result, and the catalog before-and-after values. A retry with the same request id returns the first result. The same id with a different payload fails.
- An import transfer uses the existing transfer rules. Its reason reaches the movement through a setting that lasts one transaction. A trigger on `stock_movements` reads it. The trigger does nothing outside an import.
- The server checks an `.xlsx` file before the Excel reader loads it: entry count, expanded size, merged cells, and row and column bounds. A crafted workbook cannot expand to millions of cells. The check includes each entry that the Excel reader treats as a worksheet.
- Exports page through the database, so the API row limit cannot cut them short. The CSV export puts an apostrophe before identifiers and before text that starts like a formula. Spreadsheet programs then keep leading zeroes and do not run the text. The import removes this apostrophe again.

## Accounts

- The first account is the owner. The owner creates the other accounts in Settings.
- An account that signs up by itself gets no access. Only accounts that the owner made are active.

## Locations

- Each ball has one location. The location selector is a cookie. It filters the stock view and sets the location of a new ball.

## Region

- The Supabase database is in AWS `ap-southeast-2` (Sydney). The Vercel functions run in `syd1` (Sydney), set in `vercel.json`.
- A page makes several database calls. Each call then stays inside one region. The user has one longer trip to Sydney for each request.
- A move of the database to another region must also move the function region.

## Live view

- The app listens for changes to the stock tables and then reloads the page data from the server. The server query stays the one source of the view.
- The stock list is in a shared layout. It stays mounted when a detail route changes, so the search context remains visible on large screens.
- Two motion tools have separate jobs (ADR 0002). React view transitions animate route changes and the weight chip that becomes the weight tag. The `motion` library animates what must keep its place while React changes the list: cards that move during a search, the sliding indicators, sheets with a drag, and rolling digits.
- Each animated element has one owner: a view transition or `motion`, never both.
- `motion` loads with `LazyMotion`. Its layout and drag features load after the first paint. The swipe back uses plain transforms and the browser's animation API, not `motion`.
- `MotionConfig reducedMotion="user"` and one CSS rule stop movement under the reduced-motion setting.
- The weight chip and the weight tag share a view transition name only below 1024px. Large screens show both at the same time, and a name must be unique.

## Known limits

- The app does not work offline.
- An import takes 1,000 data rows and 5 MB at most. A larger file must be split.
- An `.xlsx` file whose rows or cells have no address cannot be read by the Excel reader. The app asks for a resave in Excel.
- The UPC field accepts 12 digits (UPC-A) only. A label with only an EAN-13 code that does not start with 0 is not supported.
- The reader takes the barcode above the UPC as the serial number. This order comes from one sample label.
