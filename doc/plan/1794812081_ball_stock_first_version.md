# Plan: ball stock, first version

Mode: mixed. The technical part runs first, then the design pass.
Skills: `tdd`, `wizard`, `code-review`, `security-review`, `/impeccable`, `mobile-native`, `break-ui`.

Sources: [../wiki/spec.md](../wiki/spec.md), [../study/1794811730_ball_box_label.md](../study/1794811730_ball_box_label.md), [../study/1794811328_brand_kit_handoff.md](../study/1794811328_brand_kit_handoff.md).

## Goal

A staff member takes a photo of a ball box label. The app extracts the details. The staff member confirms them. The ball is then in stock, and all signed-in staff see the change live.

## Scope

In: bowling balls only. Label intake, live stock view, removal from stock, staff sign-in, movement log.

Out, for later plans: shoes, bags, accessories, purchase orders, suppliers, transfers, reservations, CSV import and export, stock counts, offline operation, checkout integration.

## OPEN QUESTIONS

Each question has a recommended answer. The plan below assumes the recommended answers.

1. **Stack.** Next.js, TypeScript, Tailwind, shadcn/ui, Supabase, Vercel, as the brief recommends? Recommended: yes.
2. **Ball records.** One record for each ball, identified by its serial number? Recommended: yes. The stock count for a model and weight is then the number of its balls in stock.
3. **Label reading.** Recommended: the phone sends one photo to the server. A vision model on the server extracts all fields, including the printed serial number and UPC digits. The server validates the UPC check digit. The staff member confirms the fields before the save. This method needs an AI API key and has a small cost for each scan. The alternative is text recognition on the device. It has no cost for each scan, but it is less accurate on varied labels.
4. **Roles.** Recommended for this version: two roles. Staff can add balls and mark balls as sold. The owner can also correct or remove records and manage staff accounts. The manager role comes later.
5. **Locations.** Recommended: one location, the Sta. Lucia East Mall shop. Is there a second store or a stockroom that needs separate stock?
6. **How a ball leaves stock.** Recommended: staff find the ball by serial number (scan or search) and mark it as sold. There is no link to a checkout system in this version. Does the shop have a checkout system now?
7. **Existing stock.** Recommended: staff scan each box that is in the shop now. No spreadsheet import in this version.
8. **Prices.** Does this version record a cost and a selling price for each model? Recommended: one optional selling price for each model and weight, visible to all staff. No cost price in this version.
9. **Offline.** Recommended: online only in this version. A scan without a connection shows a clear message and does not save.

## Steps only the human can do

- Create a Supabase project and supply its URL and keys.
- Supply an API key for the vision model.
- Create a Vercel project when the first deploy is wanted. A GitHub remote is necessary for this.

## Tasks

### Technical

- [ ] **T1. Scaffold the app.** `tests: alongside`
  - Acceptance: a Next.js App Router app with TypeScript, Tailwind, and shadcn/ui builds. A test runner is installed. The brand colors and fonts are theme tokens.
  - Complete when: the build and one sample test pass, and AGENTS.md has the test command.

- [ ] **T2. Database schema.** `tests: first`
  - Acceptance: tables exist for ball models (UPC is unique; model fields from the label), balls (serial number is unique; gross weight, top weight, pin distance, boxed date, status, label photo), and stock movements (ball, type, actor, timestamp, reason, reference). Stock movements cannot be edited or deleted.
  - Complete when: the migration applies to a clean database and the schema tests pass.

- [ ] **T3. Sign-in and permissions.** `tests: first`
  - Acceptance: staff sign in with an account that the owner creates. Row-level security permits only signed-in staff to read stock. Only the owner can correct or remove records. No privileged key is in client code.
  - Complete when: tests show that a signed-out request and a staff request for an owner action are both refused.

- [ ] **T4. Label field rules.** `tests: first`
  - Acceptance: pure functions validate the UPC check digit and parse gross weight ("15 LBS 4 OZ"), pin distance ("3-3.5"), top weight, and the boxed date. Bad input gives a clear error for that field.
  - Complete when: the tests pass, with the sample label values as one case.

- [ ] **T5. Label extraction.** `tests: first`
  - Acceptance: a server endpoint accepts a label photo from a signed-in staff member and returns the fields in the study's field map. Each field that the model cannot read is empty, not guessed. The API key stays on the server.
  - Complete when: the endpoint returns the correct values for the sample label photo.

- [ ] **T6. Save a ball.** `tests: first`
  - Acceptance: one database function creates the ball, creates the model if the UPC is new, and writes the movement, in one transaction. A second save of the same serial number is refused with a message that names the existing ball. A repeated submission does not create a second ball.
  - Complete when: tests for the duplicate serial and the repeated submission pass.

- [ ] **T7. Remove a ball from stock.** `tests: first`
  - Acceptance: staff mark a ball as sold. The owner can reverse this or adjust a record with a reason. Each change writes a movement. Two staff cannot sell the same ball.
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
  - Acceptance: the view lists models with a count for each weight. A tap on a row shows the individual balls with serial number, gross weight, top weight, and pin distance. Search finds a model name or a serial number. Statuses show a label and an icon.
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
