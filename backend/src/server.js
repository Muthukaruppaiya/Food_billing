require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const { setIo } = require("./lib/socket");

const port = Number(process.env.PORT || 8080);
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
  console.log(`Backend server running on port ${port}`);
});
