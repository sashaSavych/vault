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

## Database

Run these in the Supabase **SQL Editor** in order (each file is safe to re-run):

| File | Entity |
|------|--------|
| `supabase/migrations/account.sql` | Accounts — balance, 4-digit `card_id` (default `0000`), RLS, default-account trigger |
| `supabase/migrations/transfer.sql` | Transfers — balance updates via triggers (requires accounts) |
| `supabase/migrations/category.sql` | Categories — tree, icons, `seed_default_categories()` |
| `supabase/migrations/income.sql` | Incomes — earnings, balance credit via triggers (requires accounts + categories) |
| `supabase/migrations/outcome.sql` | Outcomes — expenses, balance debit via triggers (requires accounts + categories) |
| `supabase/migrations/outcome-income-update.sql` | Patch — edit incomes/outcomes if updates fail (update RLS + balance triggers) |

- Accounts UI: `/accounts`
- Categories UI: `/categories` — defaults seeded via `seed_default_categories()` when a type is empty
- Outcomes UI: `/outcomes` — import bank `.xlsx` statements ([docs/outcome-import.md](docs/outcome-import.md))
- Transfers UI: `/transfers`

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
