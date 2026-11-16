# Plan: UI and motion redesign ("Find first")

Status: approved on 2026-11-16, in execution. Mode: design. Branch: `feat/ui-redesign`.
Study: [../study/1794816127_ui_motion_redesign.md](../study/1794816127_ui_motion_redesign.md). Sketch: [../study/assets/1794816127_find_first_sketch.html](../study/assets/1794816127_find_first_sketch.html).

## OPEN QUESTIONS

Closed on 2026-11-16. The human replied "approved" and did not answer the questions one by one. The agent took this as approval of each recommendation: 1 A (preview route with fixture data), 2 yes, 3 the redesign stays on its own branch, 4 the tagline shows on the sign-in screen only.

1. **How do I check the screens behind sign-in?** No test account exists.
   - A (recommended): I add a preview route that shows each screen with fixture data. It is in development builds only. It also gives the worst-case data test.
   - B: You give a test staff account on a Supabase project. I then check the real screens. A and B together are the best check.
2. **Search during typing.** Today the search starts on Enter. "Find first" needs results during typing. This sends a server request after each short pause in typing. Recommended: yes, with a 200 ms pause.
3. **Branch order.** `feat/ball-stock-v1` and `feat/batch-scan` are not on `main`. The batch scan still needs its browser check. Recommended: the redesign stays on its own branch on top of both. You decide the merge to `main` at rendezvous.
4. **Tagline.** "Every item. Accounted for." is still a proposal. Recommended: show it on the sign-in screen only. Say no to keep it out.

## Decisions already made

- The human's answers of 2026-11-16 are in the study. They are not open.
- Motion tool: React `<ViewTransition>`, which Next.js 16 supports with no configuration (`node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`), plus CSS transitions. No animation library is added.
- Toasts: `sonner`. This is the one new dependency.
- Light theme only.
- No change to the database functions, the label rules, or the server actions' behaviour.

## Rules for each task

- Read the related guide in `node_modules/next/dist/docs/` before code that touches layouts, routes, or view transitions.
- Read impeccable's `reference/craft-floor.md` immediately before each UI edit.
- Skills are named for each task. `mobile-native` applies to each task with a phone layout.
- After each task: `npm run typecheck`, `npx eslint .`, `npm run test:unit`.
- One Conventional Commit for each task.

## Tasks

### [x] 1. Record the decisions (`tests: none`, docs)

Skills: `domain-modeling` (ADR), `writing-for-agents` (AGENTS.md).

- Write `doc/adr/0001-brand-kit-confirmed-and-functional-motion.md`.
- In `AGENTS.md`: replace "No motion pass" with the functional motion rule. Remove the sentence that says PRODUCT.md and DESIGN.md do not exist. Change the brand line: the brand direction is confirmed; the tech stack is still a recommendation.
- In `doc/wiki/spec.md`: move the brand items to "Confirmed". Keep the tagline under "Proposed" unless question 4 changes it.
- Write the direction contract with `impeccable surface-brief write` for the app shell. Seed reference: `seed:90eb1cf2c1b0b5fd`.

Acceptance: the three files agree with the study. The surface brief has all six contract blocks.
Done when: committed as `docs:`.

### [ ] 2. Tokens and primitives (`tests: alongside`)

Skills: `/impeccable typeset`, `/impeccable layout`.

- `globals.css`: add the motion tokens (durations 120, 200, 320 ms; one ease-out curve; a faster exit), a type scale with fixed rem steps, and the gold "changed" mark colors. Add the reduced-motion rules one time, here.
- Primitives in `src/components/ui/`: button (action, primary, quiet; pending and done states), input, search field, weight chip, status badge, row, card, skeleton, sheet, toast host.
- Each primitive has default, hover, focus, active, disabled, and loading or error where it applies.
- The sketch shows the selected row and the changed row with a thick colored stripe on the left edge. Do not build that stripe. Show "selected" with a full navy outline and "changed" with a gold tint and a gold dot with a label. Give the search field and each bordered container 12px or more of inner space.
- Preview route with fixture data, if question 1 is A.

