<!-- ai-coding-master-workflow v2 -->
# Cornerstock: agent workflow

The human makes strategic decisions. The agent makes tactical decisions and records them outside the code.

## The spine

`study → plan → execute → rendezvous → sync docs`

This spine is the only workflow. Skill suites (superpowers, claude-mem make-plan/do, issue-driven flows) supply tools for its stages; their own workflows do not run.

**Size gate.** Work that fits one Conventional Commit goes straight to execute. Work fits one commit when it stays in one area and has one clear done condition. Larger work runs the full spine and stops after the plan for human approval. If the scope grows past one commit during execution, stop and ask.

**Mode.** For work past the size gate, start with one line naming the mode (technical, design, or mixed) and the skills from [doc/workflow/skills-per-stage.md](doc/workflow/skills-per-stage.md) that this work needs. Name them for each task. A check done once per session falls behind by the third task. Mixed runs the technical part first, then the design pass, before rendezvous.

### Stages

- **study**: write `doc/study/{date +%s}_{topic}.md`. Get the timestamp with `date +%s`. Commit as `docs:`.
- **plan**: write `doc/plan/{date +%s}_{topic}.md`. The plan is an editable task board for another session. Give each task a checkbox, acceptance criteria, and a completion criterion. Mark each task `tests: first` (rules and server logic) or `tests: alongside` (behaviour found by a browser probe). The plan then promises only what execute will do. The plan is the only list of active work. Put an **OPEN QUESTIONS** section near the top when human input is needed. Commit as `docs:`, present the plan, and wait. "Fold the answers in" or "reconstitute the plan" means: update the plan, then wait again.
- **execute**: make a feature branch. Write the tests before the code for `tests: first` tasks. Tick tasks in the plan doc as they finish. Continue until done or blocked.
- **rendezvous**: if code changed, run the tests and the review skills. Then exercise the first thing the user will do with the change (a page behind sign-in, a write). Do not test a page that works either way. A check counts only if it could fail for the reason the claim could be false. If only docs changed (study, plan, wiki), skip tests and review. Allow two fix-and-recheck rounds. If a check still fails after the second round, stop and ask. Then merge to main locally (see Git when a push to main deploys) and record the checks in the plan. The plan is frozen after this.
- **sync docs**: if behaviour changed, make `doc/wiki/` match the code. Delete stale text as well as adding new text.

### Skills per stage

Use a skill only when the task needs it. Skip it for small or clear work. The table is in [doc/workflow/skills-per-stage.md](doc/workflow/skills-per-stage.md). Read it when you name the mode.

### Fallbacks

- Memory: if claude-mem is missing in the current harness, read `doc/adr/`, the latest plans, and `git log` instead. Say so in one line.
- Design: impeccable is a Claude Code plugin. If it is missing in the current harness, use taste-skill (`design-taste-frontend`) if present. Otherwise skip the design pass. In both cases, say the fallback in one line at the start of the task.
- This workflow was set up in Claude Code. The Codex fallbacks are untested.

### Subagents

Subagents may run in execute, rendezvous, and sync docs. They may not run in plan: the plan is the human's approval gate.

- **execute**: spawn code-writing subagents only when the approved plan has 3 or more tasks and no two of them edit the same file. Code-writing subagents use git worktrees.
- **rendezvous**: spawn read-only subagents for independent checks: the review skills, the test run, a browser probe. Give each one a different question, and ask for a verdict, the evidence, and `file:line` for each finding. The main agent reads their findings, fixes what they find, and records the checks in the plan.
- **sync docs**: spawn one subagent per wiki page when 3 or more pages need changes. Each subagent edits only its own page. The main agent checks the result against the code.
- **study**: read-only explore agents may run wide searches.

Subagents never merge, push, or tick tasks in the plan. The main agent does these after it checks the subagent's result. Pass only the Git and Writing rules into a subagent prompt, not this whole file.

## Knowledge homes

Each kind of knowledge has one home. Look there first; write there only.

