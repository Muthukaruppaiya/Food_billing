/**
 * Database auto-initializer.
 *
 * On backend startup this:
 *   1. Ensures the target PostgreSQL database exists (creates it if missing).
 *   2. Waits for a PostgreSQL connection.
 *   3. Runs `prisma db push` to create / sync all tables from schema.prisma.
 *   4. Seeds default admin/billing/waiter/chef users and default Setting row
 *      (only if no User rows exist yet).
 *
 * Safe to run every startup — `db push` is idempotent and seeding is gated.
 */

const { execSync } = require("child_process");
const path = require("path");
const { Client } = require("pg");
const prisma = require("./prisma");

const BACKEND_ROOT = path.resolve(__dirname, "..", "..");

/**
 * Ensures the target database from DATABASE_URL exists; if not, connects to
 * the default `postgres` database and issues `CREATE DATABASE`.
 */
async function ensureDatabaseExists() {
    const url = process.env.DATABASE_URL;
    if (!url) {
        throw new Error(
            "DATABASE_URL is not set. Copy backend/.env.example to backend/.env and fill it in."
        );
    }

    let parsed;
    try {
        parsed = new URL(url);
    } catch (_e) {
        throw new Error(`Invalid DATABASE_URL: ${url}`);
    }

    const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    if (!dbName) return; // Nothing to create

    const adminClient = new Client({
        host: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : 5432,
        user: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
        database: "postgres" // connect to default DB to check/create target
    });

    try {
        await adminClient.connect();
        const { rows } = await adminClient.query(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            [dbName]
        );
        if (rows.length === 0) {
            console.log(`  [initDb] Database "${dbName}" not found — creating…`);
            await adminClient.query(`CREATE DATABASE "${dbName}"`);
            console.log(`  [initDb] Database "${dbName}" created ✓`);
        } else {
            console.log(`  [initDb] Database "${dbName}" exists ✓`);
        }
    } finally {
        await adminClient.end().catch(() => {});
    }
}

async function waitForDatabase(retries = 20, delayMs = 1500) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await prisma.$queryRaw`SELECT 1`;
            return true;
        } catch (err) {
            if (attempt === retries) {
                throw new Error(
                    `Could not connect to PostgreSQL after ${retries} attempts: ${err.message}`
                );
            }
            console.log(
                `  [initDb] Waiting for PostgreSQL… (attempt ${attempt}/${retries})`
            );
            await new Promise((r) => setTimeout(r, delayMs));
        }
    }
}

function syncSchema() {
    console.log("  [initDb] Running `prisma db push` to sync tables…");
    try {
        execSync("npx prisma db push --skip-generate --accept-data-loss", {
            cwd: BACKEND_ROOT,
            stdio: "inherit",
            env: process.env
        });
        console.log("  [initDb] Schema synced ✓");
    } catch (err) {
        throw new Error(`prisma db push failed: ${err.message}`);
    }
}

async function seedDefaults() {
    const userCount = await prisma.user.count();
    if (userCount > 0) {
        console.log(`  [initDb] ${userCount} users already exist — skipping seed.`);
    } else {
        console.log("  [initDb] No users found — seeding default demo users…");
        await prisma.user.createMany({
            data: [
                { username: "admin1",   password: "admin123",   role: "ADMIN"   },
                { username: "billing1", password: "billing123", role: "BILLING" },
                { username: "waiter1",  password: "waiter123",  role: "WAITER"  },
                { username: "chef1",    password: "chef123",    role: "CHEF"    }
            ],
            skipDuplicates: true
        });
        console.log("  [initDb] Seeded 4 demo users ✓");
    }

    await prisma.setting.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1 }
    });
}

async function initDatabase() {
    console.log("┌────────────────────────────────────────────┐");
    console.log("│  Initializing database…                     │");
    console.log("└────────────────────────────────────────────┘");

    await ensureDatabaseExists();
    await waitForDatabase();
    console.log("  [initDb] PostgreSQL connection OK ✓");

    syncSchema();
    await seedDefaults();

    console.log("  [initDb] Database ready ✓\n");
}

module.exports = { initDatabase };
