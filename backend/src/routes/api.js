const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { emitEvent } = require("../lib/socket");
const { requireAuth, allowRoles, validateBody } = require("../middleware/auth");

const router = express.Router();

// ── File upload setup ─────────────────────────────────────────────────────────

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB per file
});
// Accept both: image (actual file) and menuItem (JSON sent as Blob by old browser cache)
const uploadMenu = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'menuItem', maxCount: 1 }
]);

// ── Utility helpers ───────────────────────────────────────────────────────────

const num = (v) => Number(v || 0);
const toDateStr = (d) => new Date(d).toISOString().split("T")[0];

// Prisma include for orders: join each OrderItem → MenuItem to get the name
const ITEM_INCLUDE = { include: { menuItem: true } };

/** Normalize an Order row from DB to the shape the frontend expects */
function toApiOrder(order) {
  if (!order) return null;
  return {
    ...order,
    items: (order.items || []).map((item) => ({
      id: item.id,
      orderId: item.orderId,
      menuItemId: item.menuItemId,
      itemName: item.menuItem ? item.menuItem.name : (item.itemName || ""),
      quantity: item.quantity,
      price: item.price,
      itemStatus: item.itemStatus,
      status: item.itemStatus, // alias used by ChefView
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }))
  };
}

/**
 * Normalize a Purchase row from DB to the shape the frontend expects.
 * Schema uses: itemName, supplierName, totalPrice
 * Frontend uses: item, supplier, total, time
 */
function toApiPurchase(p) {
  if (!p) return null;
  return {
    ...p,
    item: p.itemName,
    supplier: p.supplierName,
    total: p.totalPrice,
    time: p.createdAt
      ? new Date(p.createdAt).toTimeString().split(" ")[0]
      : null
  };
}

/**
 * Map a frontend purchase payload to DB schema field names.
 * Frontend sends: { item, supplier, quantity, unitPrice, total, purchaseDate, notes }
 * Schema expects: { itemName, supplierName, quantity, unitPrice, totalPrice, purchaseDate, notes }
 */
function fromFrontendPurchase(body) {
  const qty = parseFloat(body.quantity) || 0;
  const unit = parseFloat(body.unitPrice) || 0;
  return {
    itemName: body.item || body.itemName || "",
    supplierName: body.supplier || body.supplierName || "",
    quantity: qty,
    unitPrice: unit,
    totalPrice:
      body.total != null ? parseFloat(body.total) : +(qty * unit).toFixed(2),
    purchaseDate:
      body.purchaseDate || new Date().toISOString().split("T")[0],
    notes: body.notes || null
  };
}

function parseMenuItemPayload(value) {
  if (!value) return {};
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch (_e) { return {}; }
  }
  if (typeof value === "object") return value;
  return {};
}

/**
 * Sanitize raw menu item data into only the fields Prisma expects,
 * ensuring correct types (especially price → string for Decimal).
 */
function sanitizeMenuItemData(raw) {
  const data = {};
  if (raw.name != null) data.name = String(raw.name);
  if (raw.price != null) data.price = parseFloat(raw.price) || 0;
  if (raw.type != null) data.type = String(raw.type);
  if (raw.imageUrl != null) data.imageUrl = String(raw.imageUrl) || null;
  if (raw.isActive != null) data.isActive = Boolean(raw.isActive);
  return data;
}

async function getSettings() {
  return prisma.setting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 }
  });
}

async function getNextToken() {
  const max = await prisma.order.aggregate({ _max: { tokenNumber: true } });
  return (max._max.tokenNumber || 0) + 1;
}

async function calcTotals(items, enableTax = true) {
  let subtotal = 0;
  for (const it of items) subtotal += num(it.price) * num(it.quantity);
  const cgst = enableTax ? +(subtotal * 0.025).toFixed(2) : 0;
  const sgst = enableTax ? +(subtotal * 0.025).toFixed(2) : 0;
  const total = +(subtotal + cgst + sgst).toFixed(2);
  return { subtotal, cgst, sgst, total };
}

// ── Menu ──────────────────────────────────────────────────────────────────────

router.get("/menu", requireAuth, async (_req, res, next) => {
  try {
    const rows = await prisma.menuItem.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" }
    });
    res.json(rows);
  } catch (e) { next(e); }
});

