require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const { initDB } = require("./config/db");
const { initMinio } = require("./config/minio");
const setupSocketIO = require("./sockets");
const wishesRouter = require("./routes/wishes");

const app = express();
const server = http.createServer(app);

// CORS for local development and LAN access
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// High request limit for Base64 canvas drawings
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["polling", "websocket"],
  allowEIO3: true,
  maxHttpBufferSize: 5e7, // 50MB for WebSockets
});

// Setup Real-time Handlers
setupSocketIO(io);

// Routes
app.use("/api", wishesRouter(io));

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("[Server Error]", err);
  res.status(500).json({ success: false, error: "Internal Server Error" });
});

const PORT = process.env.PORT || 3100;

async function startServer() {
  try {
    await initDB();
    await initMinio();
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`=========================================`);
      console.log(` Wedding Backend running on port: ${PORT}`);
      console.log(` Mode: ${process.env.NODE_ENV || "development"}`);
      console.log(`=========================================`);
    });
  } catch (err) {
    console.error("Fatal startup error:", err);
    process.exit(1);
  }
}

startServer();
