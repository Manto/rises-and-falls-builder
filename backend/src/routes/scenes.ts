import { Hono } from "hono";
import { db, getCurrentTimestamp } from "../db";
import type {
  SceneRow,
  Scene,
  CreateSceneInput,
  UpdateSceneInput,
  CharacterRow,
  PreconditionRow,
  VariableChangeRow,
  Character,
  Precondition,
  VariableChange,
} from "../types";

const scenes = new Hono();

// Helper to get full scene with all relationships
function getFullScene(sceneId: number): Scene | null {
  const sceneRow = db
    .query(
      `SELECT s.*, l.name as location_name 
       FROM scenes s 
       LEFT JOIN locations l ON s.location_id = l.id 
       WHERE s.id = ?`
    )
    .get(sceneId) as (SceneRow & { location_name: string | null }) | null;

  if (!sceneRow) return null;

  // Get characters
  const characterRows = db
    .query(
      `SELECT c.* FROM characters c
       JOIN scene_characters sc ON c.id = sc.character_id
       WHERE sc.scene_id = ?
       ORDER BY c.name`
    )
    .all(sceneId) as CharacterRow[];

  // Get preconditions with variable names
  const preconditionRows = db
    .query(
      `SELECT p.*, v.name as variable_name 
       FROM preconditions p
       JOIN variables v ON p.variable_id = v.id
       WHERE p.scene_id = ?`
    )
    .all(sceneId) as (PreconditionRow & { variable_name: string })[];

  // Get variable changes with variable names
  const changeRows = db
    .query(
      `SELECT vc.*, v.name as variable_name 
       FROM variable_changes vc
       JOIN variables v ON vc.variable_id = v.id
       WHERE vc.scene_id = ?`
    )
    .all(sceneId) as (VariableChangeRow & { variable_name: string })[];

  return {
    id: sceneRow.id,
    name: sceneRow.name,
    locationId: sceneRow.location_id,
    locationName: sceneRow.location_name || undefined,
    what: sceneRow.what,
    characters: characterRows.map((c) => ({
      id: c.id,
      name: c.name,
      blurb: c.blurb,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    })),
    preconditions: preconditionRows.map((p) => ({
      id: p.id,
      variableId: p.variable_id,
      variableName: p.variable_name,
      operator: p.operator,
      value: p.value,
    })),
    variableChanges: changeRows.map((vc) => ({
      id: vc.id,
      variableId: vc.variable_id,
      variableName: vc.variable_name,
      delta: vc.delta,
    })),
    createdAt: sceneRow.created_at,
    updatedAt: sceneRow.updated_at,
  };
}

// GET /scenes - List all scenes (with relationships)
scenes.get("/", (c) => {
  const sceneRows = db.query("SELECT id FROM scenes ORDER BY name").all() as { id: number }[];
  const fullScenes = sceneRows
    .map((row) => getFullScene(row.id))
    .filter((s): s is Scene => s !== null);
  return c.json(fullScenes);
});

// GET /scenes/:id - Get a single scene with all relationships
scenes.get("/:id", (c) => {
  const id = parseInt(c.req.param("id"));
  const scene = getFullScene(id);

  if (!scene) {
    return c.json({ error: "Scene not found" }, 404);
  }

  return c.json(scene);
});

// POST /scenes - Create a new scene
scenes.post("/", async (c) => {
  const body = await c.req.json<CreateSceneInput>();

  if (!body.name || body.name.trim() === "") {
    return c.json({ error: "Name is required" }, 400);
  }

  // Start a transaction
  const transaction = db.transaction(() => {
    // Create the scene
    const sceneResult = db
      .query(
        "INSERT INTO scenes (name, location_id, what) VALUES (?, ?, ?) RETURNING *"
      )
      .get(body.name.trim(), body.locationId, body.what || "") as SceneRow;

    const sceneId = sceneResult.id;

    // Add characters
    if (body.characterIds && body.characterIds.length > 0) {
      const insertChar = db.prepare(
        "INSERT INTO scene_characters (scene_id, character_id) VALUES (?, ?)"
      );
      for (const charId of body.characterIds) {
        insertChar.run(sceneId, charId);
      }
    }

    // Add preconditions
    if (body.preconditions && body.preconditions.length > 0) {
      const insertPrecond = db.prepare(
        "INSERT INTO preconditions (scene_id, variable_id, operator, value) VALUES (?, ?, ?, ?)"
      );
      for (const p of body.preconditions) {
        insertPrecond.run(sceneId, p.variableId, p.operator, p.value);
      }
    }

    // Add variable changes
    if (body.variableChanges && body.variableChanges.length > 0) {
      const insertChange = db.prepare(
        "INSERT INTO variable_changes (scene_id, variable_id, delta) VALUES (?, ?, ?)"
      );
      for (const vc of body.variableChanges) {
        insertChange.run(sceneId, vc.variableId, vc.delta);
      }
    }

    return sceneId;
  });

  try {
    const sceneId = transaction();
    const scene = getFullScene(sceneId);
    return c.json(scene, 201);
  } catch (error: any) {
    if (error.message?.includes("FOREIGN KEY constraint")) {
      return c.json({ error: "Invalid character, location, or variable ID" }, 400);
    }
    throw error;
  }
});

