import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { characters, locations } from "../db/schema";

const importRoutes = new Hono();

// Configuration
const CLAUDE_MODEL = "claude-opus-4-6";

// ========================================
// Background Job Store
// ========================================

type ExploreJobStatus = "running" | "completed" | "failed";

interface ExploreJobProgress {
  pagesScanned: number;
  currentPage: string;
  charactersFound: number;
  locationsFound: number;
  llmClassifications: number;
}

interface ExploreJob {
  id: string;
  status: ExploreJobStatus;
  progress: ExploreJobProgress;
  result?: ExplorationResult & { characters: ImportableCharacter[]; locations: ImportableLocation[] };
  error?: string;
  startedAt: number;
  completedAt?: number;
}

const exploreJobs = new Map<string, ExploreJob>();

const JOB_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_CONCURRENT_JOBS = 2;

function cleanupOldJobs() {
  const now = Date.now();
  for (const [id, job] of exploreJobs) {
    if (job.completedAt && now - job.completedAt > JOB_TTL_MS) {
      exploreJobs.delete(id);
    }
  }
}

function countRunningJobs(): number {
  let count = 0;
  for (const job of exploreJobs.values()) {
    if (job.status === "running") count++;
  }
  return count;
}

setInterval(cleanupOldJobs, 60_000);

function generateJobId(): string {
  return `explore-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

// Types for import operations
interface NotionPage {
  id: string;
  title: string;
  url: string;
  content?: string;
}

interface NotionPageWithChildren extends NotionPage {
  childPages: { id: string; title: string }[];
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

interface ExploredPage {
  id: string;
  title: string;
  depth: number;
  classification: string;
  confidence: number;
  childCount: number;
  charactersExtracted: number;
  locationsExtracted: number;
  discoveredVia?: string; // How was this page discovered (child_page, link_to_page, database, mention)
}

interface ExplorationResult {
  characters: ImportableCharacter[];
  locations: ImportableLocation[];
  exploration: {
    pagesScanned: number;
    characterPagesFound: string[];
    locationPagesFound: string[];
    llmClassifications: number;
    allPages: ExploredPage[];
  };
}

// LLM classification result
interface PageClassification {
  type: "characters" | "locations" | "character_list" | "location_list" | "mixed" | "other";
  confidence: number;
  reasoning: string;
  extractedItems?: {
    characters?: { name: string; blurb: string }[];
    locations?: { name: string; blurb: string }[];
  };
}

const CLAUDE_TIMEOUT_MS = 60_000;
const NOTION_TIMEOUT_MS = 30_000;

// Notion API configuration
const NOTION_API_BASE = "https://api.notion.com/v1";

// Get API key from environment
function getAnthropicKey(): string | null {
  return process.env.ANTHROPIC_API_KEY || null;
}

// Claude API call for page classification
async function callClaude(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const apiKey = getAnthropicKey();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
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
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error(`Claude API timed out after ${CLAUDE_TIMEOUT_MS / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const textContent = data.content?.find((c: any) => c.type === "text");
  return textContent?.text || "";
}

// System prompt for page classification
const CLASSIFICATION_SYSTEM_PROMPT = `You are an assistant that analyzes Notion page content to identify what type of content it contains for a storytelling/worldbuilding project.

Analyze the page title and content to determine if the page contains:
- "character_list": A list/index page containing multiple character entries or links to character pages
- "characters": Individual character descriptions (1-3 characters described in detail)
- "location_list": A list/index page containing multiple location entries or links to location pages  
- "locations": Individual location descriptions (1-3 places described in detail)
- "mixed": Contains both characters AND locations
- "other": General content, plot, themes, worldbuilding notes, etc. that isn't specifically characters or locations

For character_list or characters pages, also extract the characters if present.
For location_list or locations pages, also extract the locations if present.
For mixed pages, extract both.

IMPORTANT: When writing a "blurb" for each extracted character or location, synthesize the actual page content into a rich, informative summary of 3-4 sentences. The blurb should capture who the character is (role, personality, motivations, key relationships) or what the location is (atmosphere, significance, notable features). Use details from the page content — don't just restate the title.

Output ONLY valid JSON in this exact format:
{
  "type": "character_list|characters|location_list|locations|mixed|other",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of classification",
  "extractedItems": {
    "characters": [{"name": "Name", "blurb": "3-4 sentence description drawn from page content"}],
    "locations": [{"name": "Name", "blurb": "3-4 sentence description drawn from page content"}]
  }
}

Only include extractedItems if you found actual characters or locations to extract.
For list pages, try to extract basic info from the listings.
Be generous in identifying characters (people, NPCs, protagonists) and locations (places, settings, areas).`;

// Classify a page using LLM
async function classifyPageWithLLM(page: NotionPageWithChildren): Promise<PageClassification> {
  const childPageList = page.childPages.length > 0 
    ? `\n\nChild pages:\n${page.childPages.map(c => `- ${c.title}`).join("\n")}`
    : "";
  
  const contentPreview = page.content 
    ? page.content.substring(0, 4000) 
    : "(No text content)";
  
  const userPrompt = `Analyze this Notion page:

Title: ${page.title}

Content:
${contentPreview}${childPageList}

Classify what type of content this page contains and extract any characters or locations.`;

  try {
    const response = await callClaude(CLASSIFICATION_SYSTEM_PROMPT, userPrompt);
    
    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[LLM] Could not parse classification response:", response);
      return { type: "other", confidence: 0, reasoning: "Failed to parse LLM response" };
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      type: parsed.type || "other",
      confidence: parsed.confidence || 0.5,
      reasoning: parsed.reasoning || "",
      extractedItems: parsed.extractedItems,
    };
  } catch (err) {
    console.error("[LLM] Classification error:", err);
    return { type: "other", confidence: 0, reasoning: `Error: ${err}` };
  }
}