router.get("/menu/:id", requireAuth, async (req, res, next) => {
  try {
    const row = await prisma.menuItem.findUnique({ where: { id: +req.params.id } });
    if (!row) return res.status(404).json({ message: "Menu item not found" });
    return res.json(row);
  } catch (e) { next(e); }
});

// JSON-only create (no image)
router.post("/menu/json", requireAuth, allowRoles(["ADMIN"]), async (req, res, next) => {
  try {
    const data = sanitizeMenuItemData(req.body);
    const row = await prisma.menuItem.create({ data });
    res.json(row);
  } catch (e) { next(e); }
});

// Multipart create (with optional image)
router.post("/menu", requireAuth, allowRoles(["ADMIN"]), uploadMenu, async (req, res, next) => {
  try {
    const _imageFile = req.files && req.files['image'] && req.files['image'][0];
    const _menuItemFile = req.files && req.files['menuItem'] && req.files['menuItem'][0];

    // menuItem JSON arrives either as a text field (new frontend) or as a file/Blob (old cached frontend)
    let menuItemJson = req.body.menuItem;
    if (!menuItemJson && _menuItemFile) {
      menuItemJson = fs.readFileSync(_menuItemFile.path, 'utf8');
      fs.unlinkSync(_menuItemFile.path); // clean up temp JSON file
    }

    const raw = menuItemJson ? parseMenuItemPayload(menuItemJson) : req.body;
    const imageUrl = _imageFile ? `/uploads/${_imageFile.filename}` : null;
    const data = sanitizeMenuItemData(raw);
    if (imageUrl) data.imageUrl = imageUrl;
    const row = await prisma.menuItem.create({ data });
    res.json(row);
  } catch (e) { next(e); }
});

router.put("/menu/:id", requireAuth, allowRoles(["ADMIN"]), uploadMenu, async (req, res, next) => {
  try {
    const _imageFile = req.files && req.files['image'] && req.files['image'][0];
    const _menuItemFile = req.files && req.files['menuItem'] && req.files['menuItem'][0];
    let menuItemJson = req.body.menuItem;
    if (!menuItemJson && _menuItemFile) {
      menuItemJson = fs.readFileSync(_menuItemFile.path, 'utf8');
      fs.unlinkSync(_menuItemFile.path);
    }
    const raw = menuItemJson ? parseMenuItemPayload(menuItemJson) : req.body;
    const data = sanitizeMenuItemData(raw);
    if (_imageFile) data.imageUrl = `/uploads/${_imageFile.filename}`;
    const row = await prisma.menuItem.update({
      where: { id: +req.params.id },
      data
    });
    res.json(row);
  } catch (e) { next(e); }
});

router.delete("/menu/:id", requireAuth, allowRoles(["ADMIN"]), async (req, res, next) => {
  try {
    await prisma.menuItem.update({
      where: { id: +req.params.id },
      data: { isActive: false }
    });
    res.status(204).send();
  } catch (e) { next(e); }
});

// ── Users ─────────────────────────────────────────────────────────────────────

router.get("/users", requireAuth, allowRoles(["ADMIN", "BILLING"]), async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({ orderBy: { id: "asc" } });
    res.json(users.map(u => ({ ...u, displayName: u.username })));
  } catch (e) { next(e); }
});

router.post(
  "/users/login",
  validateBody(z.object({ username: z.string().min(1) })),
  async (req, res, next) => {
    try {
      const username = req.body.username.trim();
      const roleByUsername = {
        admin: "ADMIN",      admin1: "ADMIN",
        cashier: "BILLING",  billing1: "BILLING",
        mike_chef: "CHEF",   chef1: "CHEF",
        john_waiter: "WAITER", waiter1: "WAITER"
      };

      let user = await prisma.user.findUnique({ where: { username } });
      if (!user) {
        const inferredRole = roleByUsername[username.toLowerCase()] || "BILLING";
        user = await prisma.user.create({ data: { username, role: inferredRole } });
      }
      res.json(user);
    } catch (e) { next(e); }
  }
);

