import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, getCurrentTimestamp } from "../db";
import { variables, type Variable } from "../db/schema";
import { parseIntParam } from "../utils";

const app = new Hono();

type VariableType = "Character" | "World State" | "Knowledge";

// GET /variables - List all variables
app.get("/", async (c) => {
  const rows = await db.query.variables.findMany({
    orderBy: (variables, { asc }) => [asc(variables.name)],
  });

  return c.json(
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      defaultValue: row.defaultValue,
      type: row.type,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }))
  );
});

// GET /variables/:id - Get a single variable
app.get("/:id", async (c) => {
  try {
    const id = parseIntParam(c.req.param("id"));
    const row = await db.query.variables.findFirst({
      where: eq(variables.id, id),
    });

    if (!row) {
      return c.json({ error: "Variable not found" }, 404);
    }

    return c.json({
      id: row.id,
      name: row.name,
      description: row.description,
      defaultValue: row.defaultValue,
      type: row.type,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    throw error;
  }
});

// POST /variables - Create a new variable
app.post("/", async (c) => {
  const body = await c.req.json<{
    name: string;
    description?: string;
    defaultValue?: number;
    type?: VariableType;
  }>();

  if (!body.name || body.name.trim() === "") {
    return c.json({ error: "Name is required" }, 400);
  }

  try {
    const [result] = await db
      .insert(variables)
      .values({
        name: body.name.trim(),
        description: body.description || "",
        defaultValue: body.defaultValue ?? 0,
        type: body.type || "World State",
      })
      .returning();

    return c.json(
      {
        id: result.id,
        name: result.name,
        description: result.description,
        defaultValue: result.defaultValue,
        type: result.type,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      },
      201
    );
  } catch (error: any) {
    if (error.message?.includes("UNIQUE constraint")) {
      return c.json({ error: "A variable with this name already exists" }, 409);
    }
    throw error;
  }
});

// PUT /variables/:id - Update a variable
app.put("/:id", async (c) => {
  try {
    const id = parseIntParam(c.req.param("id"));
    const body = await c.req.json<{
      name?: string;
      description?: string;
      defaultValue?: number;
      type?: VariableType;
    }>();
    const timestamp = getCurrentTimestamp();

    const existing = await db.query.variables.findFirst({
      where: eq(variables.id, id),
    });

    if (!existing) {
      return c.json({ error: "Variable not found" }, 404);
    }

    try {
      const [result] = await db
        .update(variables)
        .set({
          name: body.name?.trim() ?? existing.name,
          description: body.description ?? existing.description,
          defaultValue: body.defaultValue ?? existing.defaultValue,
          type: body.type ?? existing.type,
          updatedAt: timestamp,
        })
        .where(eq(variables.id, id))
        .returning();

      return c.json({
        id: result.id,
        name: result.name,
        description: result.description,
        defaultValue: result.defaultValue,
        type: result.type,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      });
    } catch (error: any) {
      if (error.message?.includes("UNIQUE constraint")) {
        return c.json({ error: "A variable with this name already exists" }, 409);
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    throw error;
  }
});

// DELETE /variables/:id - Delete a variable
app.delete("/:id", async (c) => {
  try {
    const id = parseIntParam(c.req.param("id"));

    const existing = await db.query.variables.findFirst({
      where: eq(variables.id, id),
    });

    if (!existing) {
      return c.json({ error: "Variable not found" }, 404);
    }

    await db.delete(variables).where(eq(variables.id, id));
    return c.json({ success: true });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    throw error;
  }
});

export default app;
