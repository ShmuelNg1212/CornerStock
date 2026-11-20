# Reorder worksheet plan

Study [reorder worksheet](../study/1795169695_reorder_worksheet.md). Implementation branch `feat/reorder-worksheet`.

## Approved rules

The owner approved the plan and its defaults on 2026-11-20. See [reorder worksheet rules](../adr/0007-reorder-worksheet-rules.md).

- Use one line per UPC and low-stock location. If the same UPC is low in two locations, the owner can enter a quantity for each.
- Start quantities blank. Show the gap to minimum beside each field. Keep entries in the open page and export positive quantities to Excel.
- The owner opens **Reorder worksheet** from Activity. Show all active locations by default. The owner can filter to one active location.
- Use the current low-stock rules to select rows. Show model, brand, weight, UPC, location, in stock, minimum, gap to minimum, and units sold in the last 30 Manila calendar dates, including today. Count sales at the location where each sale occurred. Apply the sales report's cancellation and resale rules.
- A quantity is a whole number. Blank or zero skips the line. Show an error for an invalid quantity. Export includes all positive quantities in the open worksheet, even if the location filter hides a line. Show the export line count so the owner can see this.
- The Excel file contains the worksheet values for each ordered line, the order quantity, and the sales date range. It is an order worksheet for use outside the app. Receiving uses the existing scan flow.

## Tasks

- [x] **1. Read the reorder rows.** `tests: first`
  - Add an owner-only database function. Use the existing low-stock view. Share the sale movement selection and cancellation rule with the sales report if the existing tests confirm that the report stays equivalent. Return the rows and the active locations from one read. Use the database clock to set the Manila date range.
  - Acceptance. The data includes zero-stock rows and two low locations for the same UPC. It excludes inactive locations, rows at the minimum, and rows with a blank or zero minimum. Cover Manila midnight, old sales without prices, a cancellation after the sale date, resale, and a ball that moved before or after sale. A staff or anonymous account cannot read the result. The database response includes all eligible rows above the usual API row limit.
  - Done when the new database tests and existing sales report tests pass.

- [x] **2. Validate quantities and generate the Excel file.** `tests: first`
  - Key entries by catalog entry and location. Validate the submitted rows on the server with the owner session. Use trusted worksheet values for the export. If a selected line is no longer low or its stock or minimum changed, refresh the worksheet and ask the owner to review it before downloading. Keep entries for lines that remain eligible.
  - Acceptance. Blank and zero are skipped. Invalid, duplicate, or stale entries give a clear result. The file contains only ordered lines, keeps the location and UPC distinct, preserves a leading zero, and stores text as text. A staff account cannot request a download. A download changes no stock.
  - Done when quantity, export, and owner access checks pass, including a test that opens the generated file and verifies its cells.

- [x] **3. Build the worksheet screen.** `tests: alongside`
  - Link to the worksheet from Activity for the owner. Use the existing Activity style and stock status marks. Use columns on desktop and stacked rows on phones. Show the sales dates. Keep typed quantities when the owner changes the location filter. State that leaving or reloading the page clears the draft.
  - Acceptance. The owner can fill the worksheet on a phone and at the counter. No horizontal scrolling is needed at 320 px. Long names and large counts fit. A location with no reorder lines has a clear empty state. A failed export keeps the entered quantities. Staff have no link or direct access.
  - Done when a signed-in browser probe verifies the entry point, location filter, stale data feedback, and Excel download.

## Rendezvous and sync

- Run `npm test`, `npm run typecheck`, `npx eslint .`, and `npm run build`. Use the code review, Supabase, Impeccable audit, and break-ui checks.
- In a signed-in environment, use a low row and a sale. Open the worksheet from Activity as owner. Enter an order quantity. Download the workbook and inspect its contents. Change the stock from a second session and repeat the download. Check that staff cannot open or export the worksheet.
- After approval, record the product rules in an ADR. After implementation, sync the wiki and record the checks here. Keep the feature branch ready for release approval.

## Checks on 2026-11-20

- `npm test` passed with 289 unit tests and 94 database tests. Typecheck, ESLint, and the production build passed.
- The code reviews found that a blank worksheet ignored stock refreshes and that Next preserved drafts after navigation. Signed-in Chrome verified both fixes with the local test database. The Impeccable detector reported no findings.
- The owner opened the worksheet from Activity and entered quantities in two locations. Excel kept both lines and the leading zero in the UPC. A sale from a second session caused the worksheet to ask for review. The retry exported the updated stock and kept the order quantities. A staff account had no worksheet link, direct page access, or download access.
- Chrome showed the worksheet at 320, 390, 700, and 1280 px with a 120-character model name and 1,234 sales. It had no horizontal overflow. The checks used browser viewports.
