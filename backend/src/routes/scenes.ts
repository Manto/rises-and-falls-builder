import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db, sqliteDb, getCurrentTimestamp } from "../db";
import {
  scenes,
  sceneCharacters,
  preconditions,
  variableChanges,
  characters,
  locations,
  variables,
} from "../db/schema";
import { parseIntParam } from "../utils";

const app = new Hono();

type ConditionOperator = ">" | "<" | "=" | ">=" | "<=" | "!=";

interface FullScene {
  id: number;
  name: string;
  locationId: number | null;
  locationName?: string;
  what: string;
  characters: {
    id: number;
    name: string;
    blurb: string;
    createdAt: string;
    updatedAt: string;
  }[];
  preconditions: {
    id: number;
    variableId: number;
    variableName: string;
    operator: string;
    value: number;
  }[];
  variableChanges: {
    id: number;
    variableId: number;
    variableName: string;
    delta: number;
  }[];
  createdAt: string;
  updatedAt: string;
}

// Helper to get full scene with all relationships
async function getFullScene(sceneId: number): Promise<FullScene | null> {
  const scene = await db.query.scenes.findFirst({
    where: eq(scenes.id, sceneId),
  });

  if (!scene) return null;

  // Get location name
  let locationName: string | undefined;
  if (scene.locationId) {
    const loc = await db.query.locations.findFirst({
      where: eq(locations.id, scene.locationId),
    });
    locationName = loc?.name;
  }

  // Get characters
  const sceneChars = await db
    .select({
      id: characters.id,
      name: characters.name,
      blurb: characters.blurb,
      createdAt: characters.createdAt,
      updatedAt: characters.updatedAt,
    })
    .from(sceneCharacters)
    .innerJoin(characters, eq(sceneCharacters.characterId, characters.id))
    .where(eq(sceneCharacters.sceneId, sceneId));

  // Get preconditions with variable names
  const preconds = await db
    .select({
      id: preconditions.id,
      variableId: preconditions.variableId,
      variableName: variables.name,
      operator: preconditions.operator,
      value: preconditions.value,
    })
    .from(preconditions)
    .innerJoin(variables, eq(preconditions.variableId, variables.id))
    .where(eq(preconditions.sceneId, sceneId));

  // Get variable changes with variable names
  const changes = await db
    .select({
      id: variableChanges.id,
      variableId: variableChanges.variableId,
      variableName: variables.name,
      delta: variableChanges.delta,
    })
    .from(variableChanges)
    .innerJoin(variables, eq(variableChanges.variableId, variables.id))
    .where(eq(variableChanges.sceneId, sceneId));

  return {
    id: scene.id,
    name: scene.name,
    locationId: scene.locationId,
    locationName,
    what: scene.what,
    characters: sceneChars,
    preconditions: preconds,
    variableChanges: changes,
    createdAt: scene.createdAt,
    updatedAt: scene.updatedAt,
  };
}

// GET /scenes - List all scenes (with relationships)
app.get("/", async (c) => {
  const sceneRows = await db.query.scenes.findMany({
    orderBy: (scenes, { asc }) => [asc(scenes.name)],
  });

  const fullScenes = await Promise.all(
    sceneRows.map((row) => getFullScene(row.id))
  );

  return c.json(fullScenes.filter((s): s is FullScene => s !== null));
});

// GET /scenes/:id - Get a single scene with all relationships
app.get("/:id", async (c) => {
  try {
    const id = parseIntParam(c.req.param("id"));
    const scene = await getFullScene(id);

    if (!scene) {
      return c.json({ error: "Scene not found" }, 404);
    }

    return c.json(scene);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    throw error;
  }
});

// POST /scenes - Create a new scene
app.post("/", async (c) => {
  const body = await c.req.json<{
    name: string;
    locationId?: number | null;
    what?: string;
    characterIds?: number[];
    preconditions?: { variableId: number; operator: ConditionOperator; value: number }[];
    variableChanges?: { variableId: number; delta: number }[];
  }>();

  if (!body.name || body.name.trim() === "") {
    return c.json({ error: "Name is required" }, 400);
  }

  try {
    // Use SQLite transaction
    const sceneId = sqliteDb.transaction(() => {
      // Create the scene
      const [sceneResult] = db
        .insert(scenes)
        .values({
          name: body.name.trim(),
          locationId: body.locationId ?? null,
          what: body.what || "",
        })
        .returning()
        .all();

      const newSceneId = sceneResult.id;

      // Add characters
      if (body.characterIds && body.characterIds.length > 0) {
        for (const charId of body.characterIds) {
          db.insert(sceneCharacters)
            .values({ sceneId: newSceneId, characterId: charId })
            .run();
        }
      }

      // Add preconditions
      if (body.preconditions && body.preconditions.length > 0) {
        for (const p of body.preconditions) {
          db.insert(preconditions)
            .values({
              sceneId: newSceneId,
              variableId: p.variableId,
              operator: p.operator,
              value: p.value,
            })
            .run();
        }
      }

      // Add variable changes
      if (body.variableChanges && body.variableChanges.length > 0) {
        for (const vc of body.variableChanges) {
          db.insert(variableChanges)
            .values({
              sceneId: newSceneId,
              variableId: vc.variableId,
              delta: vc.delta,
            })
            .run();
        }
      }

      return newSceneId;
    })();

    const scene = await getFullScene(sceneId);
    return c.json(scene, 201);
  } catch (error: any) {
    if (error.message?.includes("FOREIGN KEY constraint")) {
      return c.json({ error: "Invalid character, location, or variable ID" }, 400);
    }
    throw error;
  }
});

