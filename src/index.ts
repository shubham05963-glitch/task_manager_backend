import express from "express";
import authRouter from "./routes/auth";
import taskRouter from "./routes/task";

const app = express();

// Environment variables
const PORT = process.env.PORT || 10000;
const NODE_ENV = process.env.NODE_ENV || "development";

// Middleware
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    environment: NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// Welcome endpoint
app.get("/", (req, res) => {
  res.send("Welcome to my app!!!");
});

// API Routes
app.use("/auth", authRouter);
app.use("/tasks", taskRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
  console.log(`📝 Environment: ${NODE_ENV}`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
});

// Handle uncaught errors
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});