// PUT /scenes/:id - Update a scene
scenes.put("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json<UpdateSceneInput>();
  const timestamp = getCurrentTimestamp();

  const existing = db.query("SELECT * FROM scenes WHERE id = ?").get(id);
  if (!existing) {
    return c.json({ error: "Scene not found" }, 404);
  }

  const transaction = db.transaction(() => {
    // Update basic scene info
    db.query(
      `UPDATE scenes 
       SET name = COALESCE(?, name),
           location_id = COALESCE(?, location_id),
           what = COALESCE(?, what),
           updated_at = ?
       WHERE id = ?`
    ).run(body.name?.trim(), body.locationId, body.what, timestamp, id);

    // Update characters if provided
    if (body.characterIds !== undefined) {
      db.query("DELETE FROM scene_characters WHERE scene_id = ?").run(id);
      if (body.characterIds.length > 0) {
        const insertChar = db.prepare(
          "INSERT INTO scene_characters (scene_id, character_id) VALUES (?, ?)"
        );
        for (const charId of body.characterIds) {
          insertChar.run(id, charId);
        }
      }
    }

    // Update preconditions if provided
    if (body.preconditions !== undefined) {
      db.query("DELETE FROM preconditions WHERE scene_id = ?").run(id);
      if (body.preconditions.length > 0) {
        const insertPrecond = db.prepare(
          "INSERT INTO preconditions (scene_id, variable_id, operator, value) VALUES (?, ?, ?, ?)"
        );
        for (const p of body.preconditions) {
          insertPrecond.run(id, p.variableId, p.operator, p.value);
        }
      }
    }

    // Update variable changes if provided
    if (body.variableChanges !== undefined) {
      db.query("DELETE FROM variable_changes WHERE scene_id = ?").run(id);
      if (body.variableChanges.length > 0) {
        const insertChange = db.prepare(
          "INSERT INTO variable_changes (scene_id, variable_id, delta) VALUES (?, ?, ?)"
        );
        for (const vc of body.variableChanges) {
          insertChange.run(id, vc.variableId, vc.delta);
        }
      }
    }
  });

  try {
    transaction();
    const scene = getFullScene(id);
    return c.json(scene);
  } catch (error: any) {
    if (error.message?.includes("FOREIGN KEY constraint")) {
      return c.json({ error: "Invalid character, location, or variable ID" }, 400);
    }
    throw error;
  }
});

// DELETE /scenes/:id - Delete a scene
scenes.delete("/:id", (c) => {
  const id = parseInt(c.req.param("id"));

  const existing = db.query("SELECT * FROM scenes WHERE id = ?").get(id);
  if (!existing) {
    return c.json({ error: "Scene not found" }, 404);
  }

  db.query("DELETE FROM scenes WHERE id = ?").run(id);
  return c.json({ success: true });
});

// GET /scenes/available - Get scenes that match current variable state
// This will be useful for the playthrough system
scenes.post("/available", async (c) => {
  const body = await c.req.json<{ variables: Record<number, number> }>();
  const currentVars = body.variables || {};

  // Get all scenes with their preconditions
  const allScenes = db.query("SELECT id FROM scenes").all() as { id: number }[];
  
  const availableScenes: Scene[] = [];

  for (const { id } of allScenes) {
    const preconditions = db
      .query(
        `SELECT p.*, v.default_value 
         FROM preconditions p
         JOIN variables v ON p.variable_id = v.id
         WHERE p.scene_id = ?`
      )
      .all(id) as (PreconditionRow & { default_value: number })[];

    // Check if all preconditions are met
    let allMet = true;
    for (const p of preconditions) {
      const currentValue = currentVars[p.variable_id] ?? p.default_value;
      
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
      const scene = getFullScene(id);
      if (scene) availableScenes.push(scene);
    }
  }

  return c.json(availableScenes);
});

export default scenes;

