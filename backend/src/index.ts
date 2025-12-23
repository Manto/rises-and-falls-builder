import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { initializeDatabase } from "./db";
import characters from "./routes/characters";
import locations from "./routes/locations";
import variables from "./routes/variables";
import scenes from "./routes/scenes";

// Initialize database on startup
initializeDatabase();

// Create the app
const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  })
);

// Health check
app.get("/", (c) => {
  return c.json({
    name: "Rises and Falls API",
    version: "1.0.0",
    status: "running",
  });
});

// Mount routes
app.route("/api/characters", characters);
app.route("/api/locations", locations);
app.route("/api/variables", variables);
app.route("/api/scenes", scenes);

// Error handling
app.onError((err, c) => {
  console.error("Error:", err);
  return c.json({ error: "Internal Server Error" }, 500);
});

// Start the server
const port = 3000;
console.log(`🚀 Server running at http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};

