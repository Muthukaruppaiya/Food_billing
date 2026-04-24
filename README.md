# Hotel Billing App

A full-stack restaurant billing & order management system with **React** frontend and **Node.js + Express + PostgreSQL (Prisma)** backend.

- Admin, Waiter, Chef and Billing dashboards
- Real-time order updates via Socket.IO
- Image uploads for menu items
- 2-inch (58 mm) thermal printer receipt support
- Role-based authentication

---

## ⚡ Quick Start on a Fresh Machine

### Prerequisites

Install these once on the new system:

1. **Node.js ≥ 18** — <https://nodejs.org/>
2. **PostgreSQL ≥ 13** — <https://www.postgresql.org/download/>
3. **Git** — <https://git-scm.com/>

### Setup (first time only)

```bash
# 1. Clone the repo
git clone https://github.com/Muthukaruppaiya/Food_billing.git
cd Food_billing

# 2. Install ALL dependencies (frontend + backend together)
npm install
```

> `npm install` automatically installs both the frontend and the backend dependencies via a `postinstall` script.

### Configure the database

Edit `backend/.env` (auto-created from `.env.example` on first startup) and make sure `DATABASE_URL` matches **your** local PostgreSQL:

```env
PORT=8080
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/hotel_billing
CLIENT_ORIGIN=http://localhost:3000
```

**You do NOT need to create the database manually** — the backend will create it automatically on first run.

### Run the app

```bash
npm run dev
```

That single command does everything:

| Step | What happens |
|------|--------------|
| 1 | Starts the Node.js backend on `http://localhost:8080` |
| 2 | Auto-creates the `hotel_billing` database if missing |
| 3 | Auto-creates all 11 tables (Prisma `db push`) |
| 4 | Seeds 4 demo users + default Settings row (only if DB is empty) |
| 5 | Starts the React frontend on `http://localhost:3000` |

Then open <http://localhost:3000> in your browser.

---

## 🔐 Demo Login Accounts

Seeded automatically on first startup:

| Role    | Username  | Password    |
|---------|-----------|-------------|
| Admin   | admin1    | admin123    |
| Billing | billing1  | billing123  |
| Waiter  | waiter1   | waiter123   |
| Chef    | chef1     | chef123     |

---

## 🧰 Useful Commands

| Command | Description |
|---|---|
| `npm run dev` | Run frontend + backend together (recommended) |
| `npm run backend` | Run only the backend |
| `npm run frontend` | Run only the React frontend |
| `npm run build` | Build the frontend for production |
| `cd backend && npx prisma studio` | Open Prisma Studio (visual DB browser) |
| `cd backend && npx prisma db push --force-reset` | **⚠ Reset DB:** drop all tables and recreate |

---

## 📂 Project Structure

```
hotel-billing-app/
├── backend/                 # Node.js + Express + Prisma
│   ├── prisma/
│   │   ├── schema.prisma    # Database schema (11 tables)
│   │   └── seed.js          # Seed demo users / settings
│   ├── src/
│   │   ├── lib/
│   │   │   ├── initDb.js    # Auto DB creation + migrations
│   │   │   ├── prisma.js
│   │   │   └── socket.js    # Socket.IO singleton
│   │   ├── middleware/      # Auth + error handlers
│   │   ├── routes/api.js    # All REST endpoints
│   │   ├── app.js           # Express app config
│   │   └── server.js        # Entry point
│   ├── uploads/             # Uploaded images (not in git)
│   └── .env                 # Your local config (not in git)
├── src/                     # React frontend
│   ├── components/          # Admin / Billing / Chef / Waiter views
│   ├── context/             # Global state
│   └── services/            # API client + WebSocket
└── package.json             # Root – runs both frontend & backend
```

---

## 🧹 Troubleshooting

**Port 8080 already in use** — another Node process is holding it:

```bash
# Windows
netstat -ano | findstr ":8080"
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:8080 | xargs kill -9
```

**Port 3000 already in use** — same pattern, substitute `3000`.

**Database connection refused** — make sure PostgreSQL is running and `DATABASE_URL` in `backend/.env` has the correct host/port/user/password.

**Stale frontend cache after update** — In the browser, open DevTools → Application → Clear site data, then Ctrl+Shift+R.
