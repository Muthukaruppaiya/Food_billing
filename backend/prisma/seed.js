const { PrismaClient, Role } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  // Ensure a default settings row always exists
  await prisma.setting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 }
  });

  // Demo login users only — no menu, order, or inventory data seeded
  const users = [
    { username: "admin",       role: Role.ADMIN   },
    { username: "admin1",      role: Role.ADMIN   },
    { username: "cashier",     role: Role.BILLING },
    { username: "billing1",    role: Role.BILLING },
    { username: "mike_chef",   role: Role.CHEF    },
    { username: "chef1",       role: Role.CHEF    },
    { username: "john_waiter", role: Role.WAITER  },
    { username: "waiter1",     role: Role.WAITER  }
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { username: user.username },
      update: { role: user.role, active: true },
      create: user
    });
  }

  console.log("Seed complete: default settings + demo users created.");
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
