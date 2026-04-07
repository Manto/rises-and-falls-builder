import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, getCurrentTimestamp } from "../db";
import { worldStyles } from "../db/schema";
import { parseIntParam } from "../utils";

const app = new Hono();

app.get("/", async (c) => {
  const rows = await db.query.worldStyles.findMany({
    orderBy: (worldStyles, { asc }) => [asc(worldStyles.name)],
  });
  return c.json(rows);
});

app.get("/:id", async (c) => {
  try {
    const id = parseIntParam(c.req.param("id"));
    const row = await db.query.worldStyles.findFirst({
      where: eq(worldStyles.id, id),
    });
    if (!row) return c.json({ error: "World style not found" }, 404);
    return c.json(row);
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
});

app.post("/", async (c) => {
  const body = await c.req.json<{ name: string; description?: string }>();
  if (!body.name || body.name.trim() === "") {
    return c.json({ error: "Name is required" }, 400);
  }
  try {
    const [result] = await db
      .insert(worldStyles)
      .values({ name: body.name.trim(), description: body.description || "" })
      .returning();
    return c.json(result, 201);
  } catch (error: any) {
    if (error.message?.includes("UNIQUE constraint")) {
      return c.json({ error: "A world style with this name already exists" }, 409);
    }
    throw error;
  }
});

app.put("/:id", async (c) => {
  try {
    const id = parseIntParam(c.req.param("id"));
    const body = await c.req.json<{ name?: string; description?: string }>();
    const existing = await db.query.worldStyles.findFirst({
      where: eq(worldStyles.id, id),
    });
    if (!existing) return c.json({ error: "World style not found" }, 404);
    try {
      const [result] = await db
        .update(worldStyles)
        .set({
          name: body.name?.trim() ?? existing.name,
          description: body.description ?? existing.description,
          updatedAt: getCurrentTimestamp(),
        })
        .where(eq(worldStyles.id, id))
        .returning();
      return c.json(result);
    } catch (error: any) {
      if (error.message?.includes("UNIQUE constraint")) {
        return c.json({ error: "A world style with this name already exists" }, 409);
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
});

app.delete("/:id", async (c) => {
  try {
    const id = parseIntParam(c.req.param("id"));
    const existing = await db.query.worldStyles.findFirst({
      where: eq(worldStyles.id, id),
    });
    if (!existing) return c.json({ error: "World style not found" }, 404);

    // Delete associated upload files
    const { join } = await import("path");
    const uploadsDir = join(import.meta.dir, "../../uploads/world-styles", String(id));
    try {
      const { rmSync } = await import("fs");
      rmSync(uploadsDir, { recursive: true, force: true });
    } catch {}

    await db.delete(worldStyles).where(eq(worldStyles.id, id));
    return c.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
});

export default app;
