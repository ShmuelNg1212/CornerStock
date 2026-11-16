# Setup

## Local commands

| Task | Command |
|---|---|
| Install | `npm install` |
| Run the app | `npm run dev` |
| All tests | `npm test` |
| Unit tests only | `npm run test:unit` |
| Database tests only | `npm run test:db` |
| Type check | `npm run typecheck` |
| Lint | `npx eslint .` |
| Production build | `npm run build` |
| Make the app icons again | `node scripts/make-icons.mjs` |

The database tests start a temporary Postgres server. They need `initdb` and `pg_ctl` on the PATH (`brew install postgresql@17`). They do not need Docker or a Supabase project.

The label reading test calls the real vision model. It runs only when `ANTHROPIC_API_KEY` is set in the shell.

## First setup (human steps)

Do these steps one time.

1. Create a Supabase project at https://supabase.com/dashboard.
2. In the project, open Authentication > Sign In / Providers. Set "Allow new users to sign up" to off. Keep the Email provider on.
3. Open the SQL Editor. Paste all of `supabase/migrations/20261116000000_ball_stock.sql`. Run it one time.
4. Open Authentication > Users > Add user. Enter the owner's email and a password. Select "Auto Confirm User". The first account becomes the owner.
5. Get an API key for the Claude API at https://platform.claude.com.
6. Copy `.env.example` to `.env.local`. Fill in the four values. The Supabase values are in Project Settings > API.
7. Run `npm run dev`. Open http://localhost:3000. Sign in as the owner.
8. In Settings, add the other locations and the staff accounts.

To test on a phone before the deploy, the phone needs HTTPS for the camera. Use the deployed site, or a tunnel.

## Environment variables

| Name | Where it is used | Secret |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser and server | No. Row-level security limits it. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only: staff account creation | Yes |
| `ANTHROPIC_API_KEY` | Server only: label reading | Yes |
| `LABEL_MODEL` | Server only, optional. Default `claude-opus-5-5`. | No |

Never put a secret in a `NEXT_PUBLIC_` variable.

## Deploy (not done yet)

No remote and no Vercel project exist. When they exist:

1. Push the repository to GitHub. Import it in Vercel.
2. Add the environment variables above in Vercel, for Production.
3. Before each push to main: run `npm test` and `npm run build` with the production values of the `NEXT_PUBLIC_` variables.
4. Record the current production commit: `git rev-parse origin/main`.
5. Push. A release is complete only when the new version shows on the live site.
6. Rollback: in Vercel, open Deployments, select the previous deployment, and select "Promote to Production". Or revert the commit and push.

A version marker on the live site is not built yet. Add one before the first release.

A change to the database is a new file in `supabase/migrations/`. Run it in the SQL Editor before the push that needs it.
