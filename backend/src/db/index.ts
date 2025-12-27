import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { join } from "path";
import * as schema from "./schema";

// Database file location
const DB_PATH = join(import.meta.dir, "../../data/rises-and-falls.db");

// Create SQLite database instance
const sqlite = new Database(DB_PATH, { create: true });

// Enable foreign keys
sqlite.run("PRAGMA foreign_keys = ON");

// Create Drizzle instance with schema
export const db = drizzle(sqlite, { schema });

// Export the raw SQLite instance for transactions
export const sqliteDb = sqlite;

// Utility to get current timestamp
export function getCurrentTimestamp(): string {
  return new Date().toISOString().replace("T", " ").replace("Z", "").slice(0, 19);
}
