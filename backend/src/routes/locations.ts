import { Hono } from "hono";
import { db, getCurrentTimestamp } from "../db";
import type { LocationRow, Location, CreateLocationInput } from "../types";

const locations = new Hono();

// Transform database row to API response
function toLocation(row: LocationRow): Location {
  return {
    id: row.id,
    name: row.name,
    blurb: row.blurb,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /locations - List all locations
locations.get("/", (c) => {
  const rows = db.query("SELECT * FROM locations ORDER BY name").all() as LocationRow[];
  return c.json(rows.map(toLocation));
});

// GET /locations/:id - Get a single location
locations.get("/:id", (c) => {
  const id = parseInt(c.req.param("id"));
  const row = db.query("SELECT * FROM locations WHERE id = ?").get(id) as LocationRow | null;
  
  if (!row) {
    return c.json({ error: "Location not found" }, 404);
  }
  
  return c.json(toLocation(row));
});

// POST /locations - Create a new location
locations.post("/", async (c) => {
  const body = await c.req.json<CreateLocationInput>();
  
  if (!body.name || body.name.trim() === "") {
    return c.json({ error: "Name is required" }, 400);
  }

  try {
    const result = db
      .query(
        "INSERT INTO locations (name, blurb) VALUES (?, ?) RETURNING *"
      )
      .get(body.name.trim(), body.blurb || "") as LocationRow;

    return c.json(toLocation(result), 201);
  } catch (error: any) {
    if (error.message?.includes("UNIQUE constraint")) {
      return c.json({ error: "A location with this name already exists" }, 409);
    }
    throw error;
  }
});

// PUT /locations/:id - Update a location
locations.put("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json<Partial<CreateLocationInput>>();
  const timestamp = getCurrentTimestamp();

  const existing = db.query("SELECT * FROM locations WHERE id = ?").get(id);
  if (!existing) {
    return c.json({ error: "Location not found" }, 404);
  }

  try {
    const result = db
      .query(
        `UPDATE locations 
         SET name = COALESCE(?, name),
             blurb = COALESCE(?, blurb),
             updated_at = ?
         WHERE id = ?
         RETURNING *`
      )
      .get(body.name?.trim(), body.blurb, timestamp, id) as LocationRow;

    return c.json(toLocation(result));
  } catch (error: any) {
    if (error.message?.includes("UNIQUE constraint")) {
      return c.json({ error: "A location with this name already exists" }, 409);
    }
    throw error;
  }
});

// DELETE /locations/:id - Delete a location
locations.delete("/:id", (c) => {
  const id = parseInt(c.req.param("id"));
  
  const existing = db.query("SELECT * FROM locations WHERE id = ?").get(id);
  if (!existing) {
    return c.json({ error: "Location not found" }, 404);
  }

  db.query("DELETE FROM locations WHERE id = ?").run(id);
  return c.json({ success: true });
});

export default locations;

