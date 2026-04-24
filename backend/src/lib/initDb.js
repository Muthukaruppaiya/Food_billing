/**
 * Database auto-initializer.
 *
 * On backend startup this:
 *   1. Waits for a PostgreSQL connection.
 *   2. Runs `prisma db push` to create / sync all tables from schema.prisma.
 *   3. Seeds default admin/billing/waiter/chef users and default Setting row
 *      (only if no User rows exist yet).
 *
 * Safe to run every startup — `db push` is idempotent and seeding is gated.
 */

const { execSync } = require("child_process");
const path = require("path");
const prisma = require("./prisma");

const BACKEND_ROOT = path.resolve(__dirname, "..", "..");

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

    await waitForDatabase();
    console.log("  [initDb] PostgreSQL connection OK ✓");

    syncSchema();
    await seedDefaults();

    console.log("  [initDb] Database ready ✓\n");
}

module.exports = { initDatabase };
