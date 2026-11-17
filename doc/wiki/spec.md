# Cornerstock spec

Source: the brand kit handoff in [../study/1794811328_brand_kit_handoff.md](../study/1794811328_brand_kit_handoff.md). This page separates confirmed facts from proposals. Move an item to "Confirmed" only after the human approves it.

## Confirmed

- The app name is Cornerstock.
- The app manages bowling equipment stock for Bowlers Corner, a bowling supply shop at Sta. Lucia East Mall, Philippines.
- Cornerstock is a new identity for the inventory app. It does not replace the shop's existing logo.
- Main function: make the recording of bowling ball stock seamless.
- The whole store sees a live view of the current ball stock.
- The app scans a ball box label, extracts all the details, and adds the ball to the store stock. See [../study/1794811730_ball_box_label.md](../study/1794811730_ball_box_label.md) for the sample label and its fields.
- The live view is for staff only. There is no customer view.
- All ball box labels that the shop receives have a serial number and a UPC.
- The app is an inventory management system only. It records the per-ball values (top weight, pin distance). It has no function for customers to select a ball.
- Each location has its own stock. A selector switches between locations.
- A ball leaves stock by its serial number.
- First version: see [../plan/1794812081_ball_stock_first_version.md](../plan/1794812081_ball_stock_first_version.md) for the approved decisions.
- Brand (confirmed on 2026-11-16, see [../adr/0001-brand-kit-confirmed-and-functional-motion.md](../adr/0001-brand-kit-confirmed-and-functional-motion.md)):
  - Endorsement: "For Bowlers Corner".
  - Personality: organized, dependable, approachable, precise, with restrained sporting energy.
  - Logo: a geometric corner bracket that frames a bowling ball with three finger holes.
  - Palette: ink navy `#172A3A`, warm ivory `#F6F3EC`, maple gold `#D7A55B`, signal orange `#D45A32`, slate gray `#6B747A`. Use mostly ivory and navy.
  - Type: Space Grotesk for headings and brand. Inter for interface and data. Tabular numerals for quantities and prices.
  - Stock statuses show a label and an icon, not color alone.
  - Voice: short, direct, helpful. Examples: "Receive stock", "3 pairs remaining", "Low stock".
  - Motion has character. Each motion has a cause: a navigation, a state change, or a touch. Under the reduced-motion setting, nothing moves ([../adr/0002-motion-with-character.md](../adr/0002-motion-with-character.md)).
  - Light theme only.

## Built