router.post("/users", requireAuth, allowRoles(["ADMIN"]), async (req, res, next) => {
  try {
    const { username, password, role } = req.body;
    const user = await prisma.user.create({ data: { username, password, role: role?.toUpperCase() } });
    res.json({ ...user, displayName: username });
  } catch (e) { next(e); }
});

router.put("/users/:id", requireAuth, allowRoles(["ADMIN"]), async (req, res, next) => {
  try {
    const { password, role } = req.body;
    const updateData = { role: role?.toUpperCase() };
    if (password) updateData.password = password;
    const user = await prisma.user.update({ where: { id: +req.params.id }, data: updateData });
    res.json({ ...user, displayName: user.username });
  } catch (e) { next(e); }
});

router.delete("/users/:id", requireAuth, allowRoles(["ADMIN"]), async (req, res, next) => {
  try {
    await prisma.user.delete({ where: { id: +req.params.id } });
    res.status(204).send();
  } catch (e) { next(e); }
});

// ── Orders ────────────────────────────────────────────────────────────────────

router.get("/orders", requireAuth, async (req, res, next) => {
  try {
    const where = req.query.status
      ? { status: String(req.query.status).toUpperCase() }
      : {};
    const rows = await prisma.order.findMany({
      where,
      include: { items: ITEM_INCLUDE },
      orderBy: { createdAt: "desc" }
    });
    res.json(rows.map(toApiOrder));
  } catch (e) { next(e); }
});

router.get("/orders/:tokenNumber", requireAuth, async (req, res, next) => {
  try {
    const row = await prisma.order.findUnique({
      where: { tokenNumber: +req.params.tokenNumber },
      include: { items: ITEM_INCLUDE }
    });
    if (!row) return res.status(404).json({ message: "Order not found" });
    return res.json(toApiOrder(row));
  } catch (e) { next(e); }
});

router.post("/orders", requireAuth, async (req, res, next) => {
  try {
    const settings = await getSettings();
    const tokenNumber = await getNextToken();
    const ids = req.body.items.map((i) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({ where: { id: { in: ids } } });
    const map = new Map(menuItems.map((m) => [m.id, num(m.price)]));
    const itemsWithPrice = req.body.items.map((i) => ({
      ...i,
      price: map.get(i.menuItemId) || 0
    }));
    const totals = await calcTotals(itemsWithPrice, settings.enableTax);

    const row = await prisma.order.create({
      data: {
        tokenNumber,
        tableNumber: String(req.body.tableNumber || "0"),
        orderType:
          String(req.body.tableNumber || "0") === "0" ? "PARCEL" : "DINE_IN",
        ...totals,
        items: {
          create: itemsWithPrice.map((i) => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            price: i.price
          }))
        }
      },
      include: { items: ITEM_INCLUDE }
    });

    await prisma.notification.create({
      data: { message: `New order placed: ${String(tokenNumber).padStart(4, "0")}` }
    });
    emitEvent("message", { type: "NEW_ORDER", status: row.status, tokenNumber: row.tokenNumber });
    res.json(toApiOrder(row));
  } catch (e) { next(e); }
});

router.put("/orders/:tokenNumber", requireAuth, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { tokenNumber: +req.params.tokenNumber }
    });
    if (!order) return res.status(404).json({ message: "Order not found" });

    const ids = req.body.items.map((i) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({ where: { id: { in: ids } } });
    const map = new Map(menuItems.map((m) => [m.id, num(m.price)]));
    const items = req.body.items.map((i) => ({
      ...i,
      price: map.get(i.menuItemId) || 0
    }));
    const totals = await calcTotals(items, true);

    await prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { orderId: order.id } });
      await tx.order.update({
        where: { id: order.id },
        data: {
          tableNumber: String(req.body.tableNumber || order.tableNumber),
          ...totals
        }
      });
      await tx.orderItem.createMany({
        data: items.map((i) => ({
          orderId: order.id,
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          price: i.price
        }))
      });
    });

    res.json(
      toApiOrder(
        await prisma.order.findUnique({
          where: { id: order.id },
          include: { items: ITEM_INCLUDE }
        })
      )
    );
  } catch (e) { next(e); }
});

