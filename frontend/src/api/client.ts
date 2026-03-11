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

// Import types
export interface ImportableItem {
  id: string;
  name: string;
  blurb: string;
  source: "notion" | "ai-generated";
  sourceUrl?: string;
}

export interface ImportResult {
  imported: { name: string; id: number; updated?: boolean }[];
  skipped?: { name: string; reason: string }[];
  failed?: { name: string; reason: string }[];
}

export interface ExploredPage {
  id: string;
  title: string;
  depth: number;
  classification: string;
  confidence: number;
  childCount: number;
  charactersExtracted: number;
  locationsExtracted: number;
  discoveredVia?: string;
}

export interface ExplorationResult {
  characters: ImportableItem[];
  locations: ImportableItem[];
  exploration: {
    pagesScanned: number;
    characterPagesFound: string[];
    locationPagesFound: string[];
    llmClassifications: number;
    allPages: ExploredPage[];
  };
}

export interface ExploreJobProgress {
  pagesScanned: number;
  currentPage: string;
  charactersFound: number;
  locationsFound: number;
  llmClassifications: number;
}

export interface ExploreJobStatus {
  jobId: string;
  status: "running" | "completed" | "failed";
  progress: ExploreJobProgress;
  elapsedMs: number;
  result?: ExplorationResult;
  error?: string;
}

export interface PageClassification {
  type: "characters" | "locations" | "character_list" | "location_list" | "mixed" | "other";
  confidence: number;
  reasoning: string;
}

export interface PagePreview {
  title: string;
  url: string;
  classification?: PageClassification;
  children: {
    id: string;
    title: string;
    type: "characters" | "locations" | "other";
  }[];
  hints: {
    characterContainers: string[];
    locationContainers: string[];
  };
  llmEnabled: boolean;
}

// Import API (Notion - uses server-side token from .env, or optional override)
export const importApi = {
  // Check if Notion is configured
  status: () =>
    request<{ configured: boolean; provider: string }>("/import/notion/status"),
  fetchNotionCharacter: (pageUrl: string, notionToken?: string) =>
    request<{ character: ImportableItem }>("/import/notion/character", {
      method: "POST",
      body: JSON.stringify({ pageUrl, notionToken }),
    }),
  fetchNotionCharacters: (pageUrl: string, notionToken?: string) =>
    request<{ characters: ImportableItem[] }>("/import/notion/characters", {
      method: "POST",
      body: JSON.stringify({ pageUrl, notionToken }),
    }),
  fetchNotionLocations: (pageUrl: string, notionToken?: string) =>
    request<{ locations: ImportableItem[] }>("/import/notion/locations", {
      method: "POST",
      body: JSON.stringify({ pageUrl, notionToken }),
    }),
  // Start exploring a page tree (returns job ID)
  startExplore: (pageUrl: string, maxDepth?: number, notionToken?: string) =>
    request<{ jobId: string }>("/import/notion/explore", {
      method: "POST",
      body: JSON.stringify({ pageUrl, maxDepth, notionToken }),
    }),
  // Poll exploration job status
  pollExplore: (jobId: string) =>
    request<ExploreJobStatus>(`/import/notion/explore/${jobId}`),
  // Preview page structure without full extraction
  previewNotion: (pageUrl: string, notionToken?: string) =>
    request<PagePreview>("/import/notion/preview", {
      method: "POST",
      body: JSON.stringify({ pageUrl, notionToken }),
    }),
  importCharacters: (items: ImportableItem[]) =>
    request<ImportResult>("/import/characters/batch", {
      method: "POST",
      body: JSON.stringify({ items }),
    }),
  importLocations: (items: ImportableItem[]) =>
    request<ImportResult>("/import/locations/batch", {
      method: "POST",
      body: JSON.stringify({ items }),
    }),
};

// Generate API (AI - uses server-side Claude key)
export const generateApi = {
  // Check if AI generation is configured
  status: () =>
    request<{ configured: boolean; provider: string; model: string }>("/generate/status"),
  characters: (prompt: string, count: number) =>
    request<{ characters: ImportableItem[] }>("/generate/characters", {
      method: "POST",
      body: JSON.stringify({ prompt, count }),
    }),
  locations: (prompt: string, count: number) =>
    request<{ locations: ImportableItem[] }>("/generate/locations", {
      method: "POST",
      body: JSON.stringify({ prompt, count }),
    }),
  importCharacters: (items: ImportableItem[]) =>
    request<ImportResult>("/generate/characters/import", {
      method: "POST",
      body: JSON.stringify({ items }),
    }),
  importLocations: (items: ImportableItem[]) =>
    request<ImportResult>("/generate/locations/import", {
      method: "POST",
      body: JSON.stringify({ items }),
    }),
};

