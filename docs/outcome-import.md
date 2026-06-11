# Card outcomes import (.xlsx)

Source: bank card statement export (example: `ex.xlsx` in project root).
Sheet name is typically "Виписки". Row 0 may be a period title; row 1 is the header row.

## Column mapping (spreadsheet column → Vault outcome field)

| Vault field | Spreadsheet column | Notes |
|-------------|-------------------|--------|
| Name | Опис операції | |
| Amount | Сума в валюті транзакції | Absolute value used |
| Date | Дата | DD.MM.YYYY, time part ignored |
| Category | Категорія | Matched via Gemini AI (see below) |
| Account | Картка | Last 4 digits matched to any value in account `card_ids` |

## Category matching (Supabase Edge Function + Gemini)

Functions: `gemini-ping` (example), `match-categories` (import)  
Secrets: `GEMINI_API_KEY`, `GEMINI_MODEL` (default `gemini-2.0-flash`)

Flow:

1. Parse the spreadsheet and resolve accounts by card last 4 digits.
2. `match-categories` edge function:
   - Look up bank category in `category_mappings` table (per user).
   - If missing, try exact match to a Vault outcome category name.
   - If still missing, call Gemini and save new row to `category_mappings`.
3. Unmapped values fall back to "Other" when it exists.
4. Rows still mapped to **Other** after bank-category analysis are re-matched using **Опис операції** (item name): saved `category_mappings`, exact category name, then substring match.

Database: run `supabase/migrations/category-mapping.sql` (when using edge-function matching).

Edge function: paste `supabase/match-categories.ts` → Edge Functions → `match-categories` → `index.ts`  
Secrets: `GEMINI_API_KEY`, `GEMINI_MODEL` (optional)  
POST `{ "statementText": "<parsed sheet as TSV>" }`

Configure `chatAiEndpoint` in `src/environments/environment.ts`.

## Import rules

- Only debit rows are imported: **Сума в валюті картки** must be negative (money leaving the card).
- Credits (positive card amount), e.g. "Зарахування зі своєї картки", are skipped.
- Account is resolved by the last 4 digits of the masked card number (e.g. `4627 **** **** 8458` → `8458`), checked against all IDs on the account.
- Rows with no matching account are assigned to an account named **Undefined** if it exists.
- Rows that cannot be resolved (invalid date/amount, missing category) are skipped; valid rows are saved to `outcomes`.

Implementation: `src/app/shared/utils/parse-statement.ts`, `src/app/shared/utils/read-xlsx.ts` (SheetJS).
