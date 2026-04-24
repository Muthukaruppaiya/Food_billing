const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");
const { attachUser } = require("./middleware/auth");
const { notFound, errorHandler } = require("./middleware/error");
const apiRouter = require("./routes/api");

const app = express();

app.use(cors({
  origin: process.env.CLIENT_ORIGIN?.split(",") || ["http://localhost:3000"],
  credentials: true
}));
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimit({ windowMs: 60 * 1000, limit: 300 }));
app.use(attachUser);

// Allow cross-origin image loading (frontend at :3000 loads images from :8080)
app.use("/uploads", (_req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}, express.static(path.join(process.cwd(), "uploads")));
app.use("/api", apiRouter);

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use(notFound);
app.use(errorHandler);

module.exports = app;