| Kind | Home |
|---|---|
| History of past work | claude-mem: search with `mem_search` before re-deriving past work. Do not write the harness's native memory files. |
| Code structure | graphify: run `graphify query "<question>"` before the first grep or source read; `graphify update .` after code changes. |
| Decisions | `doc/adr/` and `GLOSSARY.md`, written by `domain-modeling`. Write ADRs to `doc/adr/`, never `docs/adr/` |
| Current state | `doc/wiki/`: `spec.md`, and `architecture.md` and `setup.md` once they have content |
| Frozen records | `doc/study/`, `doc/plan/` |
| Skills table | `doc/workflow/skills-per-stage.md` |

- **spec.md** is living. Update behaviour facts freely during sync docs. Changes to intent (product rules, scope, money or settlement logic) go into the plan's OPEN QUESTIONS; edit spec.md only after approval, and add an ADR.
- **architecture.md** holds the intent behind the structure, not the structure itself.
- Add a wiki page only when a sync finds content that fits none of the existing pages.

## Git

- One Conventional Commit per change (`feat:`, `fix:`, `docs:`, `chore:`, `build:`, `refactor:`, `test:`). State how you scoped the work.
- Work on a feature branch; rendezvous merges to main locally. If a push to main deploys, main holds only what production has or what is approved to ship next: keep other finished work on its own branch. Approval names a change, but a push ships a branch.
- Before any push, list the commits that will go out and name any the approval did not cover.
- Push only when the human says "ship" or "push"; then run the push yourself. Never force-push.
- Release: a push to main will deploy when Vercel is connected. No remote and no Vercel project exist yet. These rules apply from the first connected push:
  - Before the push, run the test suite one time under the host's build environment variables. A build that fails safe also fails silently.
  - Before the push, record the previous commit hash for rollback.
  - A release is finished only when a marker unique to the new version shows on the live site. A push that returns is not a finished release.
  - The commands are in [doc/wiki/setup.md](doc/wiki/setup.md), section "Deploy".

## Writing

Write docs and plans in ASD-STE100: short sentences, one instruction per sentence, approved vocabulary. Deviate only when critical nuance would otherwise be lost. Replies to the human stay short and plain.

## Project facts

- Test command: `npm test`. It runs the unit tests and the database tests. The database tests need `initdb` on the PATH. Also run `npm run typecheck`, `npx eslint .`, and `npm run build`.
- Commands and first setup: [doc/wiki/setup.md](doc/wiki/setup.md). Reasons for the structure: [doc/wiki/architecture.md](doc/wiki/architecture.md).
- Stock changes go through the database functions in `supabase/migrations/`. Do not add a direct table write for stock.
- Cornerstock is a stock and inventory app for Bowlers Corner, a bowling supply shop at Sta. Lucia East Mall, Philippines. The name is confirmed. Do not restart naming work.
- Main function, set by the human: seamless recording of bowling ball stock, a live stock view for the whole store, and intake by a scan of the ball box label. Give this priority over other scope. Label fields: [doc/study/1794811730_ball_box_label.md](doc/study/1794811730_ball_box_label.md).
- The brand direction and the tech stack are recommendations, not confirmed decisions. See [doc/wiki/spec.md](doc/wiki/spec.md) for the confirmed and proposed lists.
- Brand source: [doc/study/1794811328_brand_kit_handoff.md](doc/study/1794811328_brand_kit_handoff.md) and its concept board. The board is a visual reference, not production artwork.
- Design tool: impeccable. No motion pass. PRODUCT.md and DESIGN.md are impeccable's design sources, not wiki pages. They do not exist yet; run `/impeccable init` and `/impeccable document` at the first design study.
- The UI ships to phones, tablets, and counter computers. Use `mobile-native` for phone work.
- Inventory rule: stock-changing operations are authoritative on the server and database. Never put a privileged database key in client code.
- The git guardrails hook is installed at user level (`~/.claude/hooks/block-destructive-git.sh`). Codex has no such hook; the push rule is a written rule there.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
