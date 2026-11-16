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
  - Motion is functional and quick. It shows a state change. Under the reduced-motion setting, nothing moves.
  - Light theme only.

## Built

- Staff sign in with an email and a password. The owner makes the accounts.
- Scan: the live camera opens at once. The app reads the barcodes in the browser, about 5 frames each second, in a Web Worker. It takes the photo when the same UPC and serial number read in 2 frames in a row. No AI service is used. Then a confirm screen, then a save into the selected location. After a save, the camera opens again and skips the serial number that was just saved.
- Live camera hints: point at the label, hold still, glare (tilt the box, or turn off the torch), move closer, hold the phone still, line up the phone with the label, already added. Two marks show if the serial and the UPC read.
- Live camera controls: close, shutter (takes the photo now), torch (only where the browser supports it), "Take a photo instead" (the phone camera app). The camera stops when the page is hidden or the camera closes.
- When the camera permission is refused or the browser has no live camera, the scan uses the phone camera app, with a message.
- Staff type the per-ball values (gross weight, top weight, pin distance, boxed date). The human selected this for now. These fields are optional.
- For a new UPC, staff type the model details one time. Staff can also type all the details with no photo.
- Batch scan: the live camera stays open. Each new serial number adds one photo. The same serial number again adds nothing. Staff can also add photos from the gallery, one photo for each label. The app reads them one at a time. A photo with a known UPC and a new serial number is ready. Staff save all ready balls with one tap, into one location. The batch does not record weights or pin distance. Staff add them later on the ball page. A photo with a new UPC, a missing barcode, or a recorded serial number opens the normal confirm screen.
- A known UPC fills the model details from the catalog.
- Owner only: edit the model details after the first save, on the model page. The UPC and the ball weight identify the model and do not change. A scan of a known UPC does not change the catalog details. Use this edit to correct them.
- A serial number that is already recorded is refused. The message links to the existing ball.
- Stock view: models with a count for each weight, for one location or all locations. Search finds a model or a serial number.
- Model search filters during typing. Serial search starts after a 200 ms pause. The address keeps the query.
- At 1024px and wider, the stock list stays beside the detail pane. Smaller screens show a top bar, bottom tabs, and one screen at a time.
- Ball actions open in a modal sheet on smaller screens. They open inline on larger screens.
- App links and sign-out warn before discarding unsaved label photos. Browser Back is not covered by this guard.
- Ball page: details, label photo, history. Staff mark a ball as sold or move it to another location.
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
5. Low-stock threshold for each variant.
6. Purchase orders and supplier records.
7. Barcode entry, fast search, CSV import and export, physical stock counts.
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
- What is the source for the first stock import?
- Must operations continue during internet outages? Offline stock changes need a synchronization and conflict design.
- Domain and trademark availability for "Cornerstock" are not established. Other retail uses of the name exist.