Acceptance: each primitive shows all its states on the preview route at 390, 820, and 1440px. Contrast is 4.5:1 or more for text. Controls are 48px high or more on touch layouts.
Done when: the preview route renders with no console error and the checks pass.

### [ ] 3. App shell (`tests: alongside`)

Skills: `/impeccable layout`, `mobile-native`.

- 1024px and wider: navy rail (logo, navigation, location, sign-out), list area, detail pane. The stock list stays mounted while the detail changes.
- Less than 1024px: top bar with logo and location, bottom tabs, detail as a full screen with a back control.
- Loading: skeletons in the shape of the real rows. Remove "Loading stock…".
- Keep `LiveRefresh`, the safe-area insets, and the owner-only Settings item.

Acceptance: at 1440px the list and the pane show together. At 390px one area shows at a time and the tab bar clears the home indicator. Keyboard focus order is rail, list, pane.
Done when: the three widths pass on the preview route.

### [ ] 4. Stock home: search and model rows (`tests: first` for logic)

Skills: `tdd`, `/impeccable layout`, `break-ui`.

- Tests first: move the grouping of models and counts out of `src/app/(app)/page.tsx` into `src/lib/stock/group.ts`. Tests cover: groups by brand and name, weights from heavy to light, totals, the search filter, a model with zero balls not shown.
- The search field leads the screen. It filters during typing (question 2). It keeps the `?q=` URL.
- Model row: name, brand and color, one chip for each weight with its count, total. A chip links to that model and weight.
- Serial number results, the "no stock yet" state, and the "no match" state with a clear action.
- Phone: the scan button is fixed above the tab bar.

Acceptance: the unit tests pass. A typed query changes the rows with no Enter. A long model name does not break a row at 390px. The empty states tell the staff member what to do next.
Done when: tests pass and the three widths pass on the preview route.

### [ ] 5. Model and ball detail (`tests: alongside`)

Skills: `/impeccable layout`, `mobile-native`, `break-ui`.

- Model detail: name, weight tag, price, the balls in stock with their values, model details. The owner's price form stays.
- Ball detail: serial number, status, values, actions (sold, move, and the owner actions with a reason), history, label photo.
- Actions open in a sheet on the phone and inline in the pane on large screens. The server actions and their request ids do not change.

Acceptance: each action that works today still works with the same inputs. A ball with no recorded values reads clearly. History reads in time order with the person and the place.
Done when: the three widths pass on the preview route, for staff and for owner.

### [ ] 6. Scan flow (`tests: alongside`)

Skills: `/impeccable layout`, `mobile-native`, `break-ui`.

- Split `scan-flow.tsx` into one file for each step (start, reading, confirm, batch) and one state hook. Behaviour does not change. The tests in `src/lib/label/` must pass with no edit.
- Start screen: the camera action is the main element. Gallery and "type the details" are secondary.
- Batch screen: each photo row shows its state with an icon and a label: reading, ready, needs a check, already recorded, saved.
- Confirm screen: the read values first, then the typed values, then the location and the save button.
- Add a prompt when the staff member leaves the scan with unsaved photos through the app navigation. Today only a tab close gives a warning.

Acceptance: single scan, batch scan, manual entry, and the duplicate serial message work as before. The leave prompt shows only when unsaved photos exist.
Done when: the flows pass on the preview route at 390px and 820px, and the label tests pass.

### [ ] 7. Sign-in and settings (`tests: alongside`)

Skills: `/impeccable layout`.

- Sign-in: logo, name, endorsement, form, the "ask the owner" line. Tagline per question 4.
- Settings: locations and staff accounts in the new primitives.

Acceptance: the forms work as before. Errors show at the field.
Done when: the three widths pass.

### [ ] 8. Motion pass (`tests: first` for the change logic)

Skills: `/impeccable animate`, `animate`, `animation-performance`.

