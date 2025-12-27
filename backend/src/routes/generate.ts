import { Hono } from "hono";
import { db } from "../db";
import { characters, locations } from "../db/schema";

const generateRoutes = new Hono();

// Configuration
const CLAUDE_MODEL = "claude-opus-4-5";

// Types
interface GeneratedCharacter {
  id: string;
  name: string;
  blurb: string;
  source: "ai-generated";
}

interface GeneratedLocation {
  id: string;
  name: string;
  blurb: string;
  source: "ai-generated";
}

// Get API key from environment
function getAnthropicKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY not configured. Add it to backend/.env file.");
  }
  return key;
}

// Claude API call
async function callClaude(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const apiKey = getAnthropicKey();
  
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Claude API error: ${response.status}`);
  }

  const data = await response.json();
  // Claude returns content as an array of content blocks
  const textContent = data.content?.find((c: any) => c.type === "text");
  return textContent?.text || "";
}

// System prompts for different entity types
const CHARACTER_SYSTEM_PROMPT = `You are a creative writing assistant helping to develop characters for a dystopian sci-fi story set in the San Francisco Bay Area in 2065.

The world features:
- Climate change has reshaped coastal cities
- AI and automation dominate but haven't achieved consciousness
- Massive wealth inequality between tech elites and displaced workers
- VR escapism and transhumanist movements
- Underground resistance movements preserving human connection

When generating characters, create diverse, morally complex individuals who fit this world. Each character should have:
- A distinct name (realistic, culturally appropriate)
- A compelling blurb (2-3 sentences capturing their role, personality, and what makes them interesting)

Output ONLY valid JSON in this exact format:
{
  "characters": [
    {"name": "Character Name", "blurb": "Description here..."},
    ...
  ]
}`;

const LOCATION_SYSTEM_PROMPT = `You are a creative writing assistant helping to develop locations for a dystopian sci-fi story set in the San Francisco Bay Area in 2065.

The world features:
- San Francisco gleams behind sea walls, a contracted tech utopia
- Oakland absorbed climate refugees, now dense with converted warehouses
- Underground resistance spaces operate in algorithmic blind spots
- Corporate headquarters for tech giants dominate the skyline
- VR dens, deprogramming centers, and off-grid establishments dot the landscape

When generating locations, create atmospheric places that fit this world. Each location should have:
- A evocative name
- A compelling blurb (2-3 sentences capturing the atmosphere, purpose, and who frequents it)

Output ONLY valid JSON in this exact format:
{
  "locations": [
    {"name": "Location Name", "blurb": "Description here..."},
    ...
  ]
}`;

// ========================================
// Routes
// ========================================

// Check if API is configured
generateRoutes.get("/status", async (c) => {
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  return c.json({ 
    configured: hasKey,
    provider: "anthropic",
    model: CLAUDE_MODEL
  });
});

// Generate characters from prompt
generateRoutes.post("/characters", async (c) => {
  const body = await c.req.json();
  const { prompt, count = 3 } = body;
  
  if (!prompt) {
    return c.json({ error: "Prompt is required" }, 400);
  }
  
  try {
    const userPrompt = `Generate ${count} characters based on this prompt: "${prompt}"
    
Make them diverse and interesting. They should fit the Bay Area 2065 dystopian setting.`;

    const response = await callClaude(CHARACTER_SYSTEM_PROMPT, userPrompt);
    
    // Parse the JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse AI response");
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    const characters: GeneratedCharacter[] = (parsed.characters || []).map(
      (char: any, index: number) => ({
        id: `gen-${Date.now()}-${index}`,
        name: char.name,
        blurb: char.blurb,
        source: "ai-generated" as const,
      })
    );
    
    return c.json({ characters });
  } catch (error) {
    console.error("Generation error:", error);
    return c.json({ 
      error: error instanceof Error ? error.message : "Failed to generate characters" 
    }, 500);
  }
});

// Generate locations from prompt
generateRoutes.post("/locations", async (c) => {
  const body = await c.req.json();
  const { prompt, count = 3 } = body;
  
  if (!prompt) {
    return c.json({ error: "Prompt is required" }, 400);
  }
  
  try {
    const userPrompt = `Generate ${count} locations based on this prompt: "${prompt}"
    
Make them atmospheric and fit the Bay Area 2065 dystopian setting.`;

    const response = await callClaude(LOCATION_SYSTEM_PROMPT, userPrompt);
    
    // Parse the JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse AI response");
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    const locations: GeneratedLocation[] = (parsed.locations || []).map(
      (loc: any, index: number) => ({
        id: `gen-${Date.now()}-${index}`,
        name: loc.name,
        blurb: loc.blurb,
        source: "ai-generated" as const,
      })
    );
    
    return c.json({ locations });
  } catch (error) {
    console.error("Generation error:", error);
    return c.json({ 
      error: error instanceof Error ? error.message : "Failed to generate locations" 
    }, 500);
  }
});

// Import selected generated characters into database
generateRoutes.post("/characters/import", async (c) => {
  const body = await c.req.json();
  const { items } = body as { items: GeneratedCharacter[] };
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    return c.json({ error: "No items to import" }, 400);
  }
  
  try {
    const imported: { name: string; id: number }[] = [];
    const skipped: { name: string; reason: string }[] = [];
    
    for (const item of items) {
      try {
        const result = db
          .insert(characters)
          .values({ name: item.name, blurb: item.blurb })
          .returning()
          .get();
        imported.push({ name: result.name, id: result.id });
      } catch (err: any) {
        if (err.message?.includes("UNIQUE constraint failed")) {
          skipped.push({ name: item.name, reason: "Already exists" });
        } else {
          skipped.push({ name: item.name, reason: err.message || "Unknown error" });
        }
      }
    }
    
    return c.json({ imported, skipped });
  } catch (error) {
    console.error("Import error:", error);
    return c.json({ 
      error: error instanceof Error ? error.message : "Failed to import" 
    }, 500);
  }
});

// Import selected generated locations into database
generateRoutes.post("/locations/import", async (c) => {
  const body = await c.req.json();
  const { items } = body as { items: GeneratedLocation[] };
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    return c.json({ error: "No items to import" }, 400);
  }
  
  try {
    const imported: { name: string; id: number }[] = [];
    const skipped: { name: string; reason: string }[] = [];
    
    for (const item of items) {
      try {
        const result = db
          .insert(locations)
          .values({ name: item.name, blurb: item.blurb })
          .returning()
          .get();
        imported.push({ name: result.name, id: result.id });
      } catch (err: any) {
        if (err.message?.includes("UNIQUE constraint failed")) {
          skipped.push({ name: item.name, reason: "Already exists" });
        } else {
          skipped.push({ name: item.name, reason: err.message || "Unknown error" });
        }
      }
    }
    
    return c.json({ imported, skipped });
  } catch (error) {
    console.error("Import error:", error);
    return c.json({ 
      error: error instanceof Error ? error.message : "Failed to import" 
    }, 500);
  }
});

export default generateRoutes;
