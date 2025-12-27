// Re-export types from Drizzle schema
export type {
  Character,
  NewCharacter,
  Location,
  NewLocation,
  Variable,
  NewVariable,
  Scene,
  NewScene,
  SceneCharacter,
  NewSceneCharacter,
  Precondition,
  NewPrecondition,
  VariableChange,
  NewVariableChange,
} from "./db/schema";

// ============================================
// API Input Types
// ============================================

export type ConditionOperator = ">" | "<" | "=" | ">=" | "<=" | "!=";
export type VariableType = "Character" | "World State" | "Knowledge";

export interface CreateCharacterInput {
  name: string;
  blurb?: string;
}

export interface CreateLocationInput {
  name: string;
  blurb?: string;
}

export interface CreateVariableInput {
  name: string;
  description?: string;
  defaultValue?: number;
  type?: VariableType;
}

export interface PreconditionInput {
  variableId: number;
  operator: ConditionOperator;
  value: number;
}

export interface VariableChangeInput {
  variableId: number;
  delta: number;
}

export interface CreateSceneInput {
  name: string;
  locationId?: number | null;
  what?: string;
  characterIds?: number[];
  preconditions?: PreconditionInput[];
  variableChanges?: VariableChangeInput[];
}

export interface UpdateSceneInput extends Partial<CreateSceneInput> {}

// ============================================
// API Response Types (with joined data)
// ============================================

export interface FullScene {
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

// ============================================
// Playthrough Types (for later)
// ============================================

export interface PlaythroughState {
  currentSceneId: number | null;
  variables: Record<number, number>; // variableId -> current value
  visitedSceneIds: number[];
}
