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

Accounts UI: `/accounts` (list, add, edit, delete).

## Commands

```bash
npm start    # ng serve
npm run build
```

## Note

Angular CLI 22 requires Node.js ≥ 22.22.3. This project uses Angular 21 so it builds on Node 22.12+. Upgrade Node to use Angular 22.
