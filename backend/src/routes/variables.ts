import { Hono } from "hono";
import { db, getCurrentTimestamp } from "../db";
import type { VariableRow, Variable, CreateVariableInput } from "../types";

const variables = new Hono();

// Transform database row to API response
function toVariable(row: VariableRow): Variable {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    defaultValue: row.default_value,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /variables - List all variables
variables.get("/", (c) => {
  const rows = db.query("SELECT * FROM variables ORDER BY name").all() as VariableRow[];
  return c.json(rows.map(toVariable));
});

// GET /variables/:id - Get a single variable
variables.get("/:id", (c) => {
  const id = parseInt(c.req.param("id"));
  const row = db.query("SELECT * FROM variables WHERE id = ?").get(id) as VariableRow | null;
  
  if (!row) {
    return c.json({ error: "Variable not found" }, 404);
  }
  
  return c.json(toVariable(row));
});

// POST /variables - Create a new variable
variables.post("/", async (c) => {
  const body = await c.req.json<CreateVariableInput>();
  
  if (!body.name || body.name.trim() === "") {
    return c.json({ error: "Name is required" }, 400);
  }

  try {
    const result = db
      .query(
        "INSERT INTO variables (name, description, default_value) VALUES (?, ?, ?) RETURNING *"
      )
      .get(
        body.name.trim(),
        body.description || "",
        body.defaultValue ?? 0
      ) as VariableRow;

    return c.json(toVariable(result), 201);
  } catch (error: any) {
    if (error.message?.includes("UNIQUE constraint")) {
      return c.json({ error: "A variable with this name already exists" }, 409);
    }
    throw error;
  }
});

// PUT /variables/:id - Update a variable
variables.put("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json<Partial<CreateVariableInput>>();
  const timestamp = getCurrentTimestamp();

  const existing = db.query("SELECT * FROM variables WHERE id = ?").get(id);
  if (!existing) {
    return c.json({ error: "Variable not found" }, 404);
  }

  try {
    const result = db
      .query(
        `UPDATE variables 
         SET name = COALESCE(?, name),
             description = COALESCE(?, description),
             default_value = COALESCE(?, default_value),
             updated_at = ?
         WHERE id = ?
         RETURNING *`
      )
      .get(
        body.name?.trim(),
        body.description,
        body.defaultValue,
        timestamp,
        id
      ) as VariableRow;

    return c.json(toVariable(result));
  } catch (error: any) {
    if (error.message?.includes("UNIQUE constraint")) {
      return c.json({ error: "A variable with this name already exists" }, 409);
    }
    throw error;
  }
});

// DELETE /variables/:id - Delete a variable
variables.delete("/:id", (c) => {
  const id = parseInt(c.req.param("id"));
  
  const existing = db.query("SELECT * FROM variables WHERE id = ?").get(id);
  if (!existing) {
    return c.json({ error: "Variable not found" }, 404);
  }

  db.query("DELETE FROM variables WHERE id = ?").run(id);
  return c.json({ success: true });
});

export default variables;

