import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Input,
  Text,
  Textarea,
  VStack,
  HStack,
  Spinner,
  IconButton,
  CloseButton,
  Badge,
  Checkbox,
  NativeSelect,
} from "@chakra-ui/react";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
  DialogBackdrop,
} from "../components/ui/dialog";
import { Field } from "../components/ui/field";
import { toaster } from "../components/ui/toaster";
import { FiPlus, FiEdit2, FiTrash2, FiX } from "react-icons/fi";
import { scenesApi, charactersApi, locationsApi, variablesApi } from "../api/client";
import type {
  Scene,
  CreateSceneInput,
  Character,
  Location,
  Variable,
  ConditionOperator,
  Precondition,
  VariableChange,
} from "../types";

export function ScenesPage() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [variables, setVariables] = useState<Variable[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingScene, setEditingScene] = useState<Scene | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [scenesData, charsData, locsData, varsData] = await Promise.all([
        scenesApi.list(),
        charactersApi.list(),
        locationsApi.list(),
        variablesApi.list(),
      ]);
      setScenes(scenesData);
      setCharacters(charsData);
      setLocations(locsData);
      setVariables(varsData);
    } catch (err) {
      toaster.error({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load data",
      });
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingScene(null);
    setIsModalOpen(true);
  }

  function openEditModal(scene: Scene) {
    setEditingScene(scene);
    setIsModalOpen(true);
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this scene?")) return;
    try {
      await scenesApi.delete(id);
      toaster.success({ title: "Scene deleted" });
      await loadData();
    } catch (err) {
      toaster.error({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete",
      });
    }
  }

  async function handleSave(data: CreateSceneInput) {
    if (editingScene) {
      await scenesApi.update(editingScene.id, data);
      toaster.success({ title: "Scene updated" });
    } else {
      await scenesApi.create(data);
      toaster.success({ title: "Scene created" });
    }
    setIsModalOpen(false);
    await loadData();
  }

  if (loading) {
    return (
      <Flex justify="center" align="center" py={16}>
        <Spinner size="lg" color="accent.DEFAULT" />
      </Flex>
    );
  }

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={4}>
        <Heading size="lg" color="fg.DEFAULT">Scenes</Heading>
        <Button
          bg="accent.DEFAULT"
          color="fg.inverted"
          _hover={{ bg: "accent.emphasis" }}
          onClick={openCreateModal}
        >
          <FiPlus /> New Scene
        </Button>
      </Flex>

      {scenes.length === 0 ? (
        <VStack py={8} gap={3}>
          <Text fontSize="3xl">🎬</Text>
          <Text fontSize="md" color="fg.muted">
            No scenes yet
          </Text>
          <Text color="fg.subtle" textAlign="center" fontSize="sm">
            Create characters, locations, and variables first, then build your scenes
          </Text>
          <Button
            bg="accent.DEFAULT"
            color="fg.inverted"
            _hover={{ bg: "accent.emphasis" }}
            onClick={openCreateModal}
          >
            Create your first scene
          </Button>
        </VStack>
      ) : (
        <VStack gap={3} align="stretch">
          {scenes.map((scene) => (
            <Card.Root
              key={scene.id}
              bg="bg.panel"
              borderWidth="1px"
              borderColor="border.DEFAULT"
              shadow="sm"
              _hover={{ borderColor: "border.strong", shadow: "md" }}
              transition="all 0.2s"
            >
              <Card.Body p={3}>
                <Flex justify="space-between" align="flex-start" mb={2}>
                  <HStack gap={2} flexWrap="wrap">
                    <Heading size="md" color="fg.DEFAULT">{scene.name}</Heading>
                    {scene.locationName && (
                      <Badge
                        bg="success.muted"
                        color="success.fg"
                        px={2}
                        py={1}
                        rounded="md"
                      >
                        📍 {scene.locationName}
                      </Badge>
                    )}
                  </HStack>
                  <Flex gap={1}>
                    <IconButton
                      aria-label="Edit"
                      variant="ghost"
                      size="sm"
                      color="fg.muted"
                      _hover={{ color: "fg.DEFAULT", bg: "bg.muted" }}
                      onClick={() => openEditModal(scene)}
                    >
                      <FiEdit2 />
                    </IconButton>
                    <IconButton
                      aria-label="Delete"
                      variant="ghost"
                      size="sm"
                      color="error.fg"
                      _hover={{ bg: "error.muted" }}
                      onClick={() => handleDelete(scene.id)}
                    >
                      <FiTrash2 />
                    </IconButton>
                  </Flex>
                </Flex>

                {scene.what && (
                  <Box
                    pl={3}
                    borderLeftWidth="2px"
                    borderColor="accent.DEFAULT"
                    mb={3}
                  >
                    <Text color="fg.muted" fontStyle="italic" fontSize="sm">
                      {scene.what}
                    </Text>
                  </Box>
                )}

                {scene.characters.length > 0 && (
                  <Box mb={2}>
                    <Text
                      fontSize="xs"
                      fontWeight="600"
                      color="fg.subtle"
                      textTransform="uppercase"
                      letterSpacing="0.05em"
                      mb={1}
                    >
                      Characters
                    </Text>
                    <HStack gap={1} flexWrap="wrap">
                      {scene.characters.map((char) => (
                        <Badge
                          key={char.id}
                          bg="bg.muted"
                          color="fg.DEFAULT"
                          px={2}
                          py={1}
                          rounded="md"
                        >
                          {char.name}
                        </Badge>
                      ))}
                    </HStack>
                  </Box>
                )}

                {scene.preconditions.length > 0 && (
                  <Box mb={2}>
                    <Text
                      fontSize="xs"
                      fontWeight="600"
                      color="fg.subtle"
                      textTransform="uppercase"
                      letterSpacing="0.05em"
                      mb={1}
                    >
                      Preconditions
                    </Text>
                    <HStack gap={1} flexWrap="wrap">
                      {scene.preconditions.map((p, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          borderColor="border.strong"
                          color="fg.muted"
                          fontFamily="mono"
                          fontSize="xs"
                          px={2}
                          py={1}
                        >
                          {p.variableName} {p.operator} {p.value}
                        </Badge>
                      ))}
                    </HStack>
                  </Box>
                )}

                {scene.variableChanges.length > 0 && (
                  <Box>
                    <Text
                      fontSize="xs"
                      fontWeight="600"
                      color="fg.subtle"
                      textTransform="uppercase"
                      letterSpacing="0.05em"
                      mb={1}
                    >
                      Changes
                    </Text>
                    <HStack gap={1} flexWrap="wrap">
                      {scene.variableChanges.map((vc, i) => (
                        <Badge
                          key={i}
                          bg={vc.delta >= 0 ? "success.muted" : "error.muted"}
                          color={vc.delta >= 0 ? "success.fg" : "error.fg"}
                          fontFamily="mono"
                          fontSize="xs"
                          px={2}
                          py={1}
                          rounded="md"
                        >
                          {vc.variableName} {vc.delta >= 0 ? "+" : ""}{vc.delta}
                        </Badge>
                      ))}
                    </HStack>
                  </Box>
                )}
              </Card.Body>
            </Card.Root>
          ))}
        </VStack>
      )}

      <SceneModal
        open={isModalOpen}
        onOpenChange={(open) => setIsModalOpen(open)}
        scene={editingScene}
        characters={characters}
        locations={locations}
        variables={variables}
        onSave={handleSave}
      />
    </Box>
  );
}

