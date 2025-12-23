import { Hono } from "hono";
import { db, getCurrentTimestamp } from "../db";
import type { CharacterRow, Character, CreateCharacterInput } from "../types";

const characters = new Hono();

// Transform database row to API response
function toCharacter(row: CharacterRow): Character {
  return {
    id: row.id,
    name: row.name,
    blurb: row.blurb,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /characters - List all characters
characters.get("/", (c) => {
  const rows = db.query("SELECT * FROM characters ORDER BY name").all() as CharacterRow[];
  return c.json(rows.map(toCharacter));
});

// GET /characters/:id - Get a single character
characters.get("/:id", (c) => {
  const id = parseInt(c.req.param("id"));
  const row = db.query("SELECT * FROM characters WHERE id = ?").get(id) as CharacterRow | null;
  
  if (!row) {
    return c.json({ error: "Character not found" }, 404);
  }
  
  return c.json(toCharacter(row));
});

// POST /characters - Create a new character
characters.post("/", async (c) => {
  const body = await c.req.json<CreateCharacterInput>();
  
  if (!body.name || body.name.trim() === "") {
    return c.json({ error: "Name is required" }, 400);
  }

  try {
    const result = db
      .query(
        "INSERT INTO characters (name, blurb) VALUES (?, ?) RETURNING *"
      )
      .get(body.name.trim(), body.blurb || "") as CharacterRow;

    return c.json(toCharacter(result), 201);
  } catch (error: any) {
    if (error.message?.includes("UNIQUE constraint")) {
      return c.json({ error: "A character with this name already exists" }, 409);
    }
    throw error;
  }
});

// PUT /characters/:id - Update a character
characters.put("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json<Partial<CreateCharacterInput>>();
  const timestamp = getCurrentTimestamp();

  const existing = db.query("SELECT * FROM characters WHERE id = ?").get(id);
  if (!existing) {
    return c.json({ error: "Character not found" }, 404);
  }

  try {
    const result = db
      .query(
        `UPDATE characters 
         SET name = COALESCE(?, name),
             blurb = COALESCE(?, blurb),
             updated_at = ?
         WHERE id = ?
         RETURNING *`
      )
      .get(body.name?.trim(), body.blurb, timestamp, id) as CharacterRow;

    return c.json(toCharacter(result));
  } catch (error: any) {
    if (error.message?.includes("UNIQUE constraint")) {
      return c.json({ error: "A character with this name already exists" }, 409);
    }
    throw error;
  }
});

// DELETE /characters/:id - Delete a character
characters.delete("/:id", (c) => {
  const id = parseInt(c.req.param("id"));
  
  const existing = db.query("SELECT * FROM characters WHERE id = ?").get(id);
  if (!existing) {
    return c.json({ error: "Character not found" }, 404);
  }

  db.query("DELETE FROM characters WHERE id = ?").run(id);
  return c.json({ success: true });
});

export default characters;

