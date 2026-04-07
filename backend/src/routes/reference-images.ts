import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { join } from "path";
import { mkdirSync, existsSync, unlinkSync, readdirSync, readFileSync, rmSync } from "fs";
import { db } from "../db";
import {
  characters,
  characterReferenceImages,
  worldStyles,
  worldStyleReferenceImages,
} from "../db/schema";
import { parseIntParam } from "../utils";

const UPLOADS_ROOT = join(import.meta.dir, "../../uploads");

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function generateFilename(originalName: string): string {
  const ext = originalName.includes(".") ? originalName.slice(originalName.lastIndexOf(".")) : ".png";
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
}

const app = new Hono();

// ─── Character Reference Images ───

app.get("/characters/:characterId", async (c) => {
  const characterId = parseIntParam(c.req.param("characterId"));
  const images = await db.query.characterReferenceImages.findMany({
    where: eq(characterReferenceImages.characterId, characterId),
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });
  return c.json(images);
});

app.post("/characters/:characterId/upload", async (c) => {
  const characterId = parseIntParam(c.req.param("characterId"));

  const character = await db.query.characters.findFirst({
    where: eq(characters.id, characterId),
  });
  if (!character) return c.json({ error: "Character not found" }, 404);

  const body = await c.req.parseBody({ all: true });
  const files = Array.isArray(body["files"]) ? body["files"] : body["files"] ? [body["files"]] : [];
  const caption = typeof body["caption"] === "string" ? body["caption"] : "";

  if (files.length === 0) return c.json({ error: "No files provided" }, 400);

  const dir = join(UPLOADS_ROOT, "characters", String(characterId));
  ensureDir(dir);

  const results = [];
  for (const file of files) {
    if (!(file instanceof File)) continue;
    const filename = generateFilename(file.name);
    const filePath = join(dir, filename);
    const buffer = await file.arrayBuffer();
    await Bun.write(filePath, buffer);

    const [row] = await db
      .insert(characterReferenceImages)
      .values({
        characterId,
        filename,
        originalFilename: file.name,
        caption,
      })
      .returning();
    results.push(row);
  }

  return c.json(results, 201);
});

app.put("/characters/images/:imageId", async (c) => {
  const imageId = parseIntParam(c.req.param("imageId"));
  const body = await c.req.json<{ caption: string }>();

  const existing = await db.query.characterReferenceImages.findFirst({
    where: eq(characterReferenceImages.id, imageId),
  });
  if (!existing) return c.json({ error: "Image not found" }, 404);

  const [result] = await db
    .update(characterReferenceImages)
    .set({ caption: body.caption ?? "" })
    .where(eq(characterReferenceImages.id, imageId))
    .returning();

  return c.json(result);
});

app.delete("/characters/images/:imageId", async (c) => {
  const imageId = parseIntParam(c.req.param("imageId"));

  const existing = await db.query.characterReferenceImages.findFirst({
    where: eq(characterReferenceImages.id, imageId),
  });
  if (!existing) return c.json({ error: "Image not found" }, 404);

  const filePath = join(
    UPLOADS_ROOT,
    "characters",
    String(existing.characterId),
    existing.filename
  );
  try { unlinkSync(filePath); } catch {}

  await db.delete(characterReferenceImages).where(eq(characterReferenceImages.id, imageId));
  return c.json({ success: true });
});

// ─── World Style Reference Images ───

app.get("/world-styles/:worldStyleId", async (c) => {
  const worldStyleId = parseIntParam(c.req.param("worldStyleId"));
  const images = await db.query.worldStyleReferenceImages.findMany({
    where: eq(worldStyleReferenceImages.worldStyleId, worldStyleId),
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });
  return c.json(images);
});

app.post("/world-styles/:worldStyleId/upload", async (c) => {
  const worldStyleId = parseIntParam(c.req.param("worldStyleId"));

  const style = await db.query.worldStyles.findFirst({
    where: eq(worldStyles.id, worldStyleId),
  });
  if (!style) return c.json({ error: "World style not found" }, 404);

  const body = await c.req.parseBody({ all: true });
  const files = Array.isArray(body["files"]) ? body["files"] : body["files"] ? [body["files"]] : [];
  const caption = typeof body["caption"] === "string" ? body["caption"] : "";

  if (files.length === 0) return c.json({ error: "No files provided" }, 400);

  const dir = join(UPLOADS_ROOT, "world-styles", String(worldStyleId));
  ensureDir(dir);

  const results = [];
  for (const file of files) {
    if (!(file instanceof File)) continue;
    const filename = generateFilename(file.name);
    const filePath = join(dir, filename);
    const buffer = await file.arrayBuffer();
    await Bun.write(filePath, buffer);

    const [row] = await db
      .insert(worldStyleReferenceImages)
      .values({
        worldStyleId,
        filename,
        originalFilename: file.name,
        caption,
      })
      .returning();
    results.push(row);
  }

  return c.json(results, 201);
});

