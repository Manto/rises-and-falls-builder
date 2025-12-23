// Shared types for the frontend

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

