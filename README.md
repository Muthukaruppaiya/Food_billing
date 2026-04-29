# Hotel Billing App

A full-stack restaurant billing & order management system with **React** frontend and **Node.js + Express + MySQL (Prisma)** backend.

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
2. **MySQL ≥ 8.0** (or **5.7+** with utf8mb4) — <https://dev.mysql.com/downloads/>
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

Edit `backend/.env` (auto-created from `.env.example` on first startup) and set `DATABASE_URL` for **MySQL**:

```env
PORT=8080
DATABASE_URL=mysql://USER:PASSWORD@localhost:3306/hotel_billing
CLIENT_ORIGIN=http://localhost:3000
```

Use a user that can **CREATE DATABASE**, or create `hotel_billing` yourself and grant that user full access to it.

**Special characters in password** must be **URL-encoded** in `DATABASE_URL` (e.g. `@` → `%40`).

**You do NOT need to create tables manually** — the backend runs `prisma db push` on startup and creates them.

### Run the app

```bash
npm run dev
```

That single command does everything:

| Step | What happens |
|------|--------------|
| 1 | Starts the Node.js backend on `http://localhost:8080` |
| 2 | Auto-creates the `hotel_billing` database if missing (when credentials allow) |
| 3 | Syncs all tables (Prisma `db push`) |
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
│   │   ├── schema.prisma    # Database schema
│   │   └── seed.js          # Seed demo users / settings
│   ├── src/
│   │   ├── lib/
│   │   │   ├── initDb.js    # Auto DB creation + schema sync
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

**Database connection refused** — ensure MySQL is running, port `3306` (or your port) is correct, and `DATABASE_URL` user/password and database name match.

After switching from PostgreSQL to MySQL, use a **new** MySQL database (or `--force-reset`); data is not migrated automatically.

**Stale frontend cache after update** — In the browser, open DevTools → Application → Clear site data, then Ctrl+Shift+R.