router.patch("/orders/:tokenNumber/status", requireAuth, async (req, res, next) => {
  try {
    const row = await prisma.order.update({
      where: { tokenNumber: +req.params.tokenNumber },
      data: { status: String(req.body.status).toUpperCase() },
      include: { items: ITEM_INCLUDE }
    });
    emitEvent("message", { type: "ORDER_UPDATE", status: row.status, tokenNumber: row.tokenNumber });
    res.json(toApiOrder(row));
  } catch (e) { next(e); }
});

router.patch(
  "/orders/:tokenNumber/items/:itemId/status",
  requireAuth,
  async (req, res, next) => {
    try {
      await prisma.orderItem.update({
        where: { id: +req.params.itemId },
        data: { itemStatus: String(req.body.status).toUpperCase() }
      });
      const row = await prisma.order.findUnique({
        where: { tokenNumber: +req.params.tokenNumber },
        include: { items: ITEM_INCLUDE }
      });
      res.json(toApiOrder(row));
    } catch (e) { next(e); }
  }
);

// ── Parcel Orders ─────────────────────────────────────────────────────────────

router.post("/orders/parcel", requireAuth, async (req, res, next) => {
  try {
    const settings = await getSettings();
    const tokenNumber = await getNextToken();
    const ids = req.body.items.map((i) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({ where: { id: { in: ids } } });
    const map = new Map(menuItems.map((m) => [m.id, num(m.price)]));
    const itemsWithPrice = req.body.items.map((i) => ({
      ...i,
      price: map.get(i.menuItemId) || 0
    }));
    const totals = await calcTotals(itemsWithPrice, settings.enableTax);

    const row = await prisma.order.create({
      data: {
        tokenNumber,
        tableNumber: "0",
        orderType: "PARCEL",
        paymentMethod: (req.body.paymentMethod || "CASH").toUpperCase(),
        waiterId: req.body.waiterId || null,
        customerName: req.body.customerName || null,
        notes: req.body.notes || null,
        ...totals,
        items: {
          create: itemsWithPrice.map((i) => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            price: i.price
          }))
        }
      },
      include: { items: ITEM_INCLUDE }
    });

    await prisma.notification.create({
      data: { message: `New parcel order: ${String(tokenNumber).padStart(4, "0")}` }
    });
    emitEvent("message", { type: "NEW_ORDER", status: row.status, tokenNumber: row.tokenNumber });
    res.json(toApiOrder(row));
  } catch (e) { next(e); }
});

router.get("/orders/parcel/all", requireAuth, async (_req, res, next) => {
  try {
    const rows = await prisma.order.findMany({
      where: { orderType: "PARCEL" },
      include: { items: ITEM_INCLUDE },
      orderBy: { createdAt: "desc" }
    });
    res.json(rows.map(toApiOrder));
  } catch (e) { next(e); }
});

router.get("/orders/parcel/summary", requireAuth, async (req, res, next) => {
  try {
    const date = req.query.date || toDateStr(new Date());
    const rows = await prisma.order.findMany({ where: { orderType: "PARCEL" } });
    const f = rows.filter((r) => toDateStr(r.createdAt) === date);
    res.json({
      date,
      totalOrders: f.length,
      totalAmount: f.reduce((a, b) => a + num(b.total), 0)
    });
  } catch (e) { next(e); }
});

router.post("/orders/parcel/cancel/:token", requireAuth, async (req, res, next) => {
  try {
    res.json(
      await prisma.order.update({
        where: { tokenNumber: +req.params.token },
        data: { status: "CANCELLED" }
      })
    );
  } catch (e) { next(e); }
});

router.patch("/orders/parcel/:token/status", requireAuth, async (req, res, next) => {
  try {
    res.json(
      await prisma.order.update({
        where: { tokenNumber: +req.params.token },
        data: { status: String(req.body.status).toUpperCase() }
      })
    );
  } catch (e) { next(e); }
});

// ── Billing ───────────────────────────────────────────────────────────────────

router.get(
  "/billing/table/:tableNumber/pending-tokens",
  requireAuth,
  async (req, res, next) => {
    try {
      const rows = await prisma.order.findMany({
        where: { tableNumber: req.params.tableNumber, billed: false },
        orderBy: { tokenNumber: "asc" }
      });
      res.json(rows.map((r) => r.tokenNumber));
    } catch (e) { next(e); }
  }
);