- Tests first: `src/lib/stock/changes.ts` compares two count snapshots and returns the changed rows. Tests cover: a count up, a count down, a new model, no change, the first load (no marks).
- Focal moment: after a save, the scanned label becomes a saved row and the model count goes up.
- Continuity with `<ViewTransition>`: the detail pane change, the phone forward and back, rows that keep their identity during a search.
- Live change: the changed row holds a gold mark until the staff member touches it or it has been on screen for 8 seconds. The count ticks to the new value.
- Feedback: press states, the save button's pending and done states, toasts for saved, sold, and moved.
- Reduced motion: no movement; the mark, the color change, and the toast stay.

Acceptance: the unit tests pass. Each animation is transform or opacity only. No animation is longer than 320 ms except the focal moment (500 ms maximum). Two fast taps or a fast back do not leave an element in a wrong state. With reduced motion set, nothing moves.
Done when: the checks pass in Chrome and in Safari.

### [ ] 9. Rendezvous

- `npm test`, `npm run typecheck`, `npx eslint .`, `npm run build`.
- `impeccable detect --json` on the changed files, one time.
- `/impeccable critique`, `/impeccable audit`, `/impeccable polish`. `break-ui` on the stock, model, ball, and batch screens.
- Browser check at 390, 820, and 1440px. First thing a staff member does: sign in, type a model in the search, open a weight, open a ball. With a test account (question 1 B): one real scan and one sale.
- The impeccable finish review, then regenerate `DESIGN.md` and `.impeccable/design.json` from the build.
- `code-review` and `simplify`. `security-review` is not necessary if auth and data code did not change; run it if they did.
- Two fix rounds maximum. Then record the checks here and ask about the merge (question 3).

### [ ] 10. Sync docs

Skills: `writing-for-agents`.

- `doc/wiki/spec.md`: search during typing, the layout on each device, the motion rule, the leave prompt. Delete stale text.
- `doc/wiki/architecture.md`: why the list stays mounted, why view transitions and no animation library.
- Run `graphify update .`.

## Subagents

Tasks 5, 6, and 7 edit different files and can run in parallel worktrees after task 3. Tasks 1 to 4 and 8 run in the main session.

## Checks record

### Continuation on 2026-11-16

The branch still has uncommitted work for tasks 2 to 8. Do not treat an unchecked task as absent code. Check its acceptance criteria before marking it complete.

Claude's last saved record reports 70 unit tests and 30 database tests passed. It also reports a successful build and a phone preview navigation check. These are earlier results, not checks from this session.

Two independent, read-only reviews checked the current work against `5afda96` and this plan. One checked the scope. One checked correctness and access control. Neither found a new direct stock table write or a client secret.

The continuation fixed these defects:

- Warn before app links or sign-out discard a single unsaved photo. Keep the batch warning. Browser Back is not covered by this guard.
- Keep `?q=` when a detail route opens and the stock list stays mounted.
- Read serial results again when refreshed stock data arrives.
- Stop the change-mark timer when the tab is hidden. Start it again when the row and tab are visible.

The correctness reviewer checked these fixes again. Static review passed. Browser behavior is not yet verified.

Checks before the fixes: type check and lint passed. All 100 tests passed after the test command ran outside the sandbox. The first database run failed because the sandbox blocked Postgres shared memory.

Checks after the fixes: all 70 unit tests and lint passed. Type check first found stale generated references to the old ball and model route paths. Moving `.next/dev/types/validator.ts` out of the build cache restored a passing type check. No source route was removed. `graphify update .` completed. Its SQL extractor is unavailable because `tree_sitter_sql` is not installed.

The production build failed because Turbopack could not bind a local worker port (`Operation not permitted`). The same error remained after an escalated retry. This session does not have a passing production build.

The browser tool returned `The browser access host is unavailable`. No new browser check ran. Keep tasks 2 to 9 open until their required checks pass.

Known work still required under the existing tasks:

