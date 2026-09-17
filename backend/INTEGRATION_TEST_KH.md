# Integration Test — Windows / PowerShell

1. Import `database/99_full_database.sql` in HeidiSQL.
2. Copy `.env.example` to `.env` and set `DB_PASSWORD` plus a strong `JWT_SECRET`.
3. Terminal 1: `npm install` then `npm run dev`.
4. Terminal 2: `npm run test:integration`.

The test creates uniquely named test records and verifies:

`Health → Login → Tables → Menu/Ingredient/Recipe → Order → Guest discount/audit → Kitchen → Open cash shift → Payment → Stock deduction → Purchase Receive → Expense → Reservation → Confirm/Reserve table → Check-in/Open order → Payment/Complete reservation → Release table → Setting → Dashboard`

Success ends with `INTEGRATION TEST PASSED`. Test records are intentionally retained for inspection and can later be deactivated from the admin UI.
