import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Characters table
export const characters = sqliteTable("characters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  blurb: text("blurb").notNull().default(""),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Locations table
export const locations = sqliteTable("locations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  blurb: text("blurb").notNull().default(""),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Variables table (for condition system)
export const variables = sqliteTable("variables", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  defaultValue: real("default_value").notNull().default(0),
  type: text("type", { enum: ["Character", "World State", "Knowledge"] })
    .notNull()
    .default("World State"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Scenes table
export const scenes = sqliteTable(
  "scenes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    locationId: integer("location_id").references(() => locations.id, {
      onDelete: "set null",
    }),
    what: text("what").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [index("idx_scenes_location").on(table.locationId)]
);

// Scene-Character junction table (many-to-many)
export const sceneCharacters = sqliteTable(
  "scene_characters",
  {
    sceneId: integer("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    characterId: integer("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("idx_scene_characters_scene").on(table.sceneId),
    index("idx_scene_characters_character").on(table.characterId),
  ]
);

// Preconditions table (conditions for a scene to be available)
export const preconditions = sqliteTable(
  "preconditions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sceneId: integer("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    variableId: integer("variable_id")
      .notNull()
      .references(() => variables.id, { onDelete: "cascade" }),
    operator: text("operator", {
      enum: [">", "<", "=", ">=", "<=", "!="],
    }).notNull(),
    value: real("value").notNull(),
  },
  (table) => [
    index("idx_preconditions_scene").on(table.sceneId),
    index("idx_preconditions_variable").on(table.variableId),
  ]
);

// Variable changes table (what changes when a scene is chosen)
export const variableChanges = sqliteTable(
  "variable_changes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sceneId: integer("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    variableId: integer("variable_id")
      .notNull()
      .references(() => variables.id, { onDelete: "cascade" }),
    delta: real("delta").notNull(),
  },
  (table) => [
    index("idx_variable_changes_scene").on(table.sceneId),
    index("idx_variable_changes_variable").on(table.variableId),
  ]
);

// Character reference images (for LoRA training)
export const characterReferenceImages = sqliteTable(
  "character_reference_images",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    characterId: integer("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    originalFilename: text("original_filename").notNull(),
    caption: text("caption").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [index("idx_char_ref_images_character").on(table.characterId)]
);

// World styles (for style LoRA training)
export const worldStyles = sqliteTable("world_styles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// World style reference images (for LoRA training)
export const worldStyleReferenceImages = sqliteTable(
  "world_style_reference_images",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    worldStyleId: integer("world_style_id")
      .notNull()
      .references(() => worldStyles.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    originalFilename: text("original_filename").notNull(),
    caption: text("caption").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [index("idx_world_ref_images_style").on(table.worldStyleId)]
);

// Export types inferred from schema
export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;

export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;

export type Variable = typeof variables.$inferSelect;
export type NewVariable = typeof variables.$inferInsert;

export type Scene = typeof scenes.$inferSelect;
export type NewScene = typeof scenes.$inferInsert;

export type SceneCharacter = typeof sceneCharacters.$inferSelect;
export type NewSceneCharacter = typeof sceneCharacters.$inferInsert;

export type Precondition = typeof preconditions.$inferSelect;
export type NewPrecondition = typeof preconditions.$inferInsert;

export type VariableChange = typeof variableChanges.$inferSelect;
export type NewVariableChange = typeof variableChanges.$inferInsert;

export type CharacterReferenceImage = typeof characterReferenceImages.$inferSelect;
export type NewCharacterReferenceImage = typeof characterReferenceImages.$inferInsert;

export type WorldStyle = typeof worldStyles.$inferSelect;
export type NewWorldStyle = typeof worldStyles.$inferInsert;

export type WorldStyleReferenceImage = typeof worldStyleReferenceImages.$inferSelect;
export type NewWorldStyleReferenceImage = typeof worldStyleReferenceImages.$inferInsert;