// Check if LLM is available
function hasLLM(): boolean {
  return !!getAnthropicKey();
}

// Fallback pattern-based classification when LLM is not available
const CHARACTER_PAGE_PATTERNS = [
  /character/i, /cast/i, /people/i, /protagonist/i, /antagonist/i,
  /npc/i, /person/i, /roster/i, /dramatis\s*personae/i, /who/i,
];

const LOCATION_PAGE_PATTERNS = [
  /location/i, /place/i, /world/i, /setting/i, /geography/i,
  /map/i, /area/i, /region/i, /city/i, /town/i, /environment/i,
];

function fallbackClassifyPage(title: string): "characters" | "locations" | "other" {
  if (CHARACTER_PAGE_PATTERNS.some(p => p.test(title))) return "characters";
  if (LOCATION_PAGE_PATTERNS.some(p => p.test(title))) return "locations";
  return "other";
}

// Get Notion token from environment or request
function getNotionToken(requestToken?: string): string {
  const token = requestToken || process.env.NOTION_TOKEN;
  if (!token) {
    throw new Error("NOTION_TOKEN not configured. Add it to backend/.env file or provide in request.");
  }
  return token;
}

async function notionRequest(endpoint: string, token: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NOTION_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${NOTION_API_BASE}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error(`Notion API timed out after ${NOTION_TIMEOUT_MS / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Notion API error: ${response.status}`);
  }

  return response.json();
}