router.post("/billing/generate-bill", requireAuth, async (req, res, next) => {
  try {
    const tokens = (req.body.tokenNumbers || []).map(t => parseInt(t, 10)).filter(t => !isNaN(t));
    const rows = await prisma.order.findMany({
      where: { tokenNumber: { in: tokens } },
      include: { items: true }
    });
    const subtotal = rows.reduce((a, b) => a + num(b.subtotal), 0);
    const cgst = rows.reduce((a, b) => a + num(b.cgst), 0);
    const sgst = rows.reduce((a, b) => a + num(b.sgst), 0);
    res.json({
      tableNumber: req.body.tableNumber,
      tokenNumbers: tokens,
      subtotal,
      cgst,
      sgst,
      total: subtotal + cgst + sgst
    });
  } catch (e) { next(e); }
});

router.post("/billing/close-tokens", requireAuth, async (req, res, next) => {
  try {
    const tokens = (req.body.tokenNumbers || []).map(t => parseInt(t, 10)).filter(t => !isNaN(t));
    const rows = await prisma.order.findMany({
      where: { tokenNumber: { in: tokens } }
    });
    const subtotal = rows.reduce((a, b) => a + num(b.subtotal), 0);
    const cgst = rows.reduce((a, b) => a + num(b.cgst), 0);
    const sgst = rows.reduce((a, b) => a + num(b.sgst), 0);
    const total = subtotal + cgst + sgst;
    const max = await prisma.bill.aggregate({ _max: { billNumber: true } });
    const billNumber = (max._max.billNumber || 0) + 1;

    const bill = await prisma.$transaction(async (tx) => {
      await tx.order.updateMany({
        where: { tokenNumber: { in: tokens } },
        data: { billed: true, status: "BILLED" }
      });
      return tx.bill.create({
        data: {
          billNumber,
          tableNumber: String(req.body.tableNumber || "0"),
          subtotal,
          cgst,
          sgst,
          total,
          discount: num(req.body.discount || 0),
          paymentMethod: (req.body.paymentMethod || "CASH").toUpperCase(),
          tokenNumbers: tokens.join(",")
        }
      });
    });
    res.json(bill);
  } catch (e) { next(e); }
});

router.get("/billing/bill/:billNumber", requireAuth, async (req, res, next) => {
  try {
    res.json(
      await prisma.bill.findUnique({ where: { billNumber: +req.params.billNumber } })
    );
  } catch (e) { next(e); }
});

router.get("/billing/bills", requireAuth, async (req, res, next) => {
  try {
    const s = new Date(req.query.startDate);
    const e = new Date(req.query.endDate);
    e.setHours(23, 59, 59, 999);
    res.json(
      await prisma.bill.findMany({
        where: { createdAt: { gte: s, lte: e } },
        orderBy: { createdAt: "desc" }
      })
    );
  } catch (e) { next(e); }
});

router.post("/billing/split-bill", requireAuth, async (req, res) => {
  res.json({ ...req.body, message: "Split bill preview generated" });
});

router.get("/billing/daily-sales", requireAuth, async (_req, res, next) => {
  try {
    const today = toDateStr(new Date());
    const rows = await prisma.bill.findMany();
    const f = rows.filter((r) => toDateStr(r.createdAt) === today);
    res.json({
      date: today,
      totalBills: f.length,
      totalSales: f.reduce((a, b) => a + num(b.total), 0)
    });
  } catch (e) { next(e); }
});

// ── Settings ──────────────────────────────────────────────────────────────────

router.get("/settings", async (_req, res, next) => {
  try { res.json(await getSettings()); } catch (e) { next(e); }
});

router.post(
  "/settings",
  requireAuth,
  allowRoles(["ADMIN", "BILLING"]),
  async (req, res, next) => {
    try {
      const { id: _id, createdAt: _ca, updatedAt: _ua, ...data } = req.body;
      res.json(await prisma.setting.update({ where: { id: 1 }, data }));
    } catch (e) { next(e); }
  }
);

// ── Notifications ─────────────────────────────────────────────────────────────

