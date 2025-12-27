import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, getCurrentTimestamp } from "../db";
import { characters } from "../db/schema";

const app = new Hono();

// GET /characters - List all characters
app.get("/", async (c) => {
  const rows = await db.query.characters.findMany({
    orderBy: (characters, { asc }) => [asc(characters.name)],
  });

  return c.json(
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      blurb: row.blurb,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }))
  );
});

// GET /characters/:id - Get a single character
app.get("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const row = await db.query.characters.findFirst({
    where: eq(characters.id, id),
  });

  if (!row) {
    return c.json({ error: "Character not found" }, 404);
  }

  return c.json({
    id: row.id,
    name: row.name,
    blurb: row.blurb,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
});

// POST /characters - Create a new character
app.post("/", async (c) => {
  const body = await c.req.json<{ name: string; blurb?: string }>();

  if (!body.name || body.name.trim() === "") {
    return c.json({ error: "Name is required" }, 400);
  }

  try {
    const [result] = await db
      .insert(characters)
      .values({
        name: body.name.trim(),
        blurb: body.blurb || "",
      })
      .returning();

    return c.json(
      {
        id: result.id,
        name: result.name,
        blurb: result.blurb,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      },
      201
    );
  } catch (error: any) {
    if (error.message?.includes("UNIQUE constraint")) {
      return c.json({ error: "A character with this name already exists" }, 409);
    }
    throw error;
  }
});

// PUT /characters/:id - Update a character
app.put("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json<{ name?: string; blurb?: string }>();
  const timestamp = getCurrentTimestamp();

  const existing = await db.query.characters.findFirst({
    where: eq(characters.id, id),
  });

  if (!existing) {
    return c.json({ error: "Character not found" }, 404);
  }

  try {
    const [result] = await db
      .update(characters)
      .set({
        name: body.name?.trim() ?? existing.name,
        blurb: body.blurb ?? existing.blurb,
        updatedAt: timestamp,
      })
      .where(eq(characters.id, id))
      .returning();

    return c.json({
      id: result.id,
      name: result.name,
      blurb: result.blurb,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    });
  } catch (error: any) {
    if (error.message?.includes("UNIQUE constraint")) {
      return c.json({ error: "A character with this name already exists" }, 409);
    }
    throw error;
  }
});

// DELETE /characters/:id - Delete a character
app.delete("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));

  const existing = await db.query.characters.findFirst({
    where: eq(characters.id, id),
  });

  if (!existing) {
    return c.json({ error: "Character not found" }, 404);
  }

  await db.delete(characters).where(eq(characters.id, id));
  return c.json({ success: true });
});

export default app;