app.put("/world-styles/images/:imageId", async (c) => {
  const imageId = parseIntParam(c.req.param("imageId"));
  const body = await c.req.json<{ caption: string }>();

  const existing = await db.query.worldStyleReferenceImages.findFirst({
    where: eq(worldStyleReferenceImages.id, imageId),
  });
  if (!existing) return c.json({ error: "Image not found" }, 404);

  const [result] = await db
    .update(worldStyleReferenceImages)
    .set({ caption: body.caption ?? "" })
    .where(eq(worldStyleReferenceImages.id, imageId))
    .returning();

  return c.json(result);
});

app.delete("/world-styles/images/:imageId", async (c) => {
  const imageId = parseIntParam(c.req.param("imageId"));

  const existing = await db.query.worldStyleReferenceImages.findFirst({
    where: eq(worldStyleReferenceImages.id, imageId),
  });
  if (!existing) return c.json({ error: "Image not found" }, 404);

  const filePath = join(
    UPLOADS_ROOT,
    "world-styles",
    String(existing.worldStyleId),
    existing.filename
  );
  try { unlinkSync(filePath); } catch {}

  await db
    .delete(worldStyleReferenceImages)
    .where(eq(worldStyleReferenceImages.id, imageId));
  return c.json({ success: true });
});

// ─── ZIP Download for LoRA Training ───

app.get("/download/characters/:characterId", async (c) => {
  const characterId = parseIntParam(c.req.param("characterId"));

  const character = await db.query.characters.findFirst({
    where: eq(characters.id, characterId),
  });
  if (!character) return c.json({ error: "Character not found" }, 404);

  const images = await db.query.characterReferenceImages.findMany({
    where: eq(characterReferenceImages.characterId, characterId),
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });

  if (images.length === 0) {
    return c.json({ error: "No reference images to download" }, 400);
  }

  return buildLoraZip(
    c,
    character.name,
    images.map((img) => ({
      filePath: join(UPLOADS_ROOT, "characters", String(characterId), img.filename),
      originalFilename: img.originalFilename,
      caption: img.caption,
    }))
  );
});

app.get("/download/world-styles/:worldStyleId", async (c) => {
  const worldStyleId = parseIntParam(c.req.param("worldStyleId"));

  const style = await db.query.worldStyles.findFirst({
    where: eq(worldStyles.id, worldStyleId),
  });
  if (!style) return c.json({ error: "World style not found" }, 404);

  const images = await db.query.worldStyleReferenceImages.findMany({
    where: eq(worldStyleReferenceImages.worldStyleId, worldStyleId),
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });

  if (images.length === 0) {
    return c.json({ error: "No reference images to download" }, 400);
  }

  return buildLoraZip(
    c,
    style.name,
    images.map((img) => ({
      filePath: join(UPLOADS_ROOT, "world-styles", String(worldStyleId), img.filename),
      originalFilename: img.originalFilename,
      caption: img.caption,
    }))
  );
});

async function buildLoraZip(
  c: any,
  subjectName: string,
  entries: { filePath: string; originalFilename: string; caption: string }[]
) {
  // LoRA training format: each image gets a matching .txt caption file
  // Folder named after the subject for easy identification
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  const safeName = subjectName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const folder = zip.folder(safeName)!;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const ext = entry.originalFilename.includes(".")
      ? entry.originalFilename.slice(entry.originalFilename.lastIndexOf("."))
      : ".png";
    const baseName = `${String(i + 1).padStart(3, "0")}${ext}`;
    const captionName = `${String(i + 1).padStart(3, "0")}.txt`;

    try {
      const fileData = readFileSync(entry.filePath);
      folder.file(baseName, fileData);
    } catch {
      continue;
    }

    folder.file(captionName, entry.caption || subjectName);
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

  c.header("Content-Type", "application/zip");
  c.header(
    "Content-Disposition",
    `attachment; filename="${safeName}_lora_training.zip"`
  );
  return c.body(zipBuffer);
}

// ─── Serve uploaded files ───

app.get("/file/:type/:entityId/:filename", async (c) => {
  const type = c.req.param("type");
  const entityId = c.req.param("entityId");
  const filename = c.req.param("filename");

  if (!["characters", "world-styles"].includes(type)) {
    return c.json({ error: "Invalid type" }, 400);
  }

  const filePath = join(UPLOADS_ROOT, type, entityId, filename);
  if (!existsSync(filePath)) {
    return c.json({ error: "File not found" }, 404);
  }

  const file = Bun.file(filePath);
  return new Response(file, {
    headers: { "Content-Type": file.type || "image/png" },
  });
});

export default app;
