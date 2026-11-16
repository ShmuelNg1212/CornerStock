# Cornerstock spec

Source: the brand kit handoff in [../study/1794811328_brand_kit_handoff.md](../study/1794811328_brand_kit_handoff.md). No application code exists yet. This page separates confirmed facts from proposals. Move an item to "Confirmed" only after the human approves it.

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

## Proposed, not confirmed

### Brand

- Endorsement: "For Bowlers Corner". Tagline: "Every item. Accounted for."
- Personality: organized, dependable, approachable, precise, with restrained sporting energy.
- Logo: a geometric corner bracket that frames a bowling ball with three finger holes.
- Palette: ink navy `#172A3A`, warm ivory `#F6F3EC`, maple gold `#D7A55B`, signal orange `#D45A32`, slate gray `#6B747A`. Use mostly ivory and navy. Contrast is not yet validated.
- Type: Space Grotesk for headings and brand. Inter for interface and data. Tabular numerals for quantities and prices.
- Stock statuses show a label and an icon, not color alone.
- Voice: short, direct, helpful. Examples: "Receive stock", "3 pairs remaining", "Low stock".

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

- Which method reads the printed label text: on-device text recognition or a server vision model?

- What is the existing checkout workflow? Is there a checkout system to integrate?
- How many stock locations are there?
- What are the exact permissions for owner, manager, and staff?
- What is the source for the first stock import?
- Must operations continue during internet outages? Offline stock changes need a synchronization and conflict design.
- Domain and trademark availability for "Cornerstock" are not established. Other retail uses of the name exist.
