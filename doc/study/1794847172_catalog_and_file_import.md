# Study: catalog and file import

Date: 2026-11-17. Mode: mixed.

## Request

Build a catalog with import and export.
Permit stock imports that can also add catalog entries.

## Evidence

- `supabase/migrations/20261116000000_ball_stock.sql:31` defines `ball_models`.
  Each entry has one unique UPC and one nominal weight.
  It has model details and an optional selling price.
- The same migration defines `balls` at line 51.
  Each physical ball has one unique serial number and one location.
- `receive_ball` starts at line 227.
  It creates a missing model and receives one ball in one transaction.
  It keeps existing catalog values when the UPC is known.
  It records the actor and a receive movement.
  A request ID protects a repeated submission.
- There is no catalog insert grant for clients.
  The owner can update model details and selling prices.
  Stock writes must continue through database functions.
- `src/lib/label/rules.ts` validates UPC check digits and serial numbers.
  It also validates model fields and optional ball measurements.
- `src/app/(app)/(stock)/layout.tsx` reads the catalog for the stock view.
  The stock view excludes entries with no stock.
  A separate catalog view must include those entries.
- `src/components/nav.tsx` has a desktop rail and three phone tabs.
  Keep the scan action easy to reach when adding catalog access.
- No file parser or import flow exists in the application.
- The first stock plan excluded spreadsheet import.
  This request adds it to the work under consideration.
  It does not confirm other product categories or quantity stock.
- `doc/wiki/setup.md` records a connected production site.
  Do not deploy this work without a ship or push instruction.

## Sources for current intent

- `doc/wiki/spec.md`.
- `doc/wiki/architecture.md`.
- `doc/plan/1794812081_ball_stock_first_version.md`.
- `doc/plan/1794842063_ui_flair.md`.
- `doc/adr/0001-brand-kit-confirmed-and-functional-motion.md`.
- `doc/adr/0002-motion-with-character.md`.
- `PRODUCT.md` and the current navigation and editor code.

The claude-mem search tool is unavailable in this harness.
Use these records and the git history as the history fallback.
The graphify query ran before the first source read.

## Proposed approach

Keep the current ball model and ball records.
Add a catalog view that is independent of stock availability.
Permit the owner to create a catalog entry before receiving a ball.
Reuse the model editor and price rules where practical.

Use two import types: catalog and stock.
Both types show a review before a write.
The review names each new entry and each error by source row.
Stock import can create a missing model from the same row.
A known UPC supplies the stored model details.
A serial number identifies one physical ball.

Use one transaction for each confirmed batch.
Validate again at commit time.
Reject a batch with errors instead of saving part of it.
Retain a request ID across retries.
Protect against a repeated file with the unique UPC and serial rules.

## Proposed import contract

- Catalog required fields: UPC, model name, and nominal weight.
- Catalog optional fields: the current model details and selling price.
- Stock required fields: serial number and UPC.
- A new UPC also requires model name and nominal weight.
- Stock optional fields: gross weight, top weight, pin distance, and boxed date.
- Select one active destination for each batch.
  Do not infer a destination from the All locations view.
- Preserve identifier text, including leading zeroes.
  Report numeric spreadsheet cells that have lost identifier digits.
- Use downloadable templates and a column mapping step.
  Do not guess ambiguous columns or dates.
- Do not run spreadsheet formulas or fetch external workbook links.
- Set explicit file size and row limits before parsing.
- Export all catalog rows with stable headers.
  Do not apply the database API's default row limit to the full export.
- Escape CSV fields and protect spreadsheet readers from formula injection.
  Preserve identifier text in the supported round-trip format.

## Design brief, pending confirmation

Mode: Operate. Use the established Cornerstock visual system.
The catalog extends the existing search and model-detail experience.
It must not start a new brand direction.

The catalog lists all UPC and weight entries, including zero-stock entries.
Search finds a name, brand, UPC, or product code.
The owner has Add model, Import, and Export actions.
Staff access depends on the answer in the plan.

The import sequence is File, Columns, Review, and Result.
Review shows counts for new models and new balls.
It also shows blocking errors with row numbers and field names.
Nothing is saved until the user confirms the review.
The result links to the catalog or the received stock.

On phones, preserve the central Scan action.
Use a visible Catalog link from Stock and from Account or Settings.
On large screens, add Catalog to the rail.
Use one screen at a time for the import steps on phones.
Reuse sheets, fields, status messages, and established focus treatment.
Support keyboard use, long names, empty data, and reduced motion.

## Decisions still needed

The plan contains the open questions and the only active task list.
No product rule in this study is approved by inference.
