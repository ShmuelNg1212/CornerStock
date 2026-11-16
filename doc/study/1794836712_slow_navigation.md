# Study: slow page changes and actions

Date: 2026-11-16. Trigger: the human reports that page changes and actions feel slow.

## Findings

### 1. The server and the database are far apart

- The Supabase database is in AWS `ap-southeast-2` (Sydney). Source: the IP address of `db.tnbmzqfhtxjrrzjbgtwm.supabase.co` is in the AWS `ap-southeast-2` range.
- The Vercel functions run in `iad1` (Washington, DC, USA). Source: the `x-vercel-id` header of https://cornerstock.vercel.app/login is `sin1::iad1::…`. `sin1` is the edge near the user. `iad1` is the function.
- No `vercel.json` and no `preferredRegion` exist. Thus Vercel uses its default region.
- Each database call from the server thus crosses the Pacific. One round trip is approximately 200 ms.

### 2. Each request makes several database calls in sequence

The chain for the model page:

1. The proxy calls `supabase.auth.getUser()`. This is a network call to Supabase Auth.
2. `requireStaff()` calls `getUser()` again. This is a second network call.
3. `requireStaff()` then reads `profiles`.
4. The page reads `ball_models`.
5. The page reads `balls`. This waits for step 4, but it does not need its result.

The stock list reads `stock_counts`, then `ball_models`. The ball page reads `balls`, then five other reads in parallel.

On production, five calls in sequence are approximately 1 s before the first byte. A cold start adds more time.

### 3. Some refreshes happen two times

- Each server action calls `revalidatePath("/", "layout")`. This renders the full tree again.
- `ball-actions.tsx` then also calls `router.refresh()`. This renders the full tree a second time.

### 4. A local auth check is available

- The project signs tokens with an asymmetric key (ES256). The JWKS endpoint returns one key.
- `@supabase/supabase-js` 2.119.0 has `auth.getClaims()`. With an asymmetric key, it checks the token signature locally after it gets the key one time. It does not call Supabase Auth on each request.
- Trade-off: `getClaims()` does not see a session that was revoked on the server before the token expires (default: 1 hour). The `profiles` read stays on each request. Row-level security shows no profile to an inactive account. Thus a deactivated staff account still loses access on the next request.

## Measurements

- From this computer to Supabase: 165 ms to 550 ms for one HTTPS request.
- Production `/login`, time to first byte: 2.7 s for the first request (cold start), then 0.17 s to 0.19 s. `/login` makes no database call. The signed-in pages were not measured: no test account is available to the agent.
