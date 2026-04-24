require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const { setIo } = require("./lib/socket");
const { initDatabase } = require("./lib/initDb");

const port = Number(process.env.PORT || 8080);

async function start() {
  try {
    await initDatabase();
  } catch (err) {
    console.error("❌ Failed to initialize database:", err.message);
    process.exit(1);
  }

  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_ORIGIN?.split(",") || ["http://localhost:3000"],
      credentials: true
    }
  });

  io.on("connection", (socket) => {
    socket.emit("message", { type: "CONNECTED", message: "Realtime connected" });
  });

  setIo(io);

  server.listen(port, () => {
    console.log(`✅ Backend server running on http://localhost:${port}`);
  });
}

start();
