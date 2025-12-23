import { Database } from "bun:sqlite";
import { readFileSync } from "fs";
import { join } from "path";

// Database file location
const DB_PATH = join(import.meta.dir, "../../data/rises-and-falls.db");

// Create database instance
export const db = new Database(DB_PATH, { create: true });

// Enable foreign keys
db.run("PRAGMA foreign_keys = ON");

// Initialize the database schema
export function initializeDatabase() {
  const schemaPath = join(import.meta.dir, "schema.sql");
  const schema = readFileSync(schemaPath, "utf-8");
  
  // Split by semicolon and execute each statement
  const statements = schema
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    db.run(statement);
  }

  console.log("✅ Database initialized successfully");
}

// Utility to get current timestamp
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

