// ============================================
// Database Row Types (what SQLite returns)
// ============================================

export interface CharacterRow {
  id: number;
  name: string;
  blurb: string;
  created_at: string;
  updated_at: string;
}

export interface LocationRow {
  id: number;
  name: string;
  blurb: string;
  created_at: string;
  updated_at: string;
}

export interface VariableRow {
  id: number;
  name: string;
  description: string;
  default_value: number;
  created_at: string;
  updated_at: string;
}

export interface SceneRow {
  id: number;
  name: string;
  location_id: number | null;
  what: string;
  created_at: string;
  updated_at: string;
}

export interface SceneCharacterRow {
  scene_id: number;
  character_id: number;
}

export interface PreconditionRow {
  id: number;
  scene_id: number;
  variable_id: number;
  operator: ConditionOperator;
  value: number;
}

export interface VariableChangeRow {
  id: number;
  scene_id: number;
  variable_id: number;
  delta: number;
}

// ============================================
// API Types (what we send/receive from API)
// ============================================

export type ConditionOperator = ">" | "<" | "=" | ">=" | "<=" | "!=";

export interface Character {
  id: number;
  name: string;
  blurb: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCharacterInput {
  name: string;
  blurb: string;
}

export interface Location {
  id: number;
  name: string;
  blurb: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLocationInput {
  name: string;
  blurb: string;
}

export interface Variable {
  id: number;
  name: string;
  description: string;
  defaultValue: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVariableInput {
  name: string;
  description: string;
  defaultValue: number;
}

export interface Precondition {
  id?: number;
  variableId: number;
  variableName?: string;
  operator: ConditionOperator;
  value: number;
}

export interface VariableChange {
  id?: number;
  variableId: number;
  variableName?: string;
  delta: number;
}

export interface Scene {
  id: number;
  name: string;
  locationId: number | null;
  locationName?: string;
  what: string;
  characters: Character[];
  preconditions: Precondition[];
  variableChanges: VariableChange[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateSceneInput {
  name: string;
  locationId: number | null;
  what: string;
  characterIds: number[];
  preconditions: Omit<Precondition, "id" | "variableName">[];
  variableChanges: Omit<VariableChange, "id" | "variableName">[];
}

export interface UpdateSceneInput extends Partial<CreateSceneInput> {}

// ============================================
// Playthrough Types (for later)
// ============================================

export interface PlaythroughState {
  currentSceneId: number | null;
  variables: Record<number, number>; // variableId -> current value
  visitedSceneIds: number[];
}

