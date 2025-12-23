-- Characters table
CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  blurb TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Locations table
CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  blurb TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Variables table (for condition system)
CREATE TABLE IF NOT EXISTS variables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  default_value REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Scenes table
CREATE TABLE IF NOT EXISTS scenes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  what TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Scene-Character junction table (many-to-many)
CREATE TABLE IF NOT EXISTS scene_characters (
  scene_id INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  PRIMARY KEY (scene_id, character_id)
);

-- Preconditions table (conditions for a scene to be available)
CREATE TABLE IF NOT EXISTS preconditions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scene_id INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  variable_id INTEGER NOT NULL REFERENCES variables(id) ON DELETE CASCADE,
  operator TEXT NOT NULL CHECK (operator IN ('>', '<', '=', '>=', '<=', '!=')),
  value REAL NOT NULL
);

-- Variable changes table (what changes when a scene is chosen)
CREATE TABLE IF NOT EXISTS variable_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scene_id INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  variable_id INTEGER NOT NULL REFERENCES variables(id) ON DELETE CASCADE,
  delta REAL NOT NULL
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_scenes_location ON scenes(location_id);
CREATE INDEX IF NOT EXISTS idx_scene_characters_scene ON scene_characters(scene_id);
CREATE INDEX IF NOT EXISTS idx_scene_characters_character ON scene_characters(character_id);
CREATE INDEX IF NOT EXISTS idx_preconditions_scene ON preconditions(scene_id);
CREATE INDEX IF NOT EXISTS idx_preconditions_variable ON preconditions(variable_id);
CREATE INDEX IF NOT EXISTS idx_variable_changes_scene ON variable_changes(scene_id);
CREATE INDEX IF NOT EXISTS idx_variable_changes_variable ON variable_changes(variable_id);

