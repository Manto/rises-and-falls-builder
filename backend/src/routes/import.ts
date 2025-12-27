import { Hono } from "hono";
import { db } from "../db";
import { characters, locations } from "../db/schema";

const importRoutes = new Hono();

// Types for import operations
interface NotionPage {
  id: string;
  title: string;
  url: string;
  content?: string;
}

interface ImportableCharacter {
  id: string;
  name: string;
  blurb: string;
  source: string;
  sourceUrl?: string;
}

interface ImportableLocation {
  id: string;
  name: string;
  blurb: string;
  source: string;
  sourceUrl?: string;
}

// Notion API configuration
const NOTION_API_BASE = "https://api.notion.com/v1";

// Get Notion token from environment or request
function getNotionToken(requestToken?: string): string {
  const token = requestToken || process.env.NOTION_TOKEN;
  if (!token) {
    throw new Error("NOTION_TOKEN not configured. Add it to backend/.env file or provide in request.");
  }
  return token;
}

async function notionRequest(endpoint: string, token: string) {
  const response = await fetch(`${NOTION_API_BASE}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Notion API error: ${response.status}`);
  }

  return response.json();
}

// Fetch and parse a Notion page
async function fetchNotionPage(pageId: string, token: string): Promise<NotionPage> {
  // Get page properties
  const page = await notionRequest(`/pages/${pageId}`, token);
  
  // Get page content (blocks)
  const blocks = await notionRequest(`/blocks/${pageId}/children?page_size=100`, token);
  
  // Extract title from page properties
  let title = "Untitled";
  if (page.properties?.title?.title?.[0]?.plain_text) {
    title = page.properties.title.title[0].plain_text;
  } else if (page.properties?.Name?.title?.[0]?.plain_text) {
    title = page.properties.Name.title[0].plain_text;
  } else {
    // Try to find any title property
    for (const key of Object.keys(page.properties || {})) {
      const prop = page.properties[key];
      if (prop.type === "title" && prop.title?.[0]?.plain_text) {
        title = prop.title[0].plain_text;
        break;
      }
    }
  }
  
  // Extract text content from blocks
  const content = extractTextFromBlocks(blocks.results);
  
  return {
    id: pageId,
    title,
    url: page.url,
    content,
  };
}

// Extract plain text from Notion blocks
function extractTextFromBlocks(blocks: any[]): string {
  const textParts: string[] = [];
  
  for (const block of blocks) {
    const blockType = block.type;
    const blockContent = block[blockType];
    
    if (blockContent?.rich_text) {
      const text = blockContent.rich_text.map((t: any) => t.plain_text).join("");
      if (text.trim()) {
        textParts.push(text);
      }
    }
    
    // Handle child pages (just get titles)
    if (blockType === "child_page") {
      textParts.push(`[Page: ${blockContent.title}]`);
    }
  }
  
  return textParts.join("\n");
}

// Parse character data from Notion page
function parseCharacterFromNotionPage(page: NotionPage): ImportableCharacter {
  // Clean up title - remove emojis and role descriptions
  let name = page.title
    .replace(/^[👌🚧📝✅❌🔥💡🎯]\s*/g, "") // Remove status emojis
    .replace(/\s*-\s*.+$/, "") // Remove " - Role Description"
    .trim();
  
  // Generate blurb from content (first 200 chars or first paragraph)
  let blurb = "";
  if (page.content) {
    const lines = page.content.split("\n").filter(l => l.trim());
    // Skip status callouts
    const meaningfulLines = lines.filter(l => 
      !l.startsWith("Status:") && 
      !l.startsWith("[Page:") &&
      l.length > 20
    );
    if (meaningfulLines.length > 0) {
      blurb = meaningfulLines[0].substring(0, 200);
      if (meaningfulLines[0].length > 200) blurb += "...";
    }
  }
  
  return {
    id: page.id,
    name,
    blurb,
    source: "notion",
    sourceUrl: page.url,
  };
}

// Parse location data from content
function parseLocationsFromContent(content: string, sourceUrl?: string): ImportableLocation[] {
  const locations: ImportableLocation[] = [];
  
  // Common Bay Area 2065 locations from the world setting
  const locationPatterns = [
    { pattern: /San Francisco/gi, name: "San Francisco (2065)", blurb: "Tech utopia behind sea walls, gleaming towers and self-cleaning streets" },
    { pattern: /Oakland|East Bay/gi, name: "Oakland / East Bay", blurb: "Absorbed migration waves, dense warehouses and converted Victorians" },
    { pattern: /Fruitvale/gi, name: "Fruitvale", blurb: "Descended into slum conditions, families warehoused in decrepit units" },
    { pattern: /Highland Hospital/gi, name: "Highland Hospital", blurb: "Safety net hospital treating uninsured and undocumented patients" },
    { pattern: /Chinatown/gi, name: "Oakland Chinatown", blurb: "Community center, immigrant families pooling resources to survive" },
    { pattern: /deprogramming center|VR.+center/gi, name: "VR Deprogramming Center", blurb: "Church-based facility helping VR addicts return to reality" },
    { pattern: /supper club|underground.+restaurant/gi, name: "Underground Supper Club", blurb: "Off-grid dining serving those avoiding digital payment trails" },
    { pattern: /Prometheus|Vela/gi, name: "Prometheus Industries HQ", blurb: "Corporate headquarters for neural interfaces and consciousness research" },
  ];
  
  for (const { pattern, name, blurb } of locationPatterns) {
    if (pattern.test(content)) {
      // Check if we already have this location
      if (!locations.find(l => l.name === name)) {
        locations.push({
          id: `loc-${name.toLowerCase().replace(/\s+/g, "-")}`,
          name,
          blurb,
          source: "notion",
          sourceUrl,
        });
      }
    }
  }
  
  return locations;
}

