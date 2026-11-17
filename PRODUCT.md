# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Shop staff of Bowlers Corner, a bowling supply shop at Sta. Lucia East Mall, Philippines. They are a small team. They are not technical users.
- Staff use phones and counter computers in an even mix. Phones do the label scans in the stock room and at the shelves. The counter computer shows the live stock view during sales. Tablets are also in use.
- The owner uses the same app. The owner also makes staff accounts, manages locations, sets prices, and corrects records.
- There is no customer view.

## Product Purpose

Cornerstock records the bowling ball stock of the shop. It makes the recording seamless. Success: a new ball is in stock a few seconds after a photo of its box label, and each staff member sees the same current stock on each device.

## Positioning

Stock is a list of individual balls, not a quantity. Each ball has its own serial number, gross weight, top weight, and pin distance. Intake is a photo of the manufacturer's box label: the app reads the UPC and the serial number from the barcodes in the browser.

## Operating Context

- A ball arrives in a box with a printed label. The label has a serial number and a UPC.
- Staff scan one label, or a batch of labels, then confirm and save into one location.
- Staff look up a model by name, or a ball by serial number, to answer a customer at the counter.
- A ball leaves stock by its serial number: sold, or moved to another location.
- Each location has its own stock. A selector switches between locations.
- The view is live. A change on one device shows on the other devices.

## Capabilities and Constraints

- Built: sign-in, stock view with search, model page, ball page with history and label photo, single and batch label scan, owner settings (locations, staff accounts), owner corrections with a reason, a catalog of all models (also with no stock), owner catalog edits, CSV and Excel export, and reviewed CSV and Excel imports of catalog and stock files.
- Stock changes go through database functions. The server and database are the authority. No privileged key is in client code.
- The app does not work offline.
- Next.js App Router, Tailwind CSS, Supabase. Installable progressive web app.
- Terms: ball, model, catalog entry, serial number, UPC, location, in stock, sold, removed, movement, import batch.
- Not built, not decided: shoes, bags, accessories, purchase orders, low-stock thresholds, a manager role, a checkout integration.

## Brand Commitments

Confirmed by the human on 2026-11-16:

- Name: Cornerstock. Endorsement: "For Bowlers Corner".
- Logo: a geometric corner bracket that frames a bowling ball with three finger holes.
- Palette: ink navy `#172A3A`, warm ivory `#F6F3EC`, maple gold `#D7A55B`, signal orange `#D45A32`, slate gray `#6B747A`. Mostly ivory and navy. Orange and gold are selective.
- Type: Space Grotesk for headings and brand. Inter for interface and data. Tabular numerals for quantities and prices.
- Personality: organized, dependable, approachable, precise, with restrained sporting energy.
- Voice: short, direct, helpful. Examples: "Receive stock", "Stock count saved", "Low stock".
- Motion: it has character, but each motion has a cause: a navigation, a state change, or a touch. Motion with no cause is not permitted (ADR 0002).

Proposed, not confirmed: the tagline "Every item. Accounted for."

## Evidence on Hand

- Brand concept board: `doc/study/assets/cornerstock-brand-concept.png`. It is a visual reference, not production artwork.
- One sample box label: `doc/study/assets/ball-box-label-sample.jpg`.
- No real stock data exists yet. The app is not yet used with a real Supabase project. Do not invent stock numbers, customers, or prices as facts.
- No product photographs of the shop or its balls exist in the repository.

## Product Principles

1. Intake speed first. The scan of a label is the main function. Other scope waits.
2. One truth for the whole store. Each screen shows the server's current stock.
3. Each ball is an individual. Show the serial number and the per-ball values clearly.
4. Comfortable for everyday shop staff. Use known patterns and plain words.
5. A status shows a label and an icon, not color alone.

## Accessibility & Inclusion

- Text and controls meet WCAG AA contrast. Actions use `#B94A25` because white text on `#D45A32` has a contrast of 4.0 only.
- Touch targets are large enough for a phone held in one hand.
- Motion stops under the reduced-motion setting.
