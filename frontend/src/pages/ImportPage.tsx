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
} from "react-icons/fi";
import {
  importApi,
  generateApi,
  type ImportableItem,
  type ImportResult,
} from "../api/client";

type EntityType = "characters" | "locations";
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

  // Loading states
  const [fetching, setFetching] = useState(false);
  const [importing, setImporting] = useState(false);

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
      } else {
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
    </Box>
  );
}
