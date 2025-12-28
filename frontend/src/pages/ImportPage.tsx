import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  Input,
  Text,
  Textarea,
  VStack,
  HStack,
  Spinner,
  IconButton,
  Badge,
  Checkbox,
  Tabs,
} from "@chakra-ui/react";
import { Field } from "../components/ui/field";
import { toaster } from "../components/ui/toaster";
import {
  FiDownload,
  FiCheck,
  FiZap,
  FiDatabase,
  FiUser,
  FiMapPin,
  FiEdit2,
  FiAlertCircle,
  FiCheckCircle,
  FiSearch,
  FiLayers,
} from "react-icons/fi";
import {
  importApi,
  generateApi,
  type ImportableItem,
  type ImportResult,
  type ExplorationResult,
  type ExploredPage,
} from "../api/client";

type EntityType = "characters" | "locations" | "explore";
type SourceType = "notion" | "generate";

// Local storage keys for settings
const STORAGE_KEYS = {
  notionPageUrl: "rises-falls-notion-page-url",
};

export function ImportPage() {
  // Tab state
  const [entityType, setEntityType] = useState<EntityType>("characters");
  const [sourceType, setSourceType] = useState<SourceType>("generate");

  // API status
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [aiModel, setAiModel] = useState<string>("");
  const [notionConfigured, setNotionConfigured] = useState<boolean | null>(null);

  // Settings (persisted)
  const [notionPageUrl, setNotionPageUrl] = useState(() =>
    localStorage.getItem(STORAGE_KEYS.notionPageUrl) || ""
  );

  // Generation state
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(3);

  // Preview state
  const [previewItems, setPreviewItems] = useState<ImportableItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBlurb, setEditBlurb] = useState("");

  // Exploration state
  const [explorationResult, setExplorationResult] = useState<ExplorationResult | null>(null);
  const [exploreDepth, setExploreDepth] = useState(3);
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<Set<string>>(new Set());
  const [selectedLocationIds, setSelectedLocationIds] = useState<Set<string>>(new Set());

  // Loading states
  const [fetching, setFetching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importingType, setImportingType] = useState<"characters" | "locations" | null>(null);

  // Debug panel state
  const [showAllPages, setShowAllPages] = useState(true);

  // Check API configurations on mount
  useEffect(() => {
    generateApi.status()
      .then((status) => {
        setAiConfigured(status.configured);
        setAiModel(status.model);
      })
      .catch(() => {
        setAiConfigured(false);
      });
    
    importApi.status()
      .then((status) => {
        setNotionConfigured(status.configured);
      })
      .catch(() => {
        setNotionConfigured(false);
      });
  }, []);

  // Persist settings
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.notionPageUrl, notionPageUrl);
  }, [notionPageUrl]);

  // Clear preview when switching tabs
  useEffect(() => {
    setPreviewItems([]);
    setSelectedIds(new Set());
    setExplorationResult(null);
    setSelectedCharacterIds(new Set());
    setSelectedLocationIds(new Set());
  }, [entityType, sourceType]);

  // Toggle selection
  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // Select all / none
  function selectAll() {
    setSelectedIds(new Set(previewItems.map((item) => item.id)));
  }

  function selectNone() {
    setSelectedIds(new Set());
  }

  // Start editing an item
  function startEditing(item: ImportableItem) {
    setEditingItem(item.id);
    setEditName(item.name);
    setEditBlurb(item.blurb);
  }

  // Save edits
  function saveEdits() {
    if (!editingItem) return;
    setPreviewItems((prev) =>
      prev.map((item) =>
        item.id === editingItem
          ? { ...item, name: editName, blurb: editBlurb }
          : item
      )
    );
    setEditingItem(null);
  }

  // Explore Notion page tree
  async function exploreNotion() {
    if (!notionConfigured) {
      toaster.error({ 
        title: "Notion not configured",
        description: "Add NOTION_TOKEN to backend/.env file"
      });
      return;
    }
    if (!notionPageUrl) {
      toaster.error({ title: "Notion page URL is required" });
      return;
    }

    setFetching(true);
    setExplorationResult(null);
    try {
      const result = await importApi.exploreNotion(notionPageUrl, exploreDepth);
      setExplorationResult(result);
      
      // Auto-select all found items
      setSelectedCharacterIds(new Set(result.characters.map(c => c.id)));
      setSelectedLocationIds(new Set(result.locations.map(l => l.id)));

      const totalFound = result.characters.length + result.locations.length;
      if (totalFound === 0) {
        toaster.info({ 
          title: "No items found",
          description: `Scanned ${result.exploration.pagesScanned} pages`
        });
      } else {
        toaster.success({ 
          title: `Found ${result.characters.length} characters and ${result.locations.length} locations`,
          description: `Scanned ${result.exploration.pagesScanned} pages`
        });
      }
    } catch (err) {
      toaster.error({
        title: "Exploration failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setFetching(false);
    }
  }

  // Toggle selection for exploration
  function toggleCharacterSelection(id: string) {
    setSelectedCharacterIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleLocationSelection(id: string) {
    setSelectedLocationIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // Import explored characters
  async function importExploredCharacters() {
    if (!explorationResult) return;
    const selected = explorationResult.characters.filter(c => selectedCharacterIds.has(c.id));
    if (selected.length === 0) {
      toaster.error({ title: "No characters selected" });
      return;
    }

    setImportingType("characters");
    try {
      const result = await importApi.importCharacters(selected);
      
      // Remove imported items from selection
      const importedIds = new Set(result.imported.map(i => i.name));
      setSelectedCharacterIds(prev => {
        const next = new Set(prev);
        for (const char of explorationResult.characters) {
          if (importedIds.has(char.name)) {
            next.delete(char.id);
          }
        }
        return next;
      });

      if (result.imported.length > 0) {
        toaster.success({
          title: `Imported ${result.imported.length} characters`,
          description: result.imported.map(i => i.name).join(", "),
        });
      }
      if (result.skipped.length > 0) {
        toaster.info({
          title: `Skipped ${result.skipped.length} characters`,
          description: result.skipped.map(s => `${s.name}: ${s.reason}`).join(", "),
        });
      }
    } catch (err) {
      toaster.error({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setImportingType(null);
    }
  }

  // Import explored locations
  async function importExploredLocations() {
    if (!explorationResult) return;
    const selected = explorationResult.locations.filter(l => selectedLocationIds.has(l.id));
    if (selected.length === 0) {
      toaster.error({ title: "No locations selected" });
      return;
    }

    setImportingType("locations");
    try {
      const result = await importApi.importLocations(selected);
      
      // Remove imported items from selection
      const importedIds = new Set(result.imported.map(i => i.name));
      setSelectedLocationIds(prev => {
        const next = new Set(prev);
        for (const loc of explorationResult.locations) {
          if (importedIds.has(loc.name)) {
            next.delete(loc.id);
          }
        }
        return next;
      });

      if (result.imported.length > 0) {
        toaster.success({
          title: `Imported ${result.imported.length} locations`,
          description: result.imported.map(i => i.name).join(", "),
        });
      }
      if (result.skipped.length > 0) {
        toaster.info({
          title: `Skipped ${result.skipped.length} locations`,
          description: result.skipped.map(s => `${s.name}: ${s.reason}`).join(", "),
        });
      }
    } catch (err) {
      toaster.error({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setImportingType(null);
    }
  }

  // Fetch from Notion
  async function fetchFromNotion() {
    if (!notionConfigured) {
      toaster.error({ 
        title: "Notion not configured",
        description: "Add NOTION_TOKEN to backend/.env file"
      });
      return;
    }
    if (!notionPageUrl) {
      toaster.error({ title: "Notion page URL is required" });
      return;
    }

    setFetching(true);
    try {
      let items: ImportableItem[] = [];

      if (entityType === "characters") {
        const result = await importApi.fetchNotionCharacter(notionPageUrl);
        if (result.character) {
          items = [result.character];
        }
      } else if (entityType === "locations") {
        const result = await importApi.fetchNotionLocations(notionPageUrl);
        items = result.locations || [];
      }

      setPreviewItems(items);
      setSelectedIds(new Set(items.map((item) => item.id)));

      if (items.length === 0) {
        toaster.info({ title: "No items found on this page" });
      } else {
        toaster.success({ title: `Found ${items.length} ${entityType}` });
      }
    } catch (err) {
      toaster.error({
        title: "Fetch failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setFetching(false);
    }
  }

  // Generate with AI
  async function generateWithAI() {
    if (!aiConfigured) {
      toaster.error({ 
        title: "AI not configured",
        description: "Add ANTHROPIC_API_KEY to backend/.env file"
      });
      return;
    }
    if (!prompt.trim()) {
      toaster.error({ title: "Please enter a prompt" });
      return;
    }

    setFetching(true);
    try {
      let items: ImportableItem[] = [];

      if (entityType === "characters") {
        const result = await generateApi.characters(prompt, count);
        items = result.characters || [];
      } else {
        const result = await generateApi.locations(prompt, count);
        items = result.locations || [];
      }

      setPreviewItems(items);
      setSelectedIds(new Set(items.map((item) => item.id)));

      if (items.length === 0) {
        toaster.info({ title: "No items generated" });
      } else {
        toaster.success({ title: `Generated ${items.length} ${entityType}` });
      }
    } catch (err) {
      toaster.error({
        title: "Generation failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setFetching(false);
    }
  }

  // Import selected items
  async function importSelected() {
    const selected = previewItems.filter((item) => selectedIds.has(item.id));
    if (selected.length === 0) {
      toaster.error({ title: "No items selected" });
      return;
    }

    setImporting(true);
    try {
      let result: ImportResult;

      if (sourceType === "notion") {
        if (entityType === "characters") {
          result = await importApi.importCharacters(selected);
        } else {
          result = await importApi.importLocations(selected);
        }
      } else {
        if (entityType === "characters") {
          result = await generateApi.importCharacters(selected);
        } else {
          result = await generateApi.importLocations(selected);
        }
      }

      // Remove imported items from preview
      const importedIds = new Set(result.imported.map((i) => i.name));
      setPreviewItems((prev) =>
        prev.filter((item) => !importedIds.has(item.name))
      );
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const item of result.imported) {
          const previewItem = previewItems.find((p) => p.name === item.name);
          if (previewItem) next.delete(previewItem.id);
        }
        return next;
      });

      // Show results
      if (result.imported.length > 0) {
        toaster.success({
          title: `Imported ${result.imported.length} ${entityType}`,
          description: result.imported.map((i) => i.name).join(", "),
        });
      }
      if (result.skipped.length > 0) {
        toaster.info({
          title: `Skipped ${result.skipped.length} ${entityType}`,
          description: result.skipped
            .map((s) => `${s.name}: ${s.reason}`)
            .join(", "),
        });
      }
    } catch (err) {
      toaster.error({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setImporting(false);
    }
  }

  return (
    <Box>
      <Heading size="lg" color="fg.DEFAULT" mb={6}>
        Import & Generate
      </Heading>

      {/* Entity Type Tabs */}
      <HStack gap={2} mb={4}>
        <Button
          variant={entityType === "explore" ? "solid" : "outline"}
          bg={entityType === "explore" ? "teal.600" : undefined}
          color={entityType === "explore" ? "white" : "fg.DEFAULT"}
          borderColor="border.DEFAULT"
          onClick={() => setEntityType("explore")}
          size="sm"
        >
          <FiSearch /> Explore All
        </Button>
        <Button
          variant={entityType === "characters" ? "solid" : "outline"}
          bg={entityType === "characters" ? "accent.DEFAULT" : undefined}
          color={entityType === "characters" ? "fg.inverted" : "fg.DEFAULT"}
          borderColor="border.DEFAULT"
          onClick={() => setEntityType("characters")}
          size="sm"
        >
          <FiUser /> Characters
        </Button>
        <Button
          variant={entityType === "locations" ? "solid" : "outline"}
          bg={entityType === "locations" ? "accent.DEFAULT" : undefined}
          color={entityType === "locations" ? "fg.inverted" : "fg.DEFAULT"}
          borderColor="border.DEFAULT"
          onClick={() => setEntityType("locations")}
          size="sm"
        >
          <FiMapPin /> Locations
        </Button>
      </HStack>

      {/* Explore Mode */}
      {entityType === "explore" ? (
        <Grid templateColumns={{ base: "1fr", lg: "350px 1fr" }} gap={6}>
          {/* Left Panel: Exploration Settings */}
          <Card.Root
            bg="bg.panel"
            borderWidth="1px"
            borderColor="border.DEFAULT"
            shadow="sm"
          >
            <Card.Body p={4}>
              <VStack gap={4} align="stretch">
                {/* Notion Status Indicator */}
                <Box
                  p={3}
                  rounded="md"
                  bg={notionConfigured ? "green.950" : "red.950"}
                  borderWidth="1px"
                  borderColor={notionConfigured ? "green.800" : "red.800"}
                >
                  <HStack gap={2}>
                    {notionConfigured === null ? (
                      <Spinner size="sm" />
                    ) : notionConfigured ? (
                      <FiCheckCircle color="var(--chakra-colors-green-400)" />
                    ) : (
                      <FiAlertCircle color="var(--chakra-colors-red-400)" />
                    )}
                    <Box flex={1}>
                      <Text
                        fontSize="sm"
                        fontWeight="500"
                        color={notionConfigured ? "green.300" : "red.300"}
                      >
                        {notionConfigured === null
                          ? "Checking..."
                          : notionConfigured
                          ? "Notion API Connected"
                          : "Notion API Not Configured"}
                      </Text>
                      {notionConfigured === false && (
                        <Text fontSize="xs" color="red.400">
                          Add NOTION_TOKEN to backend/.env
                        </Text>
                      )}
                    </Box>
                  </HStack>
                </Box>

                <Box p={3} bg="teal.950" rounded="md" borderWidth="1px" borderColor="teal.800">
                  <HStack gap={2} mb={2}>
                    <FiLayers color="var(--chakra-colors-teal-400)" />
                    <Text fontSize="sm" fontWeight="500" color="teal.300">
                      AI-Powered Exploration
                    </Text>
                  </HStack>
                  <Text fontSize="xs" color="teal.200">
                    Uses Claude to analyze each page's content and determine if it contains characters, locations, or other content. Automatically extracts relevant items from the content.
                  </Text>
                </Box>

                <Field label="Root Page URL">
                  <Input
                    value={notionPageUrl}
                    onChange={(e) => setNotionPageUrl(e.target.value)}
                    placeholder="https://notion.so/your-project-root..."
                    bg="bg.subtle"
                    borderColor="border.DEFAULT"
                    fontSize="sm"
                  />
                </Field>

                <Field label="Scan Depth">
                  <HStack>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Button
                        key={n}
                        size="xs"
                        variant={exploreDepth === n ? "solid" : "outline"}
                        bg={exploreDepth === n ? "teal.600" : undefined}
                        color={exploreDepth === n ? "white" : "fg.DEFAULT"}
                        borderColor="border.DEFAULT"
                        onClick={() => setExploreDepth(n)}
                      >
                        {n}
                      </Button>
                    ))}
                  </HStack>
                  <Text fontSize="xs" color="fg.muted" mt={1}>
                    How many levels deep to search
                  </Text>
                </Field>

                <Button
                  bg="teal.600"
                  color="white"
                  _hover={{ bg: "teal.700" }}
                  onClick={exploreNotion}
                  loading={fetching}
                  loadingText="Exploring..."
                  disabled={!notionConfigured || !notionPageUrl}
                >
                  <FiSearch /> Explore Page Tree
                </Button>

                {explorationResult && (
                  <Box p={3} bg="bg.subtle" rounded="md" borderWidth="1px" borderColor="border.DEFAULT">
                    <Text fontSize="sm" fontWeight="500" color="fg.DEFAULT" mb={2}>
                      Exploration Summary
                    </Text>
                    <VStack gap={1} align="stretch">
                      <Text fontSize="xs" color="fg.muted">
                        📄 Pages scanned: {explorationResult.exploration.pagesScanned}
                      </Text>
                      {explorationResult.exploration.llmClassifications > 0 && (
                        <Text fontSize="xs" color="purple.300">
                          🤖 LLM classifications: {explorationResult.exploration.llmClassifications}
                        </Text>
                      )}
                      {explorationResult.exploration.characterPagesFound.length > 0 && (
                        <Text fontSize="xs" color="fg.muted">
                          👥 Character pages: {explorationResult.exploration.characterPagesFound.join(", ")}
                        </Text>
                      )}
                      {explorationResult.exploration.locationPagesFound.length > 0 && (
                        <Text fontSize="xs" color="fg.muted">
                          📍 Location pages: {explorationResult.exploration.locationPagesFound.join(", ")}
                        </Text>
                      )}
                      <Button
                        size="xs"
                        variant="ghost"
                        color="fg.muted"
                        onClick={() => setShowAllPages(!showAllPages)}
                        mt={2}
                      >
                        {showAllPages ? "Hide" : "Show"} All Pages ({explorationResult.exploration.allPages.length})
                      </Button>
                    </VStack>
                  </Box>
                )}
              </VStack>
            </Card.Body>
          </Card.Root>

          {/* Right Panel: Exploration Results */}
          <Card.Root
            bg="bg.panel"
            borderWidth="1px"
            borderColor="border.DEFAULT"
            shadow="sm"
          >
            <Card.Body p={4}>
              {fetching ? (
                <Flex justify="center" align="center" py={16} direction="column" gap={3}>
                  <Spinner size="lg" color="teal.500" />
                  <Text fontSize="sm" color="fg.muted">
                    Exploring page tree...
                  </Text>
                </Flex>
              ) : !explorationResult ? (
                <VStack py={12} gap={3}>
                  <Text fontSize="3xl">🤖</Text>
                  <Text fontSize="sm" color="fg.muted" textAlign="center">
                    Enter a root Notion page URL and click Explore
                  </Text>
                  <Text fontSize="xs" color="fg.muted" textAlign="center" maxW="300px">
                    AI will analyze each page's content to identify characters and locations, then extract them automatically.
                  </Text>
                </VStack>
              ) : (
                <VStack gap={6} align="stretch">
                  {/* All Explored Pages Debug Panel */}
                  {showAllPages && explorationResult.exploration.allPages.length > 0 && (
                    <Box>
                      <Flex justify="space-between" align="center" mb={3}>
                        <HStack gap={2}>
                          <FiLayers color="var(--chakra-colors-gray-400)" />
                          <Heading size="sm" color="fg.DEFAULT">
                            All Explored Pages ({explorationResult.exploration.allPages.length})
                          </Heading>
                        </HStack>
                      </Flex>
                      
                      <Box 
                        maxH="300px" 
                        overflowY="auto" 
                        bg="gray.900" 
                        rounded="md" 
                        p={3}
                        fontFamily="mono"
                        fontSize="xs"
                      >
                        <VStack gap={1} align="stretch">
                          {explorationResult.exploration.allPages
                            .sort((a, b) => a.depth - b.depth)
                            .map((page, idx) => (
                              <Box 
                                key={page.id || idx}
                                pl={page.depth * 4}
                                py={1}
                                borderBottomWidth="1px"
                                borderColor="gray.800"
                              >
                                <HStack gap={2} flexWrap="wrap">
                                  <Text color="gray.500" minW="20px">
                                    L{page.depth}
                                  </Text>
                                  <Text color="fg.DEFAULT" fontWeight="500">
                                    {page.title}
                                  </Text>
                                  <Badge
                                    size="sm"
                                    bg={
                                      page.classification.includes("character") ? "purple.900" :
                                      page.classification.includes("location") ? "blue.900" :
                                      page.classification === "mixed" ? "orange.900" :
                                      "gray.800"
                                    }
                                    color={
                                      page.classification.includes("character") ? "purple.200" :
                                      page.classification.includes("location") ? "blue.200" :
                                      page.classification === "mixed" ? "orange.200" :
                                      "gray.400"
                                    }
                                  >
                                    {page.classification}
                                  </Badge>
                                  <Text color="gray.500">
                                    {Math.round(page.confidence * 100)}%
                                  </Text>
                                  {page.childCount > 0 && (
                                    <Text color="teal.400">
                                      📁 {page.childCount} subpages
                                    </Text>
                                  )}
                                  {page.charactersExtracted > 0 && (
                                    <Text color="purple.400">
                                      👥 {page.charactersExtracted}
                                    </Text>
                                  )}
                                  {page.locationsExtracted > 0 && (
                                    <Text color="blue.400">
                                      📍 {page.locationsExtracted}
                                    </Text>
                                  )}
                                  {page.discoveredVia && (
                                    <Text color="gray.600" fontSize="10px">
                                      via {page.discoveredVia}
                                    </Text>
                                  )}
                                </HStack>
                              </Box>
                            ))}
                        </VStack>
                      </Box>
                      
                      {/* Warning if pages might be missing */}
                      {explorationResult.exploration.allPages.some(p => p.childCount > 0 && p.depth >= exploreDepth - 1) && (
                        <Box mt={2} p={2} bg="yellow.950" rounded="md" borderWidth="1px" borderColor="yellow.800">
                          <Text fontSize="xs" color="yellow.300">
                            ⚠️ Some pages at depth {exploreDepth - 1}+ have children. Consider increasing scan depth to explore them.
                          </Text>
                        </Box>
                      )}
                    </Box>
                  )}
                  
                  {/* Characters Section */}
                  <Box>
                    <Flex justify="space-between" align="center" mb={3}>
                      <HStack gap={2}>
                        <FiUser color="var(--chakra-colors-purple-400)" />
                        <Heading size="sm" color="fg.DEFAULT">
                          Characters ({explorationResult.characters.length})
                        </Heading>
                      </HStack>
                      <HStack gap={2}>
                        <Button
                          size="xs"
                          variant="ghost"
                          color="fg.muted"
                          onClick={() => setSelectedCharacterIds(new Set(explorationResult.characters.map(c => c.id)))}
                        >
                          All
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          color="fg.muted"
                          onClick={() => setSelectedCharacterIds(new Set())}
                        >
                          None
                        </Button>
                      </HStack>
                    </Flex>

                    {explorationResult.characters.length === 0 ? (
                      <Text fontSize="sm" color="fg.muted" py={4} textAlign="center">
                        No characters found. Try increasing scan depth or ensure your pages contain character descriptions.
                      </Text>
                    ) : (
                      <VStack gap={2} align="stretch" maxH="300px" overflowY="auto">
                        {explorationResult.characters.map((char) => (
                          <Card.Root
                            key={char.id}
                            bg={selectedCharacterIds.has(char.id) ? "purple.950" : "transparent"}
                            borderWidth="1px"
                            borderColor={selectedCharacterIds.has(char.id) ? "purple.600" : "border.DEFAULT"}
                            transition="all 0.15s"
                            cursor="pointer"
                            onClick={() => toggleCharacterSelection(char.id)}
                            _hover={{ borderColor: selectedCharacterIds.has(char.id) ? "purple.500" : "border.strong" }}
                          >
                            <Card.Body p={2}>
                              <Flex gap={2} align="flex-start">
                                <Checkbox.Root
                                  checked={selectedCharacterIds.has(char.id)}
                                  onCheckedChange={() => toggleCharacterSelection(char.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  size="sm"
                                >
                                  <Checkbox.HiddenInput />
                                  <Checkbox.Control
                                    borderColor="border.strong"
                                    _checked={{ bg: "purple.600", borderColor: "purple.600" }}
                                  >
                                    <Checkbox.Indicator>
                                      <FiCheck />
                                    </Checkbox.Indicator>
                                  </Checkbox.Control>
                                </Checkbox.Root>
                                <Box flex={1}>
                                  <Text fontSize="sm" fontWeight="500" color="fg.DEFAULT">
                                    {char.name}
                                  </Text>
                                  {char.blurb && (
                                    <Text fontSize="xs" color="fg.muted" lineClamp={2}>
                                      {char.blurb}
                                    </Text>
                                  )}
                                </Box>
                              </Flex>
                            </Card.Body>
                          </Card.Root>
                        ))}
                      </VStack>
                    )}

                    {explorationResult.characters.length > 0 && (
                      <Button
                        mt={3}
                        w="full"
                        bg="purple.600"
                        color="white"
                        size="sm"
                        _hover={{ bg: "purple.700" }}
                        onClick={importExploredCharacters}
                        loading={importingType === "characters"}
                        loadingText="Importing..."
                        disabled={selectedCharacterIds.size === 0}
                      >
                        <FiDownload /> Import {selectedCharacterIds.size} Characters
                      </Button>
                    )}
                  </Box>

                  {/* Locations Section */}
                  <Box>
                    <Flex justify="space-between" align="center" mb={3}>
                      <HStack gap={2}>
                        <FiMapPin color="var(--chakra-colors-blue-400)" />
                        <Heading size="sm" color="fg.DEFAULT">
                          Locations ({explorationResult.locations.length})
                        </Heading>
                      </HStack>
                      <HStack gap={2}>
                        <Button
                          size="xs"
                          variant="ghost"
                          color="fg.muted"
                          onClick={() => setSelectedLocationIds(new Set(explorationResult.locations.map(l => l.id)))}
                        >
                          All
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          color="fg.muted"
                          onClick={() => setSelectedLocationIds(new Set())}
                        >
                          None
                        </Button>
                      </HStack>
                    </Flex>

                    {explorationResult.locations.length === 0 ? (
                      <Text fontSize="sm" color="fg.muted" py={4} textAlign="center">
                        No locations found. Try increasing scan depth or ensure your pages contain location/place descriptions.
                      </Text>
                    ) : (
                      <VStack gap={2} align="stretch" maxH="300px" overflowY="auto">
                        {explorationResult.locations.map((loc) => (
                          <Card.Root
                            key={loc.id}
                            bg={selectedLocationIds.has(loc.id) ? "blue.950" : "transparent"}
                            borderWidth="1px"
                            borderColor={selectedLocationIds.has(loc.id) ? "blue.600" : "border.DEFAULT"}
                            transition="all 0.15s"
                            cursor="pointer"
                            onClick={() => toggleLocationSelection(loc.id)}
                            _hover={{ borderColor: selectedLocationIds.has(loc.id) ? "blue.500" : "border.strong" }}
                          >
                            <Card.Body p={2}>
                              <Flex gap={2} align="flex-start">
                                <Checkbox.Root
                                  checked={selectedLocationIds.has(loc.id)}
                                  onCheckedChange={() => toggleLocationSelection(loc.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  size="sm"
                                >
                                  <Checkbox.HiddenInput />
                                  <Checkbox.Control
                                    borderColor="border.strong"
                                    _checked={{ bg: "blue.600", borderColor: "blue.600" }}
                                  >
                                    <Checkbox.Indicator>
                                      <FiCheck />
                                    </Checkbox.Indicator>
                                  </Checkbox.Control>
                                </Checkbox.Root>
                                <Box flex={1}>
                                  <Text fontSize="sm" fontWeight="500" color="fg.DEFAULT">
                                    {loc.name}
                                  </Text>
                                  {loc.blurb && (
                                    <Text fontSize="xs" color="fg.muted" lineClamp={2}>
                                      {loc.blurb}
                                    </Text>
                                  )}
                                </Box>
                              </Flex>
                            </Card.Body>
                          </Card.Root>
                        ))}
                      </VStack>
                    )}

                    {explorationResult.locations.length > 0 && (
                      <Button
                        mt={3}
                        w="full"
                        bg="blue.600"
                        color="white"
                        size="sm"
                        _hover={{ bg: "blue.700" }}
                        onClick={importExploredLocations}
                        loading={importingType === "locations"}
                        loadingText="Importing..."
                        disabled={selectedLocationIds.size === 0}
                      >
                        <FiDownload /> Import {selectedLocationIds.size} Locations
                      </Button>
                    )}
                  </Box>
                </VStack>
              )}
            </Card.Body>
          </Card.Root>
        </Grid>
      ) : (
      <Grid templateColumns={{ base: "1fr", lg: "350px 1fr" }} gap={6}>
        {/* Left Panel: Source Configuration */}
        <Card.Root
          bg="bg.panel"
          borderWidth="1px"
          borderColor="border.DEFAULT"
          shadow="sm"
        >
          <Card.Body p={4}>
            {/* Source Type Tabs */}
            <HStack gap={2} mb={4}>
              <Button
                variant={sourceType === "generate" ? "solid" : "ghost"}
                bg={sourceType === "generate" ? "purple.600" : undefined}
                color={sourceType === "generate" ? "white" : "fg.muted"}
                onClick={() => setSourceType("generate")}
                size="sm"
                flex={1}
              >
                <FiZap /> AI Generate
              </Button>
              <Button
                variant={sourceType === "notion" ? "solid" : "ghost"}
                bg={sourceType === "notion" ? "gray.600" : undefined}
                color={sourceType === "notion" ? "white" : "fg.muted"}
                onClick={() => setSourceType("notion")}
                size="sm"
                flex={1}
              >
                <FiDatabase /> Notion
              </Button>
            </HStack>

            {sourceType === "notion" ? (
              <VStack gap={4} align="stretch">
                {/* Notion Status Indicator */}
                <Box
                  p={3}
                  rounded="md"
                  bg={notionConfigured ? "green.950" : "red.950"}
                  borderWidth="1px"
                  borderColor={notionConfigured ? "green.800" : "red.800"}
                >
                  <HStack gap={2}>
                    {notionConfigured === null ? (
                      <Spinner size="sm" />
                    ) : notionConfigured ? (
                      <FiCheckCircle color="var(--chakra-colors-green-400)" />
                    ) : (
                      <FiAlertCircle color="var(--chakra-colors-red-400)" />
                    )}
                    <Box flex={1}>
                      <Text
                        fontSize="sm"
                        fontWeight="500"
                        color={notionConfigured ? "green.300" : "red.300"}
                      >
                        {notionConfigured === null
                          ? "Checking..."
                          : notionConfigured
                          ? "Notion API Connected"
                          : "Notion API Not Configured"}
                      </Text>
                      {notionConfigured === false && (
                        <Text fontSize="xs" color="red.400">
                          Add NOTION_TOKEN to backend/.env
                        </Text>
                      )}
                    </Box>
                  </HStack>
                </Box>

                <Field label="Page URL">
                  <Input
                    value={notionPageUrl}
                    onChange={(e) => setNotionPageUrl(e.target.value)}
                    placeholder="https://notion.so/..."
                    bg="bg.subtle"
                    borderColor="border.DEFAULT"
                    fontSize="sm"
                  />
                </Field>
                <Text fontSize="xs" color="fg.muted">
                  Enter the URL of a character page to import that character, or
                  the World Setting page to extract locations.
                </Text>
                <Button
                  bg="gray.600"
                  color="white"
                  _hover={{ bg: "gray.700" }}
                  onClick={fetchFromNotion}
                  loading={fetching}
                  loadingText="Fetching..."
                  disabled={!notionConfigured}
                >
                  <FiDownload /> Fetch from Notion
                </Button>
              </VStack>
            ) : (
              <VStack gap={4} align="stretch">
                {/* AI Status Indicator */}
                <Box
                  p={3}
                  rounded="md"
                  bg={aiConfigured ? "green.950" : "red.950"}
                  borderWidth="1px"
                  borderColor={aiConfigured ? "green.800" : "red.800"}
                >
                  <HStack gap={2}>
                    {aiConfigured === null ? (
                      <Spinner size="sm" />
                    ) : aiConfigured ? (
                      <FiCheckCircle color="var(--chakra-colors-green-400)" />
                    ) : (
                      <FiAlertCircle color="var(--chakra-colors-red-400)" />
                    )}
                    <Box flex={1}>
                      <Text
                        fontSize="sm"
                        fontWeight="500"
                        color={aiConfigured ? "green.300" : "red.300"}
                      >
                        {aiConfigured === null
                          ? "Checking..."
                          : aiConfigured
                          ? "Claude API Connected"
                          : "Claude API Not Configured"}
                      </Text>
                      {aiConfigured && aiModel && (
                        <Text fontSize="xs" color="fg.muted">
                          Model: {aiModel}
                        </Text>
                      )}
                      {aiConfigured === false && (
                        <Text fontSize="xs" color="red.400">
                          Add ANTHROPIC_API_KEY to backend/.env
                        </Text>
                      )}
                    </Box>
                  </HStack>
                </Box>

                <Field label="Prompt">
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={
                      entityType === "characters"
                        ? "e.g., Resistance fighters who operate in Oakland's underground"
                        : "e.g., Hidden meeting spots in the Bay Area for resistance groups"
                    }
                    rows={4}
                    bg="bg.subtle"
                    borderColor="border.DEFAULT"
                    fontSize="sm"
                  />
                </Field>
                <Field label="Count">
                  <HStack>
                    {[1, 3, 5, 10].map((n) => (
                      <Button
                        key={n}
                        size="xs"
                        variant={count === n ? "solid" : "outline"}
                        bg={count === n ? "purple.600" : undefined}
                        color={count === n ? "white" : "fg.DEFAULT"}
                        borderColor="border.DEFAULT"
                        onClick={() => setCount(n)}
                      >
                        {n}
                      </Button>
                    ))}
                  </HStack>
                </Field>
                <Button
                  bg="purple.600"
                  color="white"
                  _hover={{ bg: "purple.700" }}
                  onClick={generateWithAI}
                  loading={fetching}
                  loadingText="Generating..."
                  disabled={!aiConfigured}
                >
                  <FiZap /> Generate {entityType}
                </Button>
              </VStack>
            )}
          </Card.Body>
        </Card.Root>

        {/* Right Panel: Preview & Selection */}
        <Card.Root
          bg="bg.panel"
          borderWidth="1px"
          borderColor="border.DEFAULT"
          shadow="sm"
        >
          <Card.Body p={4}>
            <Flex justify="space-between" align="center" mb={4}>
              <Heading size="sm" color="fg.DEFAULT">
                Preview ({previewItems.length} items)
              </Heading>
              {previewItems.length > 0 && (
                <HStack gap={2}>
                  <Button
                    size="xs"
                    variant="ghost"
                    color="fg.muted"
                    onClick={selectAll}
                  >
                    Select All
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    color="fg.muted"
                    onClick={selectNone}
                  >
                    Select None
                  </Button>
                </HStack>
              )}
            </Flex>

            {fetching ? (
              <Flex justify="center" align="center" py={16}>
                <Spinner size="lg" color="purple.500" />
              </Flex>
            ) : previewItems.length === 0 ? (
              <VStack py={12} gap={3}>
                <Text fontSize="3xl">
                  {sourceType === "notion" ? "📄" : "✨"}
                </Text>
                <Text fontSize="sm" color="fg.muted" textAlign="center">
                  {sourceType === "notion"
                    ? "Enter a Notion page URL and click Fetch"
                    : "Enter a prompt and click Generate"}
                </Text>
              </VStack>
            ) : (
              <VStack gap={3} align="stretch">
                {previewItems.map((item) => (
                  <Card.Root
                    key={item.id}
                    bg={selectedIds.has(item.id) ? "bg.subtle" : "transparent"}
                    borderWidth="1px"
                    borderColor={
                      selectedIds.has(item.id) ? "purple.500" : "border.DEFAULT"
                    }
                    transition="all 0.15s"
                    cursor="pointer"
                    onClick={() =>
                      editingItem !== item.id && toggleSelection(item.id)
                    }
                    _hover={{
                      borderColor: selectedIds.has(item.id)
                        ? "purple.400"
                        : "border.strong",
                    }}
                  >
                    <Card.Body p={3}>
                      {editingItem === item.id ? (
                        <VStack gap={2} align="stretch">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            size="sm"
                            bg="bg.DEFAULT"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Textarea
                            value={editBlurb}
                            onChange={(e) => setEditBlurb(e.target.value)}
                            size="sm"
                            rows={2}
                            bg="bg.DEFAULT"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <HStack justify="flex-end">
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingItem(null);
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="xs"
                              bg="accent.DEFAULT"
                              color="fg.inverted"
                              onClick={(e) => {
                                e.stopPropagation();
                                saveEdits();
                              }}
                            >
                              Save
                            </Button>
                          </HStack>
                        </VStack>
                      ) : (
                        <Flex gap={3} align="flex-start">
                          <Checkbox.Root
                            checked={selectedIds.has(item.id)}
                            onCheckedChange={() => toggleSelection(item.id)}
                            onClick={(e) => e.stopPropagation()}
                            mt={1}
                          >
                            <Checkbox.HiddenInput />
                            <Checkbox.Control
                              borderColor="border.strong"
                              _checked={{
                                bg: "purple.600",
                                borderColor: "purple.600",
                              }}
                            >
                              <Checkbox.Indicator>
                                <FiCheck />
                              </Checkbox.Indicator>
                            </Checkbox.Control>
                          </Checkbox.Root>
                          <Box flex={1}>
                            <Flex justify="space-between" align="center" mb={1}>
                              <Text fontWeight="600" color="fg.DEFAULT">
                                {item.name}
                              </Text>
                              <HStack gap={1}>
                                <Badge
                                  size="sm"
                                  bg={
                                    item.source === "ai-generated"
                                      ? "purple.100"
                                      : "gray.100"
                                  }
                                  color={
                                    item.source === "ai-generated"
                                      ? "purple.700"
                                      : "gray.700"
                                  }
                                >
                                  {item.source === "ai-generated"
                                    ? "Claude"
                                    : "Notion"}
                                </Badge>
                                <IconButton
                                  aria-label="Edit"
                                  variant="ghost"
                                  size="xs"
                                  color="fg.muted"
                                  _hover={{ color: "fg.DEFAULT" }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditing(item);
                                  }}
                                >
                                  <FiEdit2 />
                                </IconButton>
                              </HStack>
                            </Flex>
                            <Text fontSize="sm" color="fg.muted">
                              {item.blurb || "No description"}
                            </Text>
                          </Box>
                        </Flex>
                      )}
                    </Card.Body>
                  </Card.Root>
                ))}
              </VStack>
            )}

            {/* Import Button */}
            {previewItems.length > 0 && (
              <Box mt={4} pt={4} borderTopWidth="1px" borderColor="border.DEFAULT">
                <Button
                  w="full"
                  bg="accent.DEFAULT"
                  color="fg.inverted"
                  _hover={{ bg: "accent.emphasis" }}
                  onClick={importSelected}
                  loading={importing}
                  loadingText="Importing..."
                  disabled={selectedIds.size === 0}
                >
                  <FiDownload /> Import {selectedIds.size} Selected{" "}
                  {entityType}
                </Button>
              </Box>
            )}
          </Card.Body>
        </Card.Root>
      </Grid>
      )}
    </Box>
  );
}
