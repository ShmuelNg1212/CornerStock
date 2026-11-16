# Plan: catalog and file import

Date: 2026-11-17. Status: approved by the human on 2026-11-17. Mode: mixed.
Study: [catalog and file import](../study/1794847172_catalog_and_file_import.md).

## OPEN QUESTIONS

None. The human approved the complete plan on 2026-11-17.

## Confirmed decisions

The human confirmed these rules on 2026-11-17.
They replace the study's initial proposal to keep existing records unchanged.

1. The catalog covers bowling balls only.
2. Staff can browse. The owner manages the catalog and imports.
3. Support CSV and Excel `.xlsx` files.
4. Stock imports can add balls and missing catalog entries.
5. Imports can update existing catalog and stock records.
6. An existing ball can have its measurements, boxed date, and location corrected.
   Require a reason for each batch that changes existing stock.
   Keep its serial number, UPC, and sale status fixed.
7. Match catalog entries by UPC. Show changes before saving.
8. Blank cells keep existing values.
   Clearing an optional value needs an explicit instruction.

## Goal and scope

The owner can maintain the catalog before receiving stock.
The owner can export the catalog and import catalog or stock files.
A stock file can add missing catalog entries in the same operation.
Staff can find catalog entries even when no balls are in stock.

In: catalog browse, search, create, edit, export, templates, and reviewed imports.
Out: other product categories, images, suppliers, costs, and catalog deletion.
Out: quantity-only stock, sale imports, identity changes, and offline writes.
No push or deployment is part of this plan.

## Import and export rules

- One catalog row means one UPC at one nominal weight.
- One stock row means one physical ball with a serial number.
- For a new catalog entry, require UPC, model name, and nominal weight.
- Permit the existing model details and selling price as optional fields.
- For a new ball, require a serial number and UPC.
  Use stored details for a known UPC when the file omits them.
  Require the model name and weight for a new UPC.
- Existing stock rows match by serial number.
  Reject a different UPC for an existing ball.
- Show catalog changes from a stock file in the same review.
  Repeated rows for one UPC must agree on supplied catalog values.
  Reject conflicting values rather than choosing the last row.
- Reject repeated serial numbers within one file.
- Keep the UPC and nominal weight fixed for existing catalog entries.
- Select a default active location for new balls.
  Permit an optional mapped location column for files with multiple locations.
  Resolve only exact, unambiguous active location names or IDs.
  A blank location keeps an existing ball's location.
  A new ball with a blank location uses the selected default.
- A transfer requires an in-stock ball, as in the current transfer rule.
  A measurement correction uses the existing owner correction rules.
- Blank cells keep values on existing records.
  Use `__CLEAR__` only to clear a supported optional field.
  Explain this marker in the template and review.
  Never treat it as a valid required field or identifier.
- Show unchanged rows separately. They create no movements.
- Limit each file to 5 MB and 1,000 data rows.
  Reject larger files with instructions to split them.
  Bound workbook expansion before processing all cells.
- Permit worksheet selection for `.xlsx` workbooks.
  Map columns before review. Require a unique mapping for each field.
  Do not execute formulas, macros, or external links.
  Reject formulas in mapped cells with a row error.
- Preserve UPC and serial text. Never invent missing identifier digits.
  Reject ambiguous dates and report the accepted date formats.
- Validate the complete batch before a write.
  Save the batch in one database transaction.
  On any error, save none of its catalog or stock changes.
- Revalidate at confirmation time.
  If a relevant record changed after review, require a new review.
- A retry keeps the batch request ID.
  Scope the saved result to the actor and the payload.
  A repeated ID with a different payload must fail.
- Export the complete catalog in CSV or `.xlsx`, with stable import headers.
  Page database reads so the default API row limit cannot truncate the export.
  Include all editable catalog fields. Exclude stock counts from import fields.
  Protect spreadsheet readers from formula injection.
  Verify identifier and text round trips in both formats.

## Design brief

Skills: `impeccable shape`, `mobile-native` during implementation.

Mode: Operate. Preserve the established brand and current component language.
This is an extension of the existing search and model-detail experience.
The current source and ADR 0002 take precedence over stale DESIGN.md text.

- Catalog lists all model and weight entries, including entries with zero stock.
  Search accepts a name, brand, UPC, or product code.
  Show name, brand, weight, UPC, and price in the results or detail.
- Add Catalog to the desktop rail.
  On phones, add a visible link from Stock and Account or Settings.
  Preserve the central Scan action and the current three phone tabs.
- Owners can add and edit a model without receiving a ball.
  Staff get read-only catalog details.
  Export is available to the owner with the management actions.
- Import has four steps: File, Columns, Review, and Result.
  File selects catalog or stock and a worksheet where needed.
  Review shows additions, before-and-after changes, unchanged rows, and errors.
  Each error names its source row and field.
  Confirmation names how many models and balls will change.