interface SceneModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scene: Scene | null;
  characters: Character[];
  locations: Location[];
  variables: Variable[];
  onSave: (data: CreateSceneInput) => Promise<void>;
}

function SceneModal({
  open,
  onOpenChange,
  scene,
  characters,
  locations,
  variables,
  onSave,
}: SceneModalProps) {
  const [name, setName] = useState("");
  const [locationId, setLocationId] = useState<number | null>(null);
  const [what, setWhat] = useState("");
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<number[]>([]);
  const [preconditions, setPreconditions] = useState<Omit<Precondition, "id" | "variableName">[]>([]);
  const [variableChanges, setVariableChanges] = useState<Omit<VariableChange, "id" | "variableName">[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(scene?.name || "");
      setLocationId(scene?.locationId || null);
      setWhat(scene?.what || "");
      setSelectedCharacterIds(scene?.characters.map((c) => c.id) || []);
      setPreconditions(
        scene?.preconditions.map((p) => ({
          variableId: p.variableId,
          operator: p.operator,
          value: p.value,
        })) || []
      );
      setVariableChanges(
        scene?.variableChanges.map((vc) => ({
          variableId: vc.variableId,
          delta: vc.delta,
        })) || []
      );
    }
  }, [open, scene]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toaster.error({ title: "Name is required" });
      return;
    }

    try {
      setSaving(true);
      await onSave({
        name: name.trim(),
        locationId,
        what: what.trim(),
        characterIds: selectedCharacterIds,
        preconditions,
        variableChanges,
      });
    } catch (err) {
      toaster.error({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save",
      });
    } finally {
      setSaving(false);
    }
  }

  function toggleCharacter(charId: number) {
    setSelectedCharacterIds((prev) =>
      prev.includes(charId) ? prev.filter((id) => id !== charId) : [...prev, charId]
    );
  }

  function addPrecondition() {
    if (variables.length === 0) return;
    setPreconditions([
      ...preconditions,
      { variableId: variables[0].id, operator: ">" as ConditionOperator, value: 0 },
    ]);
  }

  function removePrecondition(index: number) {
    setPreconditions(preconditions.filter((_, i) => i !== index));
  }

  function updatePrecondition(index: number, field: string, value: number | string) {
    setPreconditions(
      preconditions.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  }

  function addVariableChange() {
    if (variables.length === 0) return;
    setVariableChanges([...variableChanges, { variableId: variables[0].id, delta: 0 }]);
  }

  function removeVariableChange(index: number) {
    setVariableChanges(variableChanges.filter((_, i) => i !== index));
  }

  function updateVariableChange(index: number, field: string, value: number) {
    setVariableChanges(
      variableChanges.map((vc, i) => (i === index ? { ...vc, [field]: value } : vc))
    );
  }

  const operators: ConditionOperator[] = [">", "<", "=", ">=", "<=", "!="];

  const inputStyles = {
    bg: "bg.subtle",
    borderColor: "border.DEFAULT",
    _hover: { borderColor: "border.strong" },
    _focus: { borderColor: "accent.DEFAULT", boxShadow: "none" },
  };

  return (
    <DialogRoot open={open} onOpenChange={(e) => onOpenChange(e.open)} placement="center" size="lg">
      <DialogBackdrop />
      <DialogContent bg="bg.panel" maxW="2xl" maxH="90vh" overflow="auto" borderWidth="1px" borderColor="border.DEFAULT">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle color="fg.DEFAULT">{scene ? "Edit Scene" : "New Scene"}</DialogTitle>
            <DialogCloseTrigger asChild>
              <CloseButton size="sm" />
            </DialogCloseTrigger>
          </DialogHeader>
          <DialogBody>
            <VStack gap={5}>
              <Field label="Name">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Scene name"
                  {...inputStyles}
                  autoFocus
                />
              </Field>

              <Field label="Location">
                <NativeSelect.Root>
                  <NativeSelect.Field
                    value={locationId || ""}
                    onChange={(e) => setLocationId(e.target.value ? parseInt(e.target.value) : null)}
                    {...inputStyles}
                  >
                    <option value="">-- No location --</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </NativeSelect.Field>
                </NativeSelect.Root>
              </Field>

              <Field label="What happens (summary)">
                <Textarea
                  value={what}
                  onChange={(e) => setWhat(e.target.value)}
                  placeholder="A brief description of what happens in this scene"
                  rows={3}
                  {...inputStyles}
                />
              </Field>

              <Field label="Characters in scene">
                {characters.length === 0 ? (
                  <Text color="fg.muted" fontSize="sm">
                    No characters available. Create some first.
                  </Text>
                ) : (
                  <Flex gap={3} flexWrap="wrap">
                    {characters.map((char) => (
                      <Checkbox.Root
                        key={char.id}
                        checked={selectedCharacterIds.includes(char.id)}
                        onCheckedChange={() => toggleCharacter(char.id)}
                      >
                        <Checkbox.HiddenInput />
                        <Checkbox.Control borderColor="border.strong">
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        <Checkbox.Label color="fg.DEFAULT">{char.name}</Checkbox.Label>
                      </Checkbox.Root>
                    ))}
                  </Flex>
                )}
              </Field>

              <Field label="Preconditions">
                <VStack align="stretch" gap={2} w="full">
                  {variables.length === 0 ? (
                    <Text color="fg.muted" fontSize="sm">
                      No variables available. Create some first.
                    </Text>
                  ) : (
                    <>
                      {preconditions.map((p, i) => (
                        <Flex key={i} gap={2} align="center" bg="bg.muted" p={2} rounded="md">
                          <NativeSelect.Root flex={1}>
                            <NativeSelect.Field
                              value={p.variableId}
                              onChange={(e) => updatePrecondition(i, "variableId", parseInt(e.target.value))}
                              {...inputStyles}
                            >
                              {variables.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.name}
                                </option>
                              ))}
                            </NativeSelect.Field>
                          </NativeSelect.Root>
                          <NativeSelect.Root w="80px">
                            <NativeSelect.Field
                              value={p.operator}
                              onChange={(e) => updatePrecondition(i, "operator", e.target.value)}
                              {...inputStyles}
                            >
                              {operators.map((op) => (
                                <option key={op} value={op}>
                                  {op}
                                </option>
                              ))}
                            </NativeSelect.Field>
                          </NativeSelect.Root>
                          <Input
                            type="number"
                            value={p.value}
                            onChange={(e) => updatePrecondition(i, "value", parseFloat(e.target.value) || 0)}
                            w="80px"
                            {...inputStyles}
                          />
                          <IconButton
                            aria-label="Remove"
                            variant="ghost"
                            size="sm"
                            color="fg.muted"
                            _hover={{ color: "error.fg", bg: "error.muted" }}
                            onClick={() => removePrecondition(i)}
                          >
                            <FiX />
                          </IconButton>
                        </Flex>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        borderColor="border.strong"
                        color="fg.muted"
                        _hover={{ bg: "bg.muted" }}
                        onClick={addPrecondition}
                        disabled={variables.length === 0}
                      >
                        <FiPlus /> Add Precondition
                      </Button>
                    </>
                  )}
                </VStack>
              </Field>

              <Field label="Variable Changes">
                <VStack align="stretch" gap={2} w="full">
                  {variables.length === 0 ? (
                    <Text color="fg.muted" fontSize="sm">
                      No variables available. Create some first.
                    </Text>
                  ) : (
                    <>
                      {variableChanges.map((vc, i) => (
                        <Flex key={i} gap={2} align="center" bg="bg.muted" p={2} rounded="md">
                          <NativeSelect.Root flex={1}>
                            <NativeSelect.Field
                              value={vc.variableId}
                              onChange={(e) => updateVariableChange(i, "variableId", parseInt(e.target.value))}
                              {...inputStyles}
                            >
                              {variables.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.name}
                                </option>
                              ))}
                            </NativeSelect.Field>
                          </NativeSelect.Root>
                          <Text fontFamily="mono" fontWeight="600" color="fg.muted">
                            Δ
                          </Text>
                          <Input
                            type="number"
                            value={vc.delta}
                            onChange={(e) => updateVariableChange(i, "delta", parseFloat(e.target.value) || 0)}
                            w="100px"
                            placeholder="e.g., +5 or -3"
                            {...inputStyles}
                          />
                          <IconButton
                            aria-label="Remove"
                            variant="ghost"
                            size="sm"
                            color="fg.muted"
                            _hover={{ color: "error.fg", bg: "error.muted" }}
                            onClick={() => removeVariableChange(i)}
                          >
                            <FiX />
                          </IconButton>
                        </Flex>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        borderColor="border.strong"
                        color="fg.muted"
                        _hover={{ bg: "bg.muted" }}
                        onClick={addVariableChange}
                        disabled={variables.length === 0}
                      >
                        <FiPlus /> Add Change
                      </Button>
                    </>
                  )}
                </VStack>
              </Field>
            </VStack>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              bg="accent.DEFAULT"
              color="fg.inverted"
              _hover={{ bg: "accent.emphasis" }}
              loading={saving}
            >
              {scene ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}