router.get("/notifications", requireAuth, async (_req, res, next) => {
  try {
    res.json(
      await prisma.notification.findMany({ orderBy: { createdAt: "desc" } })
    );
  } catch (e) { next(e); }
});

router.get("/notifications/unread", requireAuth, async (_req, res, next) => {
  try {
    res.json(
      await prisma.notification.findMany({
        where: { isRead: false },
        orderBy: { createdAt: "desc" }
      })
    );
  } catch (e) { next(e); }
});

router.patch("/notifications/:id/read", requireAuth, async (req, res, next) => {
  try {
    res.json(
      await prisma.notification.update({
        where: { id: +req.params.id },
        data: { isRead: true }
      })
    );
  } catch (e) { next(e); }
});

// ── Purchases ─────────────────────────────────────────────────────────────────
// Schema: itemName, supplierName, totalPrice  |  Frontend: item, supplier, total

router.get("/purchases", requireAuth, async (_req, res, next) => {
  try {
    const rows = await prisma.purchase.findMany({ orderBy: { createdAt: "desc" } });
    res.json(rows.map(toApiPurchase));
  } catch (e) { next(e); }
});

router.get("/purchases/:id", requireAuth, async (req, res, next) => {
  try {
    const row = await prisma.purchase.findUnique({ where: { id: +req.params.id } });
    res.json(toApiPurchase(row));
  } catch (e) { next(e); }
});

router.post("/purchases", requireAuth, allowRoles(["ADMIN"]), async (req, res, next) => {
  try {
    const data = fromFrontendPurchase(req.body);
    const row = await prisma.purchase.create({ data });
    res.json(toApiPurchase(row));
  } catch (e) { next(e); }
});

router.delete("/purchases/:id", requireAuth, allowRoles(["ADMIN"]), async (req, res, next) => {
  try {
    await prisma.purchase.delete({ where: { id: +req.params.id } });
    res.status(204).send();
  } catch (e) { next(e); }
});

// ── Inventory ─────────────────────────────────────────────────────────────────

router.get("/inventory", requireAuth, async (_req, res, next) => {
  try {
    res.json(await prisma.inventoryItem.findMany({ orderBy: { id: "asc" } }));
  } catch (e) { next(e); }
});

router.get("/inventory/active", requireAuth, async (_req, res, next) => {
  try {
    res.json(await prisma.inventoryItem.findMany({ where: { isActive: true } }));
  } catch (e) { next(e); }
});

router.get("/inventory/low-stock", requireAuth, async (_req, res, next) => {
  try {
    const all = await prisma.inventoryItem.findMany();
    res.json(all.filter((i) => i.currentStock <= i.minimumStock));
  } catch (e) { next(e); }
});

router.get("/inventory/category/:category", requireAuth, async (req, res, next) => {
  try {
    res.json(
      await prisma.inventoryItem.findMany({ where: { category: req.params.category } })
    );
  } catch (e) { next(e); }
});

router.get("/inventory/:id", requireAuth, async (req, res, next) => {
  try {
    res.json(await prisma.inventoryItem.findUnique({ where: { id: +req.params.id } }));
  } catch (e) { next(e); }
});

router.post("/inventory", requireAuth, allowRoles(["ADMIN"]), async (req, res, next) => {
  try {
    // Provide defaults for optional fields the frontend form may omit
    const data = {
      category: "General",
      minimumStock: 0,
      costPerUnit: 0,
      ...req.body
    };
    res.json(await prisma.inventoryItem.create({ data }));
  } catch (e) { next(e); }
});

router.put("/inventory/:id", requireAuth, allowRoles(["ADMIN"]), async (req, res, next) => {
  try {
    res.json(
      await prisma.inventoryItem.update({
        where: { id: +req.params.id },
        data: req.body
      })
    );
  } catch (e) { next(e); }
});

router.patch(
  "/inventory/:id/add-stock",
  requireAuth,
  allowRoles(["ADMIN"]),
  async (req, res, next) => {
    try {
      const quantity = num(req.query.quantity);
      const row = await prisma.inventoryItem.update({
        where: { id: +req.params.id },
        data: { currentStock: { increment: quantity } }
      });
      await prisma.inventoryMovement.create({
        data: { inventoryItemId: row.id, movementType: "ADD", quantity, reason: "Manual add stock" }
      });
      res.json(row);
    } catch (e) { next(e); }
  }
);

