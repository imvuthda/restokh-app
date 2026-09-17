# Restaurant Management React + Vite Frontend

## Development

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Vite proxies `/api`, `/uploads`, and Socket.IO to `http://127.0.0.1:5000`.

## Production build

```powershell
npm run build
```

Serve the generated `dist/` folder with Nginx. Keep `VITE_API_URL=/api` when Nginx proxies `/api/` to Express.

Default login after importing the supplied database is `admin` / `Admin@123`.

The UI includes multi-branch switching for super admin, fixed branch access for
staff, user/role permissions, secure logout, live table management, resumable
POS orders, cashier shifts, split USD/KHR payments, and an 80 mm receipt view.
The administration layout has a persistent collapsible sidebar, grouped user
and branch management, a logged-in user menu in the fixed topbar, name-based
master-data selectors, and A4 printable sales/purchase/expense reports.
