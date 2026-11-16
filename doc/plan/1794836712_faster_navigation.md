# Plan: faster page changes and actions

Status: approved on 2026-11-16, in execution. Mode: technical. Branch: `perf/latency`.
Study: [../study/1794836712_slow_navigation.md](../study/1794836712_slow_navigation.md).

Skills: none of the design skills. `code-review` at rendezvous.

## OPEN QUESTIONS

Closed on 2026-11-16. The human answered: 1 A (`syd1`), 2 yes (`getClaims()`), 3 the human tests on production after the push.

1. **Function region.** The functions run in Washington, DC. The database is in Sydney.
   - A (recommended): run the functions in `syd1` (Sydney), next to the database. Each database call then takes a few milliseconds. The user in Manila has one longer trip to Sydney for each request, not five.
   - B: move the database to Singapore and run the functions in `sin1`. This is closer to the shop, but a database move is a large, risky job. Not recommended now.
2. **Auth check.** Use `getClaims()` (local check) in place of `getUser()` (network call) in the proxy and in `requireStaff()`? Recommended: yes. Trade-off: a session that is revoked on the server stays valid until its token expires (1 hour at most). Deactivated accounts still lose access at once, because the `profiles` check stays.
3. **Check on production.** The agent has no account. Recommended: after the push, you open a model page and a ball page and say if they feel faster. The agent checks the region in the `x-vercel-id` header. Alternative: give the agent a test staff account. The agent then measures the time of each signed-in page before and after.

## Tasks

### [x] 1. Run the functions next to the database (`tests: alongside`)

- Add `vercel.json` with `"regions": ["syd1"]`.
- Record the region and the reason in `doc/wiki/architecture.md`.
- Acceptance: after the deploy, `x-vercel-id` on `/login` ends with a `syd1` function id (`…::syd1::…`).
- Complete when: the header check passes on production.
- Done in code. The header check runs after the push.

### [x] 2. Check the session locally (`tests: alongside`)

- In `src/proxy.ts` and `requireStaff()`: use `supabase.auth.getClaims()`. Use `claims.sub` as the user id.
- Keep the `profiles` read in `requireStaff()`.
- Acceptance: a signed-out visit to `/` goes to `/login`. A signed-in owner sees the stock list. An inactive account goes to `/login?error=inactive`.
- Complete when: the three checks pass in a local production build.

### [ ] 3. Remove reads that wait without need (`tests: alongside`)

- Model page: read the model and its balls in parallel.
- Ball page: read the ball with its model in one query (`balls` with `ball_models(*)`).
- Stock list: read `stock_counts` and `ball_models` in parallel. Filter the models in code.
- Acceptance: the pages show the same data as before. Typecheck, lint, unit tests, and database tests pass.
- Complete when: the preview route and a signed-in local build show the same model, ball, and list data.

### [ ] 4. Refresh one time after an action (`tests: alongside`)

- Remove `router.refresh()` from `ball-actions.tsx`. The server action already revalidates the layout.
- Acceptance: after a sale or a transfer, the ball page and the stock count show the new state without a manual reload.
- Complete when: this shows in a signed-in local build.

## Not in scope

- A database move to another region.
- Caching of stock data. Stock must stay live.
