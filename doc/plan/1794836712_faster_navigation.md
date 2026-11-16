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

### [x] 3. Remove reads that wait without need (`tests: alongside`)

- Model page: read the model and its balls in parallel.
- Ball page: read the ball with its model in one query (`balls` with `ball_models(*)`).
- Stock list: read `stock_counts` and `ball_models` in parallel. Filter the models in code.
- Acceptance: the pages show the same data as before. Typecheck, lint, unit tests, and database tests pass.
- Complete when: the preview route and a signed-in local build show the same model, ball, and list data.

### [x] 4. Refresh one time after an action (`tests: alongside`)

- Remove `router.refresh()` from `ball-actions.tsx`. The server action already revalidates the layout.
- Acceptance: after a sale or a transfer, the ball page and the stock count show the new state without a manual reload.
- Complete when: this shows in a signed-in local build.

## Not in scope

- A database move to another region.
- Caching of stock data. Stock must stay live.

## Rendezvous checks (2026-11-16)

- `npm run typecheck`, `npx eslint .`, `npm test` (74 unit, 31 database), and `npm run build` pass.
- Local production build: a signed-out visit to `/` and to a ball page goes to `/login`.
- Local production build: a session cookie with a forged ES256 token goes to `/login` from the proxy. It does not reach `/login?error=inactive`. Thus `getClaims()` checks the signature.
- `code-review` (medium) found 9 items. Fixed: the stock list now reads each counted model that the catalog read did not return. This does not depend on the API row limit. Fixed: the ball page gets the signed photo URL in parallel with the other reads. Accepted: the revocation gap of `getClaims()` (open question 2). Not changed: the full catalog read, and the action refresh that depends on `revalidatePath`.
- Not checked: the signed-in pages and the actions. The agent has no account. The human tests on production after the push (open question 3). The agent checks `x-vercel-id` for `syd1` after the push.
- Release (2026-11-16): pushed `d8027ef..59878d7`. The marker `2026-11-16-fast-1` showed on the live site after approximately 40 s. `vercel inspect` shows the functions in `syd1` (deployment `dpl_9oBn99BL7ChBsrZx8SieTUUwz8so`). The `x-vercel-id` of the prerendered `/login` page still showed `iad1` one time. That page is not a function.