- Include empty, loading, invalid file, permission, stale review, saving,
  retry, and success states. Keep errors readable on phones.
  Warn before discarding a reviewed batch through app navigation.
  Announce progress and results. Restore focus after dialogs.
  Under reduced motion, nothing moves.

## Execution rules

Use a feature branch: `feat/catalog-file-import`.
Make one Conventional Commit per task area.
Run the technical tasks before the design pass.
Read the relevant installed Next.js guides before route or action code.
Load current Supabase documentation before database implementation.
Choose maintained file libraries at implementation time and commit the lockfile.
Use database functions for every stock change.
Never expose a privileged key to a client.
Keep the plan as the only active task list.

## Tasks

- [x] **T1. File contract and validation.** `tests: first`
  Skills: `tdd`, `codebase-design`.
  Build a file module for parsing, column mapping, validation, and export.
  Reuse label validators. Add model creation and price validation as needed.
  Acceptance: CSV quoting, Unicode, leading zeroes, workbook sheets,
  formulas, blank cells, clear markers, dates, duplicate mappings,
  duplicate serials, conflicting UPC rows, and limits have defined results.
  Completion: tests cross the module's public interface and pass.

- [x] **T2. Catalog writes and transactional imports.** `tests: first`
  Skills: `tdd`, `supabase`.
  Add migrations for owner catalog creation and batch commits.
  Keep existing stock function checks and movement rules.
  Add durable batch records with actor, request ID, payload identity,
  result, and before-and-after changes for catalog updates.
  Restrict batch records and writes to the owner.
  Acceptance: catalog-only creation adds no ball or movement.
  Mixed stock batches create missing models and receive new balls.
  Corrections and transfers write the required history and reason.
  Failures roll back the complete batch.
  Replay returns the original result without duplicate writes.
  Concurrent conflicts and stale reviews fail safely.
  Direct calls enforce permissions, field rules, and immutable identifiers.
  Completion: clean migration, permission, rollback, replay, and concurrency
  database tests pass.

- [x] **T3. Server reads, review, commit, and downloads.** `tests: first`
  Skills: `tdd`, `supabase`, `codebase-design`.
  Add authenticated catalog queries and owner actions for create and import.
  Generate the review from server data and recheck it on commit.
  Share import rules across preview and commit.
  Add templates and complete catalog downloads in both formats.
  Acceptance: client preview data cannot bypass validation or role checks.
  Existing scan intake uses newly created catalog entries.
  Exports include entries beyond one API page.
  Saved changes refresh catalog and stock data.
  Completion: server behavior tests and export round-trip tests pass.

- [ ] **D1. Catalog screens and navigation.** `tests: alongside`
  Skills: `impeccable`, `mobile-native`.
  Add catalog browse, detail, create, edit, and export controls.
  Reuse existing detail and price fields where practical.
  Add the agreed desktop and phone entry points.
  Acceptance: staff browse zero-stock entries; owners create and edit them.
  No ball is received by a catalog-only action.
  Completion: signed-in owner and staff browser probes pass on phone,
  tablet, and desktop layouts.

- [ ] **D2. File import screens.** `tests: alongside`
  Skills: `impeccable`, `mobile-native`, `break-ui`.
  Build the four import steps and their failure and recovery states.
  Acceptance: the owner can map an existing file, resolve errors,
  review additions and updates, give a reason, and commit once.
  A server conflict returns to review without a partial write.
  Completion: browser probes import catalog data and a mixed stock batch.
  The saved ball appears in Stock and has the expected history.

- [ ] **R1. Rendezvous.** `tests: alongside`
  Skills: `code-review`, `impeccable critique`, `impeccable audit`,
  `impeccable polish`, `break-ui`.
  Use independent read-only agents for review, tests, and the browser probe.
  Give each a distinct question. Record verdicts and evidence below.
  Run `npm test`, `npm run typecheck`, `npx eslint .`, and `npm run build`.
  Run graphify update after code changes.
  Exercise signed-in catalog creation and the actual import write.
  Check unauthorized requests, replay, stale review, and complete exports.
  Use at most two fix-and-recheck rounds.
  Acceptance: required checks pass and the first owner workflow works.
  Completion: record checks and freeze this plan.
  Keep finished code on its feature branch until approved to ship,
  because a push to main deploys production.

- [ ] **S1. Sync docs.** `tests: alongside` (documentation check)
  Skills: `writing-for-agents`, `domain-modeling`.
  Update spec.md and architecture.md for the approved behavior.
  Update setup.md with migration and file instructions.
  Update PRODUCT.md capability facts that are no longer current.
  Record the import identity and update rules in an ADR.
  Acceptance: remove stale statements that exclude file imports.
  Completion: documentation agrees with the code and recorded checks.

## Checks record

Execution in progress.

- T1: nine file tests pass.
- T2: 49 database tests pass, including 14 import tests.
- T3: 18 review tests and seven confirmation, pagination, and action tests pass.
- Unit suite: 173 tests pass.
- No remote schema changes or deployment have occurred.