- Task 5: finish acceptance checks for each action and staff role. The phone sheets are implemented. See the second continuation below.
- Task 6: finish save and edit checks. Single-photo, batch duplicate detection, manual validation, and leave protection were checked on the real scan route. The preview still uses no-op callbacks for some controls.
- Task 9: complete the design review and detector, the browser checks at all three widths, and the production build. Check Chrome and Safari motion. Then ask about the merge.
- Task 10: sync the wiki and design records after the acceptance checks pass.

No merge or push was made. This record remains open until rendezvous completes.

### Second continuation on 2026-11-16

Added `ActionPanel`. Below 1024px it uses a native modal dialog as a bottom sheet. At 1024px and wider it opens inline. The same form stays mounted when the width changes. Escape and Cancel cannot dismiss a pending action. Closing returns focus to the clicked action button. The database actions and request IDs did not change.

A read-only review found no blocking defect. It identified a Safari focus risk from `document.activeElement`. The code now records the clicked button through `event.currentTarget`.

Native Chrome checks passed:

- At 390px: the sale sheet fits. Escape closes it and restores button focus.
- At 820px: the correction sheet fits. At 1440px: it becomes an inline form. The typed reason remains through the resize.
- Search filters without Enter. Opening a model keeps `?q=Hy-Road` in the address.
- The existing browser session can open the real `/scan` route. The sample photo reads the catalog model and detects the existing serial number.
- Selecting Stock or Sign out with that unsaved photo shows the leave warning. Cancel keeps the scan and session.
- Empty manual entry shows field errors and focuses Serial number.
- A batch sample changes from Reading to Already recorded. Save stays disabled. Leaving shows the warning. Removing the sample permits navigation to Stock without a warning.

These checks did not add, sell, move, or correct stock. They do not replace the remaining write checks, Safari checks, or real-phone checks. No new console errors appeared during the preview sheet checks.

All 70 unit tests passed after adding the sheet. Lint passed after the focus fix. `git diff --check` and `graphify update .` passed. A separate type check passed with a temporary config that excludes only the stale `.next/dev` tree and uses the project's type roots. This is a diagnostic check, not a pass for the required production build.

The Turbopack permission failure was cached. Moving the build cache aside allowed compilation to pass. The build then failed because the running dev server recreated stale route types for the old ball and model paths. A restart was requested. Automatic approval review could not complete because of an account usage limit. The restart was not executed. A passing production build is still required.

Changes remain uncommitted on `feat/ui-redesign`. Do not merge until the remaining rendezvous checks pass.

### Release request on 2026-11-16

The human requested publication to `ShmuelNg1212/CornerStock`. This approves shipping the current app and redesign. The repository is public and empty. No earlier production commit exists for rollback.

The stale dev server stopped. The clean production build passed. All 100 tests passed with the configured Supabase environment. The release marker is `2026-11-16-find-first-1` in page metadata. Verify this marker on the live sign-in page before calling the release complete.

The Vercel connection needs a team access grant. The consent link was presented to the human. Publication remains in progress. Safari, real-phone motion, and real stock-write checks remain unverified.

### First production release verified on 2026-11-16

- Published commit: `d8027ef4621219ed5bc81fb0924091daf4631ca6`.
- Deployment: `dpl_8kpxM8UBzNUZb2XphkAW9csZwbxY`. Vercel reports Ready.
- Production URL: https://cornerstock.vercel.app.
- The human approved public access to production. Preview deployments remain protected by Vercel.
- The live `/login` response is 200 and contains release marker `2026-11-16-find-first-1` and the sign-in form.
- Signed-out requests to `/` and `/preview` redirect to `/login`. Neither response contains fixture stock data.
- The first deployment used incorrect environment variable names. The successful deployment uses the required `NEXT_PUBLIC_` names. The server secret remains private.
- No earlier production release exists for rollback. Use the verified deployment above as the rollback target for the next release.

Publication is complete. Safari, real-phone motion, and live stock-write checks remain unverified. Do not treat publication as completion of these redesign checks.