- Staff sign in with an email and a password. The owner makes the accounts.
- An account with no access (inactive, or no profile) cannot sign in. The sign-in page shows "This account does not have access. Ask the owner." When the owner deactivates a signed-in account, its next page load signs it out and shows the same message.
- Scan: the live camera opens at once. It asks for a 1440p stream; a phone that cannot give it gives less. The stream is not stored. The app reads the barcodes in the browser, about 5 frames each second, in a Web Worker. It reads only UPC-A, EAN-13, Code 39, and Code 128. No AI service is used. Then a confirm screen, then a save into the selected location.
- Capture rule: inside 1.5 seconds, one frame reads the UPC and the serial number together, and one more frame reads the same serial number. The latest frame must read the serial number. A different serial number or UPC in the window stops the capture. No sharpness limit applies. The confirm screen and the batch use the codes of the live camera; a read of the captured photo fills only the codes that the camera did not give.
- Diagnostic panel: `?debug=1` on the scan address shows the stream size, the read time, the frames each second, the sharpness, the bar size, the codes of the last frame and of the capture window, the hint, and the time to the last capture. No value leaves the device.
- The serial number and the product code use the same barcode type. The scan sorts them by form first: a serial number starts with the 2-digit year (23VSLE30B047), a product code starts with letters (BBMVSL15L). A code with the product code form never becomes the serial number. The position on the label decides only between codes of the same form. These forms come from Storm-group labels. After a save, the camera opens again and skips the serial number that was just saved.
- Live camera hints: point at the label, hold still, glare (tilt the box, or turn off the torch), move closer, hold the phone still, line up the phone with the label, already added. When the barcodes are too small to read, "move closer" shows before "glare". Two marks show if the serial and the UPC read.
- Live camera controls: close, shutter (takes the photo now), torch (only where the browser supports it), "Take a photo instead" (the phone camera app). The camera stops when the page is hidden or the camera closes.
- When the camera permission is refused or the browser has no live camera, the scan uses the phone camera app, with a message.
- Staff type the per-ball values (gross weight, top weight, pin distance, boxed date). The human selected this for now. These fields are optional.
- For a new UPC, staff type the model details one time. Staff can also type all the details with no photo.
- Batch scan: the live camera stays open. Each new serial number adds one photo. The same serial number again adds nothing. Staff can also add photos from the gallery, one photo for each label. The app reads them one at a time. A photo with a known UPC and a new serial number is ready. Staff save all ready balls with one tap, into one location. The batch does not record weights or pin distance. Staff add them later on the ball page. A photo with a new UPC, a missing barcode, or a recorded serial number opens the normal confirm screen.
- A known UPC fills the model details from the catalog.
- Owner only: edit the model details after the first save, on the model page. The UPC and the ball weight identify the model and do not change. A scan of a known UPC does not change the catalog details. Use this edit to correct them.
- Catalog: all staff browse every model and weight, also with no stock. Search finds a model name, brand, UPC, or product code, with the forgiving rules of the stock search. Staff see read-only details.
- Owner only: add a model to the catalog before any ball arrives. The UPC, model name, and ball weight are required. An existing UPC is refused on its field. Adding a model receives no ball.
- Owner only: export the complete catalog as CSV or Excel (`.xlsx`). Templates for both import types are on the import page.
- Owner only: import a catalog file or a stock file (CSV or `.xlsx`, up to 5 MB and 1,000 data rows). The steps are File, Columns, Review, and Result. The rules are in [../adr/0003-catalog-and-stock-file-imports.md](../adr/0003-catalog-and-stock-file-imports.md).
- The import review shows the additions, the before-and-after values, the unchanged rows, and the errors by source row and field. Errors of the same kind show as one line with their rows. Confirm stays off while an error remains.
- A stock import receives new balls, adds missing catalog entries, and corrects or moves existing balls. A change to an existing ball needs a reason. The reason shows in the ball history.
- The complete batch saves together, or nothing saves. If a record changes after the review, the save stops and asks for a new review.
- Catalog and Activity are items in the rail on large screens and tabs on a phone.
- Activity: all staff see every stock change and every catalog edit of the store, newest first, grouped by day in Manila time. A row shows the type, the time, the model and weight, the serial number, the details (locations, receipt number, reason, or the changed values with old and new), and the staff member. A row opens the ball, or the catalog model for a catalog edit.
- Activity types: Added, Sold, Sale cancelled, Moved, Edited (a ball correction), Removed, and Catalog edited. The filters are All, Added, Sold, Cancelled, Moved, Edited (ball and catalog edits), and Removed. The address keeps the filter (`?type=`). "Show older" loads 50 more rows.
- Each catalog model edit is recorded with the staff member, the time, and only the values that changed. This includes edits from a catalog import. The record is permanent.
- A serial number that is already recorded is refused. The message links to the existing ball and gives its status: in stock (with the location), sold, or removed.
- Sell from a scan: when the scanned serial number is a ball in stock, the main button of the confirm screen is "Mark as sold". A receipt number is optional. Only a tap on the button sells. Enter in a field does not sell. A correction of the serial number returns the screen to "Save to stock".
- In a batch, a row of a ball in stock has "Mark sold". The first tap changes it to "Tap to confirm" for 4 seconds. The second tap sells the ball, with no receipt number. A sold row counts as finished work, so Done does not warn about it.
- A sold or removed ball is not offered for sale from a scan. If the server refuses the sale, the scan stops the offer and shows the reason. A sale from a scan uses the same database function as the ball page.
- A serial number that is a product code is refused: "This is the product code. Scan or type the serial number." The confirm screen, the server, and the database check it. The scan moves a read serial number that the catalog knows as a product code into the product code field.
- Stock view: a greeting, four summary tiles, the search, the filter pills, and one card for each model with a count for each weight. It shows one location or all locations. Search finds a model or a serial number.
- Low-stock alert ([../adr/0004-low-stock-minimum.md](../adr/0004-low-stock-minimum.md)): the owner sets a minimum (0 to 99) for a model at one weight, on the model page or with a catalog import (column `min_in_stock`). The minimum applies to each active location. Fewer balls than the minimum is "Low". No ball is "Out". In "All locations", a weight is low when any location is low. Each change of the minimum is in the catalog edit log. The alert is in the app only.
- Low stock in the stock view: when a weight is low, the second tile is "Low stock" (in place of "Models"), and a "Low stock" pill shows after "All". A tap on either shows only the low weights. The address keeps it (`?l=1`). A low weight chip shows "×1 Low" and an out weight chip shows "Out", each with an icon. A model that is out in every weight shows with 0 in stock. The model page shows "Low stock" or "Out of stock" with the minimum, and in "All locations" the names of the low locations.
- Summary tiles: balls in stock, models (or "Low stock", see above), balls received today, and balls sold today. "Today" starts at midnight in Manila time. A reversed sale removes a sale only when that ball was sold earlier the same day.
- Model search filters during typing. Serial search starts after a 200 ms pause.
- Model search forgives: it ignores case, accents, spaces, and punctuation ("hyroad" finds Hy-Road). `!` and `|` read as the letter i ("iq" finds !Q Tour). A word of 5 or more letters can have one typing error. A word with a digit (a UPC, a code) must match exactly.
- Filter pills: "All", each weight in stock with its ball count, and "Brand", which opens a sheet. The address keeps the query, the weight, and the brand (`?q=`, `?w=`, `?b=`).
- Large screens: the `/` key goes to the search. `Esc` clears the search.
- At 1024px and wider, the stock list stays beside the detail pane. The selected model card is navy.
- Smaller screens: a small top bar with the initials, a floating tab bar, and one screen at a time. The tab bar has Stock, Catalog, a large Scan button in the center, Activity, and Settings (owner) or Account (staff). Under 360 px width the Scan button is 56 px, so it stays round. On a detail screen, Stock becomes Back. Back from a ball opens its model.
- The home-screen app on iOS has a solid status bar above the page. A `black-translucent` bar gets a grey system blur on iOS 26.1 and later.
- Smaller screens: a swipe from the left edge goes back on a detail screen. Safari in the browser has its own swipe, so the app does not add one there.
- The location: a chip on the stock screen opens a sheet with the locations. The rail on large screens keeps its selector. The Account screen also has the locations and sign-out. The owner sees the same panel at the top of Settings.
- The model screen shows the other weights of the model that are in stock. A tap changes the weight in place.
- Ball actions open in a modal sheet on smaller screens. A drag down on the handle closes it. They open inline on larger screens. Escape closes both, except while an action runs.
- After a scan saves a ball, the Stock item of the tab bar shows "+1" for 2 seconds.
- App links and sign-out warn before discarding unsaved label photos. Browser Back is not covered by this guard on the scan screen.
- On the import screen, app links, sign-out, browser Back, and a page close warn before discarding a file that is not saved.
- Ball page: details, label photo, history. The history uses the activity words (Added, Sold, Sale cancelled, Moved, Edited, Removed). Staff mark a ball as sold or move it to another location.
- Owner only: put a sold ball back in stock, correct the details, remove a ball, set a selling price, manage locations and staff accounts. Each of the first three needs a reason.
- Colors: actions use `#B94A25`, a darker variant of signal orange, because white text on `#D45A32` has a contrast of 4.0. Secondary text uses `#5A6369`.