router.patch(
  "/inventory/:id/remove-stock",
  requireAuth,
  allowRoles(["ADMIN"]),
  async (req, res, next) => {
    try {
      const quantity = num(req.query.quantity);
      const row = await prisma.inventoryItem.update({
        where: { id: +req.params.id },
        data: { currentStock: { decrement: quantity } }
      });
      await prisma.inventoryMovement.create({
        data: { inventoryItemId: row.id, movementType: "REMOVE", quantity, reason: "Manual remove stock" }
      });
      res.json(row);
    } catch (e) { next(e); }
  }
);

router.delete("/inventory/:id", requireAuth, allowRoles(["ADMIN"]), async (req, res, next) => {
  try {
    await prisma.inventoryItem.delete({ where: { id: +req.params.id } });
    res.status(204).send();
  } catch (e) { next(e); }
});

// ── Cash Sessions ─────────────────────────────────────────────────────────────

router.post("/cash-sessions/open", requireAuth, async (req, res, next) => {
  try {
    await prisma.cashSession.updateMany({
      where: { isOpen: true },
      data: { isOpen: false, closedAt: new Date() }
    });
    res.json(
      await prisma.cashSession.create({
        data: { openedBy: req.user.username, openingAmount: req.body.openingAmount }
      })
    );
  } catch (e) { next(e); }
});

router.post("/cash-sessions/close", requireAuth, async (req, res, next) => {
  try {
    const current = await prisma.cashSession.findFirst({
      where: { isOpen: true },
      orderBy: { openedAt: "desc" }
    });
    if (!current) return res.status(404).json({ message: "No open session" });
    res.json(
      await prisma.cashSession.update({
        where: { id: current.id },
        data: {
          isOpen: false,
          closedBy: req.user.username,
          closingAmount: req.body.closingAmount,
          cashInHand: req.body.cashInHand,
          closedAt: new Date()
        }
      })
    );
  } catch (e) { next(e); }
});

router.get("/cash-sessions/current", requireAuth, async (_req, res, next) => {
  try {
    res.json(
      await prisma.cashSession.findFirst({
        where: { isOpen: true },
        orderBy: { openedAt: "desc" }
      })
    );
  } catch (e) { next(e); }
});

// ── Reports ───────────────────────────────────────────────────────────────────

router.get("/reports/daily", requireAuth, async (req, res, next) => {
  try {
    const date = req.query.date || toDateStr(new Date());
    const bills = await prisma.bill.findMany();
    const f = bills.filter((b) => toDateStr(b.createdAt) === date);
    res.json({ date, bills: f.length, sales: f.reduce((a, b) => a + num(b.total), 0) });
  } catch (e) { next(e); }
});

router.get("/reports/monthly", requireAuth, async (req, res, next) => {
  try {
    const year = +req.query.year;
    const month = +req.query.month;
    const bills = await prisma.bill.findMany();
    const f = bills.filter((b) => {
      const d = new Date(b.createdAt);
      return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month;
    });
    res.json({ year, month, bills: f.length, sales: f.reduce((a, b) => a + num(b.total), 0) });
  } catch (e) { next(e); }
});

router.get("/reports/yearly", requireAuth, async (req, res, next) => {
  try {
    const year = +req.query.year;
    const bills = await prisma.bill.findMany();
    const f = bills.filter((b) => new Date(b.createdAt).getUTCFullYear() === year);
    res.json({ year, bills: f.length, sales: f.reduce((a, b) => a + num(b.total), 0) });
  } catch (e) { next(e); }
});

router.post("/reports/range", requireAuth, async (req, res, next) => {
  try {
    const s = new Date(req.body.startDate);
    const e = new Date(req.body.endDate);
    e.setHours(23, 59, 59, 999);
    const f = await prisma.bill.findMany({ where: { createdAt: { gte: s, lte: e } } });
    res.json({
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      bills: f.length,
      sales: f.reduce((a, b) => a + num(b.total), 0)
    });
  } catch (e) { next(e); }
});

module.exports = router;
