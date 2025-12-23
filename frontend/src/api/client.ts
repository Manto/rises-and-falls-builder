import type {
  Character,
  CreateCharacterInput,
  Location,
  CreateLocationInput,
  Variable,
  CreateVariableInput,
  Scene,
  CreateSceneInput,
  UpdateSceneInput,
} from "../types";

const API_BASE = "/api";

async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || "Request failed");
  }

  return response.json();
}

// Characters API
export const charactersApi = {
  list: () => request<Character[]>("/characters"),
  get: (id: number) => request<Character>(`/characters/${id}`),
  create: (data: CreateCharacterInput) =>
    request<Character>("/characters", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: number, data: Partial<CreateCharacterInput>) =>
    request<Character>(`/characters/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    request<{ success: boolean }>(`/characters/${id}`, { method: "DELETE" }),
};

// Locations API
export const locationsApi = {
  list: () => request<Location[]>("/locations"),
  get: (id: number) => request<Location>(`/locations/${id}`),
  create: (data: CreateLocationInput) =>
    request<Location>("/locations", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: number, data: Partial<CreateLocationInput>) =>
    request<Location>(`/locations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    request<{ success: boolean }>(`/locations/${id}`, { method: "DELETE" }),
};

// Variables API
export const variablesApi = {
  list: () => request<Variable[]>("/variables"),
  get: (id: number) => request<Variable>(`/variables/${id}`),
  create: (data: CreateVariableInput) =>
    request<Variable>("/variables", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: number, data: Partial<CreateVariableInput>) =>
    request<Variable>(`/variables/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    request<{ success: boolean }>(`/variables/${id}`, { method: "DELETE" }),
};

// Scenes API
export const scenesApi = {
  list: () => request<Scene[]>("/scenes"),
  get: (id: number) => request<Scene>(`/scenes/${id}`),
  create: (data: CreateSceneInput) =>
    request<Scene>("/scenes", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: number, data: UpdateSceneInput) =>
    request<Scene>(`/scenes/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    request<{ success: boolean }>(`/scenes/${id}`, { method: "DELETE" }),
  getAvailable: (variables: Record<number, number>) =>
    request<Scene[]>("/scenes/available", {
      method: "POST",
      body: JSON.stringify({ variables }),
    }),
};

