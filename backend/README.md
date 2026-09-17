# Restaurant Management Express Backend

## Start

1. Import `database/99_full_database.sql`.
2. Copy `.env.example` to `.env` and set MySQL/JWT values.
3. Run `npm install` then `npm run dev`.
4. Check `http://localhost:5000/api/health`.

Initial database login: `admin` / `Admin@123` (change immediately).

## Route groups

- `/api/auth`: login, refresh, logout, me, change password
- `/api`: users, roles, permissions, branches, areas, tables, categories, menuItems, stations, units, ingredients, suppliers, customers
- `/api/orders`, `/api/kitchen`, `/api/payments`
- `/api/table-operations`, `/api/cash-registers`, `/api/cash-sessions`
- `/api/purchases`, `/api/inventory`, `/api/expenses`
- `/api/settings`, `/api/dashboard`, `/api/public/settings`

Non-super-admin users are always restricted to their assigned `branch_id`.
Payments support split tender, USD/KHR, cash shifts, ABA/KHQR references,
customer credit limits, idempotent retries, receipts, void reasons, and one-time
stock deduction. Logout immediately revokes the active access token.
