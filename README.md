# Vault

Angular app with [PrimeNG](https://primeng.org/) and [Tailwind CSS](https://tailwindcss.com/).

## Stack

- Angular 21 (standalone, routing, SCSS components)
- PrimeNG 21 + Aura theme (`@primeuix/themes`)
- Tailwind CSS 4 + `tailwindcss-primeui`

## Supabase auth setup

1. Create a project at [supabase.com](https://supabase.com).
2. In **Project Settings → API**, copy the **Project URL** and **publishable** key.
3. Copy the example env file and add your credentials (`environment.ts` is gitignored):

   ```bash
   cp src/environments/environment.example.ts src/environments/environment.ts
   ```
4. In **Authentication → Providers**, enable **Email** (enabled by default).
5. For local dev without email confirmation, disable **Confirm email** under **Authentication → Sign In / Providers → Email**, or confirm users from the Supabase dashboard.

Auth routes: `/login`, `/signup`. The home route (`/`) requires a signed-in session.

## Database (accounts)

Run `supabase/migrations/001_accounts.sql` in the Supabase **SQL Editor** (safe to re-run). It creates the `accounts` table, `balance` column, RLS policies, and default-account trigger. Each row is scoped to `auth.uid()`.

Accounts UI: `/accounts` (list, add, edit, delete). Run `008_accounts_id_required.sql` for the 4-digit account ID (`card_id`, default `0000`).

Run `supabase/migrations/004_transfers.sql` for transfers (updates balances via triggers).

Transfers UI: `/transfers` (list, create, delete; cross-currency rate support).

Run `supabase/migrations/005_categories.sql` for categories (table, RLS, `seed_default_categories()`). If 005 was applied earlier, also run `006_seed_default_categories.sql`.

Categories UI: `/categories` — all categories live in Supabase; defaults are seeded via `seed_default_categories()` when a type is empty.

## GitHub Pages delivery

Deploys from the **github-pages** environment via [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml).

1. **Settings → Environments → github-pages** — set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (as environment variables or secrets).
2. **Settings → Pages → Source** — **GitHub Actions**.
3. Push to `main` (or run the workflow manually).

Live site: [https://sashasavych.github.io/vault/](https://sashasavych.github.io/vault/)

## Commands

```bash
npm start    # ng serve
npm run build
npm run build:pages   # same build as GitHub Pages (/vault/ base href)
```

## Note

Angular CLI 22 requires Node.js ≥ 22.22.3. This project uses Angular 21 so it builds on Node 22.12+. Upgrade Node to use Angular 22.
