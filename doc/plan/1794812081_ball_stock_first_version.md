# Plan: ball stock, first version

Mode: mixed. The technical part runs first, then the design pass.
Skills: `tdd`, `wizard`, `code-review`, `security-review`, `/impeccable`, `mobile-native`, `break-ui`.

Sources: [../wiki/spec.md](../wiki/spec.md), [../study/1794811730_ball_box_label.md](../study/1794811730_ball_box_label.md), [../study/1794811328_brand_kit_handoff.md](../study/1794811328_brand_kit_handoff.md).

## Goal

A staff member takes a photo of a ball box label. The app extracts the details. The staff member confirms them. The ball is then in stock, and all signed-in staff see the change live.

## Scope

In: bowling balls only. Label intake, live stock view, removal from stock, staff sign-in, movement log.

Out, for later plans: shoes, bags, accessories, purchase orders, suppliers, transfers, reservations, CSV import and export, stock counts, offline operation, checkout integration.

## Decisions (approved by the human)

1. Stack: Next.js, TypeScript, Tailwind, shadcn/ui, Supabase, Vercel.
2. One record for each ball, identified by its serial number.
3. Label reading: one photo goes to the server. A vision model extracts the fields. The server validates the UPC check digit. The staff member confirms before the save.
4. Two roles: staff and owner.
5. **Changed by the human:** each location has its own stock. A selector switches between locations and shows what is available in each one. The selector also has an "All locations" option.
6. A ball leaves stock by its serial number. No checkout link is necessary.
7. Staff scan the boxes that are in the shop now. No spreadsheet import.
8. One optional selling price for each model and weight. No cost price.
9. Online only.

Agent decisions that follow from decision 5:

- A scanned ball goes into the location that the selector shows. The confirm screen shows this location.
- Staff can move a ball to another location. The move writes a movement. Without this, a ball in the wrong location cannot be corrected.
- The owner adds and renames locations. The first location is "Sta. Lucia East Mall".

## Steps only the human can do

- Create a Supabase project and supply its URL and keys.
- Supply an API key for the vision model.
- Create a Vercel project when the first deploy is wanted. A GitHub remote is necessary for this.

## Status

Updated after the first execute session.

- T1, T2, T3, T4, T6, T7: complete. Their tests pass.
- T5: the code and a test exist. The test needs an API key. It has not run.
- T8, D2, D3, D4, D5: the code exists. No check was possible, because no Supabase project exists.
- D1: not started. The screens use the brand tokens. The contrast check is in `src/app/globals.css`.
- R1: not started.
- Blocked on the human steps in [../wiki/setup.md](../wiki/setup.md): the Supabase project and the API key.
- Added during execute: an account that signs up by itself gets no access.

## Tasks

### Technical

- [x] **T1. Scaffold the app.** `tests: alongside`
  - Acceptance: a Next.js App Router app with TypeScript, Tailwind, and shadcn/ui builds. A test runner is installed. The brand colors and fonts are theme tokens.
  - Complete when: the build and one sample test pass, and AGENTS.md has the test command.

- [x] **T2. Database schema.** `tests: first`
  - Acceptance: tables exist for ball models (UPC is unique; model fields from the label), locations, balls (serial number is unique; location, gross weight, top weight, pin distance, boxed date, status, label photo), and stock movements (ball, type, actor, timestamp, reason, reference). Stock movements cannot be edited or deleted.
  - Complete when: the migration applies to a clean database and the schema tests pass.

- [x] **T3. Sign-in and permissions.** `tests: first`
  - Acceptance: staff sign in with an account that the owner creates. Row-level security permits only signed-in staff to read stock. Only the owner can correct or remove records. No privileged key is in client code.
  - Complete when: tests show that a signed-out request and a staff request for an owner action are both refused.

- [x] **T4. Label field rules.** `tests: first`
  - Acceptance: pure functions validate the UPC check digit and parse gross weight ("15 LBS 4 OZ"), pin distance ("3-3.5"), top weight, and the boxed date. Bad input gives a clear error for that field.
  - Complete when: the tests pass, with the sample label values as one case.

- [ ] **T5. Label extraction.** `tests: first`
  - Acceptance: a server endpoint accepts a label photo from a signed-in staff member and returns the fields in the study's field map. Each field that the model cannot read is empty, not guessed. The API key stays on the server.
  - Complete when: the endpoint returns the correct values for the sample label photo.

- [x] **T6. Save a ball.** `tests: first`
  - Acceptance: one database function creates the ball, creates the model if the UPC is new, and writes the movement, in one transaction. A second save of the same serial number is refused with a message that names the existing ball. A repeated submission does not create a second ball.
  - Complete when: tests for the duplicate serial and the repeated submission pass.

- [x] **T7. Remove a ball from stock.** `tests: first`
  - Acceptance: staff mark a ball as sold. The owner can reverse this or adjust a record with a reason. Each change writes a movement. Two staff cannot sell the same ball. Staff can move a ball to another location.
  - Complete when: tests for the reversal and the concurrent sale pass.

- [ ] **T8. Live stock data.** `tests: alongside`
  - Acceptance: the stock view receives changes from other devices without a page reload.
  - Complete when: a ball added in one browser session shows in a second session in a few seconds.

### Design

- [ ] **D1. Design sources.** Run `/impeccable init` and `/impeccable document` with the brand kit. Check text and button contrast and add darker variants where necessary.
  - Complete when: PRODUCT.md and DESIGN.md exist and the contrast check is recorded.

- [ ] **D2. Scan and confirm screen.** `tests: alongside`
  - Acceptance: on a phone, the staff member opens the camera with one tap, takes the photo, and sees the extracted fields in a form. Empty or invalid fields are marked. One tap saves. The screen then is ready for the next box.
  - Complete when: the sample label goes from photo to saved ball on a real phone.

- [ ] **D3. Stock view.** `tests: alongside`
  - Acceptance: a location selector switches the view between each location and all locations. The view lists models with a count for each weight in the selected location. A tap on a row shows the individual balls with serial number, gross weight, top weight, and pin distance. Search finds a model name or a serial number. Statuses show a label and an icon.
  - Complete when: `break-ui` finds no layout failure and the view is usable on a phone and on a counter computer.

- [ ] **D4. Ball detail and sell action.** `tests: alongside`
  - Acceptance: the detail screen shows all fields, the label photo, and the movement history. The sell action asks for confirmation.
  - Complete when: a ball is sold from a phone and the count changes on a second device.

- [ ] **D5. Installable app.** Add the manifest, icons, and the `mobile-native` fixes.
  - Complete when: the app installs to a phone home screen and opens full screen.

### Release

- [ ] **R1. First deploy.** Write the deploy and rollback commands into `doc/wiki/setup.md`. Deploy when the human says "ship".
  - Complete when: a version marker shows on the live site.

## Rendezvous checks

- Run the test suite, `code-review`, and `security-review`.
- On a real phone, signed in as staff: scan the sample label, confirm, save. Then scan it again and see the duplicate refusal.
- On a second device: see the new ball appear without a reload.
- Signed out: the stock view and the extraction endpoint refuse access.
