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
| Update the barcode reader file after a `zxing-wasm` upgrade | `cp node_modules/zxing-wasm/dist/reader/zxing_reader.wasm public/` |

The database tests start a temporary Postgres server. They need `initdb` and `pg_ctl` on the PATH (`brew install postgresql@17`). They do not need Docker or a Supabase project.

## Home-screen startup images

iOS shows a startup image while the home-screen app opens. It needs one image for each screen size. The images are in `public/startup/`, and the list is in `src/lib/startup-images.json`. Android makes its own startup screen from the manifest color (`src/app/manifest.ts`) and the icon.

To make the images again, for example after a brand change or for a new iPhone size:

1. Add the screen size to `DEVICES` in `scripts/make-startup-images.mjs`, if needed.
2. Run `CHROME="<path to Chrome>" npx -y -p playwright-core node scripts/make-startup-images.mjs` from the project folder. If Node cannot find `playwright-core`, copy the script into a folder where it is installed, and run it from the project folder. The script needs the network for the fonts.
3. Commit `public/startup/` and `src/lib/startup-images.json`.

## First setup (human steps)

Do these steps one time.

1. Create a Supabase project at https://supabase.com/dashboard.
2. In the project, open Authentication > Sign In / Providers. Set "Allow new users to sign up" to off. Keep the Email provider on.
3. Open the SQL Editor. Paste all of `supabase/migrations/20261116000000_ball_stock.sql`. Run it one time.
4. Open Authentication > Users > Add user. Enter the owner's email and a password. Select "Auto Confirm User". The first account becomes the owner.
5. Copy `.env.example` to `.env.local`. Fill in the three values. The Supabase values are in Project Settings > API Keys. Use the publishable key (`sb_publishable_...`) and the secret key (`sb_secret_...`). Do not use the legacy `anon` and `service_role` keys: Supabase removes them at the end of 2026.
6. Run `npm run dev`. Open http://localhost:3000. Sign in as the owner.
7. In Settings, add the other locations and the staff accounts.

To test on a phone before the deploy, the phone needs HTTPS for the camera. Use the deployed site, or a tunnel.

## Environment variables

| Name | Where it is used | Secret |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server | No |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and server | No. Row-level security limits it. |
| `SUPABASE_SECRET_KEY` | Server only: staff account creation | Yes |

Never put a secret in a `NEXT_PUBLIC_` variable.

## Deploy

The GitHub remote is `https://github.com/ShmuelNg1212/CornerStock`. Production is https://cornerstock.vercel.app. The Vercel project is `cornerstock` in `shmuelng8310-5097s-projects`.

The first release was verified on 2026-11-16. Deployment `dpl_8kpxM8UBzNUZb2XphkAW9csZwbxY` serves commit `d8027ef`.

The current release was verified on 2026-11-17. Commit `92d4265` (fix: no sign-in loop for an account with no access). The release marker is `2026-11-17-no-access-1`. Rollback commit: `f086c00`. The checks after the push: the marker showed after approximately 40 s. A signed-out visit to `/` goes to `/login`. A browser probe on the live site signed in with a temporary account with no access, and with an account that was deactivated while signed in. Both stayed on the sign-in page with the no-access message and no session. The temporary accounts were deleted.

1. Push the repository to GitHub. Import it in Vercel.
2. Add the environment variables above in Vercel, for Production.
3. Before each push to main: run `npm test` and `npm run build` with the production values of the `NEXT_PUBLIC_` variables.
4. Record the current production commit: `git rev-parse origin/main`.
5. Push. A release is complete only when the new version shows on the live site.
   To see the function region, run `npx vercel inspect cornerstock.vercel.app --scope shmuelng8310-5097s-projects`. The `x-vercel-id` header of a prerendered page does not show it.
6. Rollback: in Vercel, open Deployments, select the previous deployment, and select "Promote to Production". Or revert the commit and push.

The sign-in HTML contains a `cornerstock-release` meta tag. Check this tag on the live site after deployment.

A change to the database is a new file in `supabase/migrations/`. Run it in the SQL Editor before the push that needs it.
