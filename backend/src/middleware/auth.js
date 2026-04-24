const { z } = require("zod");

const roles = new Set(["ADMIN", "BILLING", "CHEF", "WAITER"]);

function attachUser(req, _res, next) {
  const username = req.header("X-Username");
  const roleRaw = req.header("X-Role");
  const role = roleRaw ? roleRaw.toUpperCase() : null;

  req.user = {
    username: username || null,
    role: role && roles.has(role) ? role : null
  };

  next();
}

function requireAuth(req, res, next) {
  if (!req.user?.username || !req.user?.role) {
    return res.status(401).json({ message: "Missing X-Username or X-Role headers" });
  }
  return next();
}

function allowRoles(allowed) {
  return (req, res, next) => {
    if (!req.user?.role || !allowed.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden for this role" });
    }
    return next();
  };
}

function validateBody(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: z.treeifyError(parsed.error)
      });
    }
    req.body = parsed.data;
    return next();
  };
}

module.exports = { attachUser, requireAuth, allowRoles, validateBody };