## Proposed, not confirmed

### Brand

- Tagline: "Every item. Accounted for." It shows on the sign-in screen only.

### Stack

- Next.js App Router with TypeScript, Tailwind CSS, shadcn/ui.
- Supabase PostgreSQL, Auth, Storage, with row-level security.
- Vercel hosting. Responsive, installable progressive web app.
- Assumption: a small staff team that works online on phones, tablets, and counter computers.

### First-version scope

1. Product catalog: images, SKUs, barcodes, suppliers, costs, selling prices.
2. Variant-level stock:
   - Balls: model and weight. The sample label shows that each ball also has its own serial number, gross weight, top weight, and pin distance. Stock for balls is thus likely a list of individual balls. This is not yet approved.
   - Shoes: model, size, sizing system, handedness.
   - Bags: capacity and color.
   - Accessories: size, color, or pack.
3. Receiving, sales deductions, returns, transfers, stock adjustments.
4. Separate on-hand, reserved, and available quantities.
5. Low-stock threshold for each variant. Built for balls (see "Built").
6. Purchase orders and supplier records.
7. Barcode entry, fast search, CSV import and export, physical stock counts. CSV and `.xlsx` import and export are built for balls (see "Built"). The stock count is planned: [../plan/1794911487_stock_count.md](../plan/1794911487_stock_count.md).
8. Owner, manager, and staff roles.

### Inventory integrity

- Record each stock movement with actor, timestamp, reason, and reference.
- Update stock atomically in database transactions.
- A duplicate submission must not deduct stock twice.
- Two users must not allocate the same last available item.
- Correct mistakes with traceable reversing or adjustment entries.
- Stock-changing operations are authoritative on the server and database. No privileged key in the client.

## Open questions

- What is the existing checkout workflow? Is there a checkout system to integrate?
- Is a manager role necessary, and with which permissions?
- Which file is the source for the first stock import? The app now accepts CSV and `.xlsx` files.
- Must operations continue during internet outages? Offline stock changes need a synchronization and conflict design.
- Domain and trademark availability for "Cornerstock" are not established. Other retail uses of the name exist.