// PUT /scenes/:id - Update a scene
app.put("/:id", async (c) => {
  try {
    const id = parseIntParam(c.req.param("id"));
    const body = await c.req.json<{
      name?: string;
      locationId?: number | null;
      what?: string;
      characterIds?: number[];
      preconditions?: { variableId: number; operator: ConditionOperator; value: number }[];
      variableChanges?: { variableId: number; delta: number }[];
    }>();
    const timestamp = getCurrentTimestamp();

    const existing = await db.query.scenes.findFirst({
      where: eq(scenes.id, id),
    });

    if (!existing) {
      return c.json({ error: "Scene not found" }, 404);
    }

    try {
    sqliteDb.transaction(() => {
      // Update basic scene info
      db.update(scenes)
        .set({
          name: body.name?.trim() ?? existing.name,
          locationId: body.locationId !== undefined ? body.locationId : existing.locationId,
          what: body.what ?? existing.what,
          updatedAt: timestamp,
        })
        .where(eq(scenes.id, id))
        .run();

      // Update characters if provided
      if (body.characterIds !== undefined) {
        db.delete(sceneCharacters).where(eq(sceneCharacters.sceneId, id)).run();
        for (const charId of body.characterIds) {
          db.insert(sceneCharacters)
            .values({ sceneId: id, characterId: charId })
            .run();
        }
      }

      // Update preconditions if provided
      if (body.preconditions !== undefined) {
        db.delete(preconditions).where(eq(preconditions.sceneId, id)).run();
        for (const p of body.preconditions) {
          db.insert(preconditions)
            .values({
              sceneId: id,
              variableId: p.variableId,
              operator: p.operator,
              value: p.value,
            })
            .run();
        }
      }

      // Update variable changes if provided
      if (body.variableChanges !== undefined) {
        db.delete(variableChanges).where(eq(variableChanges.sceneId, id)).run();
        for (const vc of body.variableChanges) {
          db.insert(variableChanges)
            .values({
              sceneId: id,
              variableId: vc.variableId,
              delta: vc.delta,
            })
            .run();
        }
      }
    })();

    const scene = await getFullScene(id);
    return c.json(scene);
  } catch (error: any) {
    if (error.message?.includes("FOREIGN KEY constraint")) {
      return c.json({ error: "Invalid character, location, or variable ID" }, 400);
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

// DELETE /scenes/:id - Delete a scene
app.delete("/:id", async (c) => {
  try {
    const id = parseIntParam(c.req.param("id"));

    const existing = await db.query.scenes.findFirst({
      where: eq(scenes.id, id),
    });

    if (!existing) {
      return c.json({ error: "Scene not found" }, 404);
    }

    await db.delete(scenes).where(eq(scenes.id, id));
    return c.json({ success: true });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    throw error;
  }
});

// POST /scenes/available - Get scenes that match current variable state
app.post("/available", async (c) => {
  const body = await c.req.json<{ variables: Record<number, number> }>();
  const currentVars = body.variables || {};

  const allScenes = await db.query.scenes.findMany();
  const availableScenes: FullScene[] = [];

  for (const scene of allScenes) {
    // Get preconditions for this scene
    const preconds = await db
      .select({
        variableId: preconditions.variableId,
        operator: preconditions.operator,
        value: preconditions.value,
        defaultValue: variables.defaultValue,
      })
      .from(preconditions)
      .innerJoin(variables, eq(preconditions.variableId, variables.id))
      .where(eq(preconditions.sceneId, scene.id));

    // Check if all preconditions are met
    let allMet = true;
    for (const p of preconds) {
      const currentValue = currentVars[p.variableId] ?? p.defaultValue;

      switch (p.operator) {
        case ">":
          allMet = currentValue > p.value;
          break;
        case "<":
          allMet = currentValue < p.value;
          break;
        case "=":
          allMet = currentValue === p.value;
          break;
        case ">=":
          allMet = currentValue >= p.value;
          break;
        case "<=":
          allMet = currentValue <= p.value;
          break;
        case "!=":
          allMet = currentValue !== p.value;
          break;
      }

      if (!allMet) break;
    }

    if (allMet) {
      const fullScene = await getFullScene(scene.id);
      if (fullScene) availableScenes.push(fullScene);
    }
  }

  return c.json(availableScenes);
});

export default app;