// ========================================
// Routes
// ========================================

// Check if Notion is configured
importRoutes.get("/notion/status", async (c) => {
  const hasToken = !!process.env.NOTION_TOKEN;
  return c.json({ 
    configured: hasToken,
    provider: "notion"
  });
});

// Fetch characters list from Notion page
importRoutes.post("/notion/characters", async (c) => {
  const body = await c.req.json();
  const { notionToken: requestToken, pageUrl } = body;
  
  if (!pageUrl) {
    return c.json({ error: "Page URL is required" }, 400);
  }
  
  try {
    const token = getNotionToken(requestToken);
    // Extract page ID from URL
    const pageId = extractPageIdFromUrl(pageUrl);
    
    // Fetch the main page to get character subpages
    const mainPage = await fetchNotionPage(pageId, token);
    
    // For now, return the main page as a character
    // In a full implementation, we'd traverse child pages
    const characters: ImportableCharacter[] = [];
    
    // Parse the main page as a character if it looks like one
    if (mainPage.title && !mainPage.title.includes("Rises and Falls")) {
      characters.push(parseCharacterFromNotionPage(mainPage));
    }
    
    return c.json({ characters });
  } catch (error) {
    console.error("Notion fetch error:", error);
    return c.json({ 
      error: error instanceof Error ? error.message : "Failed to fetch from Notion" 
    }, 500);
  }
});

// Fetch a specific character page from Notion
importRoutes.post("/notion/character", async (c) => {
  const body = await c.req.json();
  const { notionToken: requestToken, pageUrl } = body;
  
  if (!pageUrl) {
    return c.json({ error: "Page URL is required" }, 400);
  }
  
  try {
    const token = getNotionToken(requestToken);
    const pageId = extractPageIdFromUrl(pageUrl);
    const page = await fetchNotionPage(pageId, token);
    const character = parseCharacterFromNotionPage(page);
    
    return c.json({ character });
  } catch (error) {
    console.error("Notion fetch error:", error);
    return c.json({ 
      error: error instanceof Error ? error.message : "Failed to fetch from Notion" 
    }, 500);
  }
});

// Fetch locations from Notion world setting page
importRoutes.post("/notion/locations", async (c) => {
  const body = await c.req.json();
  const { notionToken: requestToken, pageUrl } = body;
  
  if (!pageUrl) {
    return c.json({ error: "Page URL is required" }, 400);
  }
  
  try {
    const token = getNotionToken(requestToken);
    const pageId = extractPageIdFromUrl(pageUrl);
    const page = await fetchNotionPage(pageId, token);
    const locations = parseLocationsFromContent(page.content || "", page.url);
    
    return c.json({ locations });
  } catch (error) {
    console.error("Notion fetch error:", error);
    return c.json({ 
      error: error instanceof Error ? error.message : "Failed to fetch from Notion" 
    }, 500);
  }
});

// Import selected characters into database
importRoutes.post("/characters/batch", async (c) => {
  const body = await c.req.json();
  const { items } = body as { items: ImportableCharacter[] };
  
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
    console.error("Batch import error:", error);
    return c.json({ 
      error: error instanceof Error ? error.message : "Failed to import" 
    }, 500);
  }
});

// Import selected locations into database
importRoutes.post("/locations/batch", async (c) => {
  const body = await c.req.json();
  const { items } = body as { items: ImportableLocation[] };
  
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
    console.error("Batch import error:", error);
    return c.json({ 
      error: error instanceof Error ? error.message : "Failed to import" 
    }, 500);
  }
});

// Helper: Extract page ID from Notion URL
function extractPageIdFromUrl(url: string): string {
  // Handle various Notion URL formats:
  // https://www.notion.so/Page-Title-abc123def456
  // https://www.notion.so/abc123def456
  // https://notion.so/workspace/Page-abc123def456
  // Just the ID: abc123def456
  
  // Remove query params
  url = url.split("?")[0];
  
  // If it's already just an ID (32 hex chars, with or without dashes)
  const idPattern = /^[a-f0-9]{32}$/i;
  const idWithDashesPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  
  const cleanUrl = url.replace(/-/g, "");
  if (idPattern.test(cleanUrl)) {
    return cleanUrl;
  }
  
  // Extract from URL - the ID is the last 32 hex characters
  const match = url.match(/([a-f0-9]{32})$/i) || 
                url.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  
  if (match) {
    return match[1].replace(/-/g, "");
  }
  
  throw new Error("Could not extract page ID from URL");
}

export default importRoutes;