// Fetch all blocks from a page (handles pagination)
async function fetchAllBlocks(pageId: string, token: string): Promise<any[]> {
  const allBlocks: any[] = [];
  let cursor: string | undefined;
  
  do {
    const endpoint = cursor 
      ? `/blocks/${pageId}/children?page_size=100&start_cursor=${cursor}`
      : `/blocks/${pageId}/children?page_size=100`;
    
    const response = await notionRequest(endpoint, token);
    allBlocks.push(...response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);
  
  return allBlocks;
}

// Recursively fetch all blocks including nested children
async function fetchAllBlocksRecursive(pageId: string, token: string): Promise<any[]> {
  const topLevelBlocks = await fetchAllBlocks(pageId, token);
  const allBlocks: any[] = [];
  
  for (const block of topLevelBlocks) {
    allBlocks.push(block);
    
    // If block has children, fetch them recursively
    if (block.has_children && block.type !== "child_page" && block.type !== "child_database") {
      try {
        const childBlocks = await fetchAllBlocksRecursive(block.id, token);
        allBlocks.push(...childBlocks);
      } catch (err) {
        console.error(`[Notion] Failed to fetch children of block ${block.id}:`, err);
      }
    }
  }
  
  return allBlocks;
}

// Query all pages from a database
async function fetchDatabasePages(databaseId: string, token: string): Promise<{ id: string; title: string }[]> {
  const pages: { id: string; title: string }[] = [];
  let cursor: string | undefined;
  
  try {
    do {
      const endpoint = `/databases/${databaseId}/query`;
      const body: any = { page_size: 100 };
      if (cursor) body.start_cursor = cursor;
      
      const dbController = new AbortController();
      const dbTimeout = setTimeout(() => dbController.abort(), NOTION_TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(`${NOTION_API_BASE}${endpoint}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: dbController.signal,
        });
      } catch (err: any) {
        if (err.name === "AbortError") {
          console.error(`[Notion] Database query timed out after ${NOTION_TIMEOUT_MS / 1000}s`);
        }
        break;
      } finally {
        clearTimeout(dbTimeout);
      }
      
      if (!response.ok) {
        console.error(`[Notion] Database query failed: ${response.status}`);
        break;
      }
      
      const data = await response.json();
      
      for (const page of data.results) {
        // Extract title from database page
        let title = "Untitled";
        for (const key of Object.keys(page.properties || {})) {
          const prop = page.properties[key];
          if (prop.type === "title" && prop.title?.[0]?.plain_text) {
            title = prop.title[0].plain_text;
            break;
          }
        }
        pages.push({ id: page.id, title });
      }
      
      cursor = data.has_more ? data.next_cursor : undefined;
    } while (cursor);
  } catch (err) {
    console.error(`[Notion] Failed to query database ${databaseId}:`, err);
  }
  
  return pages;
}

// Fetch and parse a Notion page with child page info
async function fetchNotionPageWithChildren(pageId: string, token: string): Promise<NotionPageWithChildren> {
  // Get page properties
  const page = await notionRequest(`/pages/${pageId}`, token);
  
  // Get page content (blocks) - recursively to find nested pages
  const blocks = await fetchAllBlocksRecursive(pageId, token);
  
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
  
  // Extract text content and child pages from blocks
  const textParts: string[] = [];
  const childPages: { id: string; title: string }[] = [];
  const seenPageIds = new Set<string>();
  
  console.log(`[Notion] Processing ${blocks.length} blocks for page "${title}"`);
  
  for (const block of blocks) {
    const blockType = block.type;
    const blockContent = block[blockType];
    
    // Log all block types for debugging
    if (blockType !== "paragraph" && blockType !== "heading_1" && blockType !== "heading_2" && blockType !== "heading_3") {
      console.log(`[Notion] Block type: ${blockType}, has_children: ${block.has_children}`);
    }
    
    if (blockContent?.rich_text) {
      const text = blockContent.rich_text.map((t: any) => t.plain_text).join("");
      if (text.trim()) {
        textParts.push(text);
      }
      
      // Check for page mentions in rich_text
      for (const textItem of blockContent.rich_text) {
        if (textItem.type === "mention" && textItem.mention?.type === "page") {
          const mentionedPageId = textItem.mention.page.id;
          if (!seenPageIds.has(mentionedPageId)) {
            seenPageIds.add(mentionedPageId);
            childPages.push({
              id: mentionedPageId,
              title: textItem.plain_text || "Mentioned Page",
            });
            console.log(`[Notion] Found page mention: "${textItem.plain_text}" (${mentionedPageId})`);
          }
        }
      }
    }
    
    // Collect child pages
    if (blockType === "child_page") {
      if (!seenPageIds.has(block.id)) {
        seenPageIds.add(block.id);
        childPages.push({
          id: block.id,
          title: blockContent.title || "Untitled",
        });
        console.log(`[Notion] Found child_page: "${blockContent.title}" (${block.id})`);
      }
    }
    
    // Handle link_to_page blocks
    if (blockType === "link_to_page") {
      const linkedPageId = blockContent.page_id || blockContent.database_id;
      if (linkedPageId && !seenPageIds.has(linkedPageId)) {
        seenPageIds.add(linkedPageId);
        // We need to fetch the page to get its title
        try {
          const linkedPage = await notionRequest(`/pages/${linkedPageId}`, token);
          let linkedTitle = "Linked Page";
          for (const key of Object.keys(linkedPage.properties || {})) {
            const prop = linkedPage.properties[key];
            if (prop.type === "title" && prop.title?.[0]?.plain_text) {
              linkedTitle = prop.title[0].plain_text;
              break;
            }
          }
          childPages.push({
            id: linkedPageId,
            title: linkedTitle,
          });
          console.log(`[Notion] Found link_to_page: "${linkedTitle}" (${linkedPageId})`);
        } catch (err) {
          console.error(`[Notion] Failed to fetch linked page ${linkedPageId}:`, err);
        }
      }
    }
    
    // Handle child databases - query to get all pages inside
    if (blockType === "child_database") {
      console.log(`[Notion] Found child_database: "${blockContent.title}" (${block.id})`);
      const dbPages = await fetchDatabasePages(block.id, token);
      for (const dbPage of dbPages) {
        if (!seenPageIds.has(dbPage.id)) {
          seenPageIds.add(dbPage.id);
          childPages.push(dbPage);
          console.log(`[Notion] Found database page: "${dbPage.title}" (${dbPage.id})`);
        }
      }
    }
    
    // Handle linked_database (inline database view)
    if (blockType === "linked_database") {
      const dbId = blockContent.database_id;
      if (dbId) {
        console.log(`[Notion] Found linked_database: ${dbId}`);
        const dbPages = await fetchDatabasePages(dbId, token);
        for (const dbPage of dbPages) {
          if (!seenPageIds.has(dbPage.id)) {
            seenPageIds.add(dbPage.id);
            childPages.push(dbPage);
            console.log(`[Notion] Found linked database page: "${dbPage.title}" (${dbPage.id})`);
          }
        }
      }
    }
    
    // Handle synced_block - might contain pages
    if (blockType === "synced_block" && blockContent.synced_from?.block_id) {
      try {
        const syncedBlocks = await fetchAllBlocks(blockContent.synced_from.block_id, token);
        for (const syncedBlock of syncedBlocks) {
          if (syncedBlock.type === "child_page" && !seenPageIds.has(syncedBlock.id)) {
            seenPageIds.add(syncedBlock.id);
            childPages.push({
              id: syncedBlock.id,
              title: syncedBlock.child_page?.title || "Synced Page",
            });
          }
        }
      } catch (err) {
        console.error(`[Notion] Failed to fetch synced block:`, err);
      }
    }
  }
  
  console.log(`[Notion] Found ${childPages.length} child pages for "${title}"`);
  
  return {
    id: pageId,
    title,
    url: page.url,
    content: textParts.join("\n"),
    childPages,
  };
}

// Fetch and parse a Notion page
async function fetchNotionPage(pageId: string, token: string): Promise<NotionPage> {
  const pageWithChildren = await fetchNotionPageWithChildren(pageId, token);
  return {
    id: pageWithChildren.id,
    title: pageWithChildren.title,
    url: pageWithChildren.url,
    content: pageWithChildren.content,
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

// Run async tasks with limited concurrency
async function parallelMap<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

const CONCURRENCY = 3;

// Recursively explore a Notion page tree to find characters and locations using LLM
async function exploreNotionPages(
  pageId: string,
  token: string,
  maxDepth: number = 3,
  currentDepth: number = 0,
  visited: Set<string> = new Set(),
  job?: ExploreJob
): Promise<ExplorationResult> {
  const result: ExplorationResult = {
    characters: [],
    locations: [],
    exploration: {
      pagesScanned: 0,
      characterPagesFound: [],
      locationPagesFound: [],
      llmClassifications: 0,
      allPages: [],
    },
  };

  if (currentDepth > maxDepth || visited.has(pageId)) {
    return result;
  }
  visited.add(pageId);

  const useLLM = hasLLM();

  // Increment job progress directly — never overwrite with local counts
  function tickJob(field: "pagesScanned" | "charactersFound" | "locationsFound" | "llmClassifications", delta = 1) {
    if (!job) return;
    (job.progress[field] as number) += delta;
  }
  function setCurrentPage(name: string) {
    if (job) job.progress.currentPage = name;
  }

  try {
    const page = await fetchNotionPageWithChildren(pageId, token);
    result.exploration.pagesScanned++;
    tickJob("pagesScanned");
    setCurrentPage(page.title);

    console.log(`[Explore] Depth ${currentDepth}: "${page.title}" - ${page.childPages.length} children (LLM: ${useLLM})`);

    const exploredPage: ExploredPage = {
      id: pageId,
      title: page.title,
      depth: currentDepth,
      classification: "pending",
      confidence: 0,
      childCount: page.childPages.length,
      charactersExtracted: 0,
      locationsExtracted: 0,
    };

    if (useLLM) {
      const classification = await classifyPageWithLLM(page);
      result.exploration.llmClassifications++;
      tickJob("llmClassifications");

      exploredPage.classification = classification.type;
      exploredPage.confidence = classification.confidence;

      console.log(`[Explore] LLM classified "${page.title}" as ${classification.type} (${Math.round(classification.confidence * 100)}%)`);

      // Extract characters from this page's classification
      if (classification.type === "character_list" || classification.type === "characters" || classification.type === "mixed") {
        result.exploration.characterPagesFound.push(page.title);

        if (classification.extractedItems?.characters) {
          for (const char of classification.extractedItems.characters) {
            result.characters.push({
              id: `llm-${page.id}-${result.characters.length}`,
              name: char.name,
              blurb: char.blurb,
              source: "notion",
              sourceUrl: page.url,
            });
            exploredPage.charactersExtracted++;
            tickJob("charactersFound");
          }
        }

        // For list pages, classify children in parallel
        if (classification.type === "character_list") {
          const unvisitedChildren = page.childPages.filter(c => !visited.has(c.id.replace(/-/g, "")));
          unvisitedChildren.forEach(c => visited.add(c.id.replace(/-/g, "")));

          await parallelMap(unvisitedChildren, async (child) => {
            try {
              const childPage = await fetchNotionPageWithChildren(child.id, token);
              result.exploration.pagesScanned++;
              tickJob("pagesScanned");
              setCurrentPage(childPage.title);

              const childClassification = await classifyPageWithLLM(childPage);
              result.exploration.llmClassifications++;
              tickJob("llmClassifications");

              const childExploredPage: ExploredPage = {
                id: child.id,
                title: childPage.title,
                depth: currentDepth + 1,
                classification: childClassification.type,
                confidence: childClassification.confidence,
                childCount: childPage.childPages.length,
                charactersExtracted: 0,
                locationsExtracted: 0,
              };

              if (childClassification.type === "characters" || childClassification.type === "mixed") {
                if (childClassification.extractedItems?.characters) {
                  for (const char of childClassification.extractedItems.characters) {
                    result.characters.push({
                      id: `llm-${childPage.id}-${result.characters.length}`,
                      name: char.name,
                      blurb: char.blurb,
                      source: "notion",
                      sourceUrl: childPage.url,
                    });
                    childExploredPage.charactersExtracted++;
                    tickJob("charactersFound");
                  }
                }
              }

              result.exploration.allPages.push(childExploredPage);
            } catch (err) {
              console.error(`[Explore] Failed to process child page ${child.title}:`, err);
            }
          }, CONCURRENCY);
        }
      }

      // Extract locations from this page's classification
      if (classification.type === "location_list" || classification.type === "locations" || classification.type === "mixed") {
        result.exploration.locationPagesFound.push(page.title);

        if (classification.extractedItems?.locations) {
          for (const loc of classification.extractedItems.locations) {
            result.locations.push({
              id: `llm-${page.id}-${result.locations.length}`,
              name: loc.name,
              blurb: loc.blurb,
              source: "notion",
              sourceUrl: page.url,
            });
            exploredPage.locationsExtracted++;
            tickJob("locationsFound");
          }
        }

        // For list pages, classify children in parallel
        if (classification.type === "location_list") {
          const unvisitedChildren = page.childPages.filter(c => !visited.has(c.id.replace(/-/g, "")));
          unvisitedChildren.forEach(c => visited.add(c.id.replace(/-/g, "")));

          await parallelMap(unvisitedChildren, async (child) => {
            try {
              const childPage = await fetchNotionPageWithChildren(child.id, token);
              result.exploration.pagesScanned++;
              tickJob("pagesScanned");
              setCurrentPage(childPage.title);

              const childClassification = await classifyPageWithLLM(childPage);
              result.exploration.llmClassifications++;
              tickJob("llmClassifications");

              const childExploredPage: ExploredPage = {
                id: child.id,
                title: childPage.title,
                depth: currentDepth + 1,
                classification: childClassification.type,
                confidence: childClassification.confidence,
                childCount: childPage.childPages.length,
                charactersExtracted: 0,
                locationsExtracted: 0,
              };

              if (childClassification.type === "locations" || childClassification.type === "mixed") {
                if (childClassification.extractedItems?.locations) {
                  for (const loc of childClassification.extractedItems.locations) {
                    result.locations.push({
                      id: `llm-${childPage.id}-${result.locations.length}`,
                      name: loc.name,
                      blurb: loc.blurb,
                      source: "notion",
                      sourceUrl: childPage.url,
                    });
                    childExploredPage.locationsExtracted++;
                    tickJob("locationsFound");
                  }
                }
              }

              result.exploration.allPages.push(childExploredPage);
            } catch (err) {
              console.error(`[Explore] Failed to process child page ${child.title}:`, err);
            }
          }, CONCURRENCY);
        }
      }

      result.exploration.allPages.push(exploredPage);

      // Recurse into unvisited children in parallel
      const unvisitedRecurse = page.childPages
        .map(c => ({ ...c, cleanId: c.id.replace(/-/g, "") }))
        .filter(c => !visited.has(c.cleanId));

      await parallelMap(unvisitedRecurse, async (child) => {
        const childResult = await exploreNotionPages(
          child.cleanId, token, maxDepth, currentDepth + 1, visited, job
        );
        result.characters.push(...childResult.characters);
        result.locations.push(...childResult.locations);
        result.exploration.pagesScanned += childResult.exploration.pagesScanned;
        result.exploration.characterPagesFound.push(...childResult.exploration.characterPagesFound);
        result.exploration.locationPagesFound.push(...childResult.exploration.locationPagesFound);
        result.exploration.llmClassifications += childResult.exploration.llmClassifications;
        result.exploration.allPages.push(...childResult.exploration.allPages);
      }, CONCURRENCY);

    } else {
      // Fallback: pattern-based classification
      const classification = fallbackClassifyPage(page.title);
      exploredPage.classification = classification;
      exploredPage.confidence = 1;

      if (classification === "characters") {
        result.exploration.characterPagesFound.push(page.title);
        await parallelMap(page.childPages, async (child) => {
          try {
            const childPage = await fetchNotionPage(child.id, token);
            result.exploration.pagesScanned++;
            tickJob("pagesScanned");
            setCurrentPage(childPage.title);
            const character = parseCharacterFromNotionPage(childPage);
            result.characters.push(character);
            exploredPage.charactersExtracted++;
            tickJob("charactersFound");
          } catch (err) {
            console.error(`[Explore] Failed to fetch character page:`, err);
          }
        }, CONCURRENCY);
      } else if (classification === "locations") {
        result.exploration.locationPagesFound.push(page.title);
        await parallelMap(page.childPages, async (child) => {
          try {
            const childPage = await fetchNotionPage(child.id, token);
            result.exploration.pagesScanned++;
            tickJob("pagesScanned");
            setCurrentPage(childPage.title);
            const location = parseLocationFromNotionPage(childPage);
            result.locations.push(location);
            exploredPage.locationsExtracted++;
            tickJob("locationsFound");
          } catch (err) {
            console.error(`[Explore] Failed to fetch location page:`, err);
          }
        }, CONCURRENCY);
      }

      result.exploration.allPages.push(exploredPage);

      // Recurse for unvisited children in parallel
      const unvisitedRecurse = page.childPages
        .map(c => ({ ...c, cleanId: c.id.replace(/-/g, "") }))
        .filter(c => !visited.has(c.cleanId));

      await parallelMap(unvisitedRecurse, async (child) => {
        const childResult = await exploreNotionPages(
          child.cleanId, token, maxDepth, currentDepth + 1, visited, job
        );
        result.characters.push(...childResult.characters);
        result.locations.push(...childResult.locations);
        result.exploration.pagesScanned += childResult.exploration.pagesScanned;
        result.exploration.characterPagesFound.push(...childResult.exploration.characterPagesFound);
        result.exploration.locationPagesFound.push(...childResult.exploration.locationPagesFound);
        result.exploration.llmClassifications += childResult.exploration.llmClassifications;
        result.exploration.allPages.push(...childResult.exploration.allPages);
      }, CONCURRENCY);
    }

  } catch (err) {
    console.error(`[Explore] Failed to fetch page ${pageId}:`, err);
  }

  return result;
}

// Build a 3-4 sentence blurb from page content lines
function buildBlurbFromContent(content: string): string {
  const lines = content.split("\n").filter(l => l.trim());
  const meaningfulLines = lines.filter(l => 
    !l.startsWith("Status:") && 
    !l.startsWith("[Page:") &&
    !l.startsWith("[Database:") &&
    l.length > 15
  );
  
  if (meaningfulLines.length === 0) return "";
  
  // Collect sentences from meaningful lines until we have 3-4
  const sentences: string[] = [];
  for (const line of meaningfulLines) {
    const lineSentences = line.match(/[^.!?]+[.!?]+/g) || [line];
    for (const s of lineSentences) {
      const trimmed = s.trim();
      if (trimmed.length > 10) {
        sentences.push(trimmed);
      }
      if (sentences.length >= 4) break;
    }
    if (sentences.length >= 4) break;
  }
  
  if (sentences.length === 0) {
    return meaningfulLines[0].substring(0, 300);
  }
  
  return sentences.join(" ").substring(0, 600);
}

// Parse character data from Notion page
function parseCharacterFromNotionPage(page: NotionPage): ImportableCharacter {
  let name = page.title
    .replace(/^[👌🚧📝✅❌🔥💡🎯🎭👤👥📍🏠🌍🏢🏭]\s*/g, "")
    .replace(/\s*-\s*.+$/, "")
    .trim();
  
  const blurb = page.content ? buildBlurbFromContent(page.content) : "";
  
  return {
    id: page.id,
    name,
    blurb,
    source: "notion",
    sourceUrl: page.url,
  };
}

// Parse location data from a single Notion page
function parseLocationFromNotionPage(page: NotionPage): ImportableLocation {
  let name = page.title
    .replace(/^[👌🚧📝✅❌🔥💡🎯📍🏠🌍🏢🏭🗺️]\s*/g, "")
    .replace(/\s*-\s*.+$/, "")
    .trim();
  
  const blurb = page.content ? buildBlurbFromContent(page.content) : "";
  
  return {
    id: page.id,
    name,
    blurb,
    source: "notion",
    sourceUrl: page.url,
  };
}

// Parse location data from content (legacy pattern-based extraction)
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

// Start exploring a Notion page tree (returns job ID immediately)
importRoutes.post("/notion/explore", async (c) => {
  const body = await c.req.json();
  const { notionToken: requestToken, pageUrl, maxDepth: rawMaxDepth = 3 } = body;
  const maxDepth = Math.min(Math.max(1, Math.floor(Number(rawMaxDepth) || 3)), 5);
  
  if (!pageUrl) {
    return c.json({ error: "Page URL is required" }, 400);
  }
  
  try {
    const token = getNotionToken(requestToken);
    const pageId = extractPageIdFromUrl(pageUrl);
    
    cleanupOldJobs();

    if (countRunningJobs() >= MAX_CONCURRENT_JOBS) {
      return c.json({ error: `Too many explorations running (max ${MAX_CONCURRENT_JOBS}). Please wait for the current one to finish.` }, 429);
    }
    
    const jobId = generateJobId();
    const job: ExploreJob = {
      id: jobId,
      status: "running",
      progress: {
        pagesScanned: 0,
        currentPage: "",
        charactersFound: 0,
        locationsFound: 0,
        llmClassifications: 0,
      },
      startedAt: Date.now(),
    };
    exploreJobs.set(jobId, job);
    
    console.log(`[Explore] Job ${jobId}: Starting exploration from page ${pageId} with maxDepth ${maxDepth}`);
    
    // Run exploration in the background (don't await)
    exploreNotionPages(pageId, token, maxDepth, 0, new Set(), job)
      .then((result) => {
        const uniqueCharacters = deduplicateByName(result.characters);
        const uniqueLocations = deduplicateByName(result.locations);
        
        job.status = "completed";
        job.completedAt = Date.now();
        job.result = {
          characters: uniqueCharacters,
          locations: uniqueLocations,
          exploration: result.exploration,
        };
        job.progress.charactersFound = uniqueCharacters.length;
        job.progress.locationsFound = uniqueLocations.length;
        job.progress.pagesScanned = result.exploration.pagesScanned;
        
        console.log(`[Explore] Job ${jobId}: Complete — ${uniqueCharacters.length} characters, ${uniqueLocations.length} locations`);
      })
      .catch((error) => {
        job.status = "failed";
        job.completedAt = Date.now();
        job.error = error instanceof Error ? error.message : "Unknown error";
        console.error(`[Explore] Job ${jobId}: Failed —`, error);
      });
    
    return c.json({ jobId });
  } catch (error) {
    console.error("Notion explore error:", error);
    return c.json({ 
      error: error instanceof Error ? error.message : "Failed to start exploration" 
    }, 500);
  }
});

// Poll exploration job status
importRoutes.get("/notion/explore/:jobId", async (c) => {
  const jobId = c.req.param("jobId");
  const job = exploreJobs.get(jobId);
  
  if (!job) {
    return c.json({ error: "Job not found" }, 404);
  }
  
  const response: any = {
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    elapsedMs: (job.completedAt || Date.now()) - job.startedAt,
  };
  
  if (job.status === "completed" && job.result) {
    response.result = job.result;
  }
  
  if (job.status === "failed") {
    response.error = job.error;
  }
  
  return c.json(response);
});

// Preview page structure without full extraction
importRoutes.post("/notion/preview", async (c) => {
  const body = await c.req.json();
  const { notionToken: requestToken, pageUrl } = body;
  
  if (!pageUrl) {
    return c.json({ error: "Page URL is required" }, 400);
  }
  
  try {
    const token = getNotionToken(requestToken);
    const pageId = extractPageIdFromUrl(pageUrl);
    const page = await fetchNotionPageWithChildren(pageId, token);
    
    const useLLM = hasLLM();
    let pageClassification: PageClassification | null = null;
    
    // Use LLM to classify the main page if available
    if (useLLM) {
      pageClassification = await classifyPageWithLLM(page);
    }
    
    // Classify children (use fallback patterns if no LLM)
    const children = page.childPages.map(child => ({
      id: child.id,
      title: child.title,
      type: fallbackClassifyPage(child.title),
    }));
    
    return c.json({
      title: page.title,
      url: page.url,
      classification: pageClassification,
      children,
      hints: {
        characterContainers: children.filter(c => c.type === "characters").map(c => c.title),
        locationContainers: children.filter(c => c.type === "locations").map(c => c.title),
      },
      llmEnabled: useLLM,
    });
  } catch (error) {
    console.error("Notion preview error:", error);
    return c.json({ 
      error: error instanceof Error ? error.message : "Failed to preview Notion page" 
    }, 500);
  }
});

// Helper to deduplicate items by name
function deduplicateByName<T extends { name: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = item.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Import selected characters into database (upsert: update existing on conflict)
importRoutes.post("/characters/batch", async (c) => {
  const body = await c.req.json();
  const { items } = body as { items: ImportableCharacter[] };
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    return c.json({ error: "No items to import" }, 400);
  }
  
  try {
    const imported: { name: string; id: number; updated: boolean }[] = [];
    const failed: { name: string; reason: string }[] = [];
    
    for (const item of items) {
      try {
        const result = db
          .insert(characters)
          .values({ name: item.name, blurb: item.blurb })
          .onConflictDoUpdate({
            target: characters.name,
            set: {
              blurb: item.blurb,
              updatedAt: sql`(datetime('now'))`,
            },
          })
          .returning()
          .get();
        
        const wasUpdated = result.createdAt !== result.updatedAt;
        imported.push({ name: result.name, id: result.id, updated: wasUpdated });
      } catch (err: any) {
        failed.push({ name: item.name, reason: err.message || "Unknown error" });
      }
    }
    
    return c.json({ imported, failed });
  } catch (error) {
    console.error("Batch import error:", error);
    return c.json({ 
      error: error instanceof Error ? error.message : "Failed to import" 
    }, 500);
  }
});

// Import selected locations into database (upsert: update existing on conflict)
importRoutes.post("/locations/batch", async (c) => {
  const body = await c.req.json();
  const { items } = body as { items: ImportableLocation[] };
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    return c.json({ error: "No items to import" }, 400);
  }
  
  try {
    const imported: { name: string; id: number; updated: boolean }[] = [];
    const failed: { name: string; reason: string }[] = [];
    
    for (const item of items) {
      try {
        const result = db
          .insert(locations)
          .values({ name: item.name, blurb: item.blurb })
          .onConflictDoUpdate({
            target: locations.name,
            set: {
              blurb: item.blurb,
              updatedAt: sql`(datetime('now'))`,
            },
          })
          .returning()
          .get();
        
        const wasUpdated = result.createdAt !== result.updatedAt;
        imported.push({ name: result.name, id: result.id, updated: wasUpdated });
      } catch (err: any) {
        failed.push({ name: item.name, reason: err.message || "Unknown error" });
      }
    }
    
    return c.json({ imported, failed });
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

