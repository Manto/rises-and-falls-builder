import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, getCurrentTimestamp } from "../db";
import { locations } from "../db/schema";

const app = new Hono();

// GET /locations - List all locations
app.get("/", async (c) => {
  const rows = await db.query.locations.findMany({
    orderBy: (locations, { asc }) => [asc(locations.name)],
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

// GET /locations/:id - Get a single location
app.get("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const row = await db.query.locations.findFirst({
    where: eq(locations.id, id),
  });

  if (!row) {
    return c.json({ error: "Location not found" }, 404);
  }

  return c.json({
    id: row.id,
    name: row.name,
    blurb: row.blurb,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
});

// POST /locations - Create a new location
app.post("/", async (c) => {
  const body = await c.req.json<{ name: string; blurb?: string }>();

  if (!body.name || body.name.trim() === "") {
    return c.json({ error: "Name is required" }, 400);
  }

  try {
    const [result] = await db
      .insert(locations)
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
      return c.json({ error: "A location with this name already exists" }, 409);
    }
    throw error;
  }
});

// PUT /locations/:id - Update a location
app.put("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json<{ name?: string; blurb?: string }>();
  const timestamp = getCurrentTimestamp();

  const existing = await db.query.locations.findFirst({
    where: eq(locations.id, id),
  });

  if (!existing) {
    return c.json({ error: "Location not found" }, 404);
  }

  try {
    const [result] = await db
      .update(locations)
      .set({
        name: body.name?.trim() ?? existing.name,
        blurb: body.blurb ?? existing.blurb,
        updatedAt: timestamp,
      })
      .where(eq(locations.id, id))
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
      return c.json({ error: "A location with this name already exists" }, 409);
    }
    throw error;
  }
});

// DELETE /locations/:id - Delete a location
app.delete("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));

  const existing = await db.query.locations.findFirst({
    where: eq(locations.id, id),
  });

  if (!existing) {
    return c.json({ error: "Location not found" }, 404);
  }

  await db.delete(locations).where(eq(locations.id, id));
  return c.json({ success: true });
});

export default app;
