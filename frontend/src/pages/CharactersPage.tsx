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
  Spinner,
  IconButton,
  CloseButton,
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
import { FiPlus, FiEdit2, FiTrash2 } from "react-icons/fi";
import { charactersApi } from "../api/client";
import type { Character, CreateCharacterInput } from "../types";

export function CharactersPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);

  useEffect(() => {
    loadCharacters();
  }, []);

  async function loadCharacters() {
    try {
      setLoading(true);
      const data = await charactersApi.list();
      setCharacters(data);
    } catch (err) {
      toaster.error({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load characters",
      });
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingCharacter(null);
    setIsModalOpen(true);
  }

  function openEditModal(character: Character) {
    setEditingCharacter(character);
    setIsModalOpen(true);
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this character?")) return;
    try {
      await charactersApi.delete(id);
      toaster.success({ title: "Character deleted" });
      await loadCharacters();
    } catch (err) {
      toaster.error({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete",
      });
    }
  }

  async function handleSave(data: CreateCharacterInput) {
    if (editingCharacter) {
      await charactersApi.update(editingCharacter.id, data);
      toaster.success({ title: "Character updated" });
    } else {
      await charactersApi.create(data);
      toaster.success({ title: "Character created" });
    }
    setIsModalOpen(false);
    await loadCharacters();
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
        <Heading size="lg" color="fg.DEFAULT">Characters</Heading>
        <Button
          bg="accent.DEFAULT"
          color="fg.inverted"
          _hover={{ bg: "accent.emphasis" }}
          onClick={openCreateModal}
        >
          <FiPlus /> New Character
        </Button>
      </Flex>

      {characters.length === 0 ? (
        <VStack py={8} gap={3}>
          <Text fontSize="3xl">👤</Text>
          <Text fontSize="md" color="fg.muted">
            No characters yet
          </Text>
          <Button
            bg="accent.DEFAULT"
            color="fg.inverted"
            _hover={{ bg: "accent.emphasis" }}
            onClick={openCreateModal}
          >
            Create your first character
          </Button>
        </VStack>
      ) : (
        <Grid templateColumns="repeat(auto-fill, minmax(280px, 1fr))" gap={3}>
          {characters.map((character) => (
            <Card.Root
              key={character.id}
              bg="bg.panel"
              borderWidth="1px"
              borderColor="border.DEFAULT"
              shadow="sm"
              _hover={{ borderColor: "border.strong", shadow: "md" }}
              transition="all 0.2s"
            >
              <Card.Body p={3}>
                <Flex justify="space-between" align="flex-start" mb={2}>
                  <Heading size="sm" color="fg.DEFAULT">{character.name}</Heading>
                  <Flex gap={1}>
                    <IconButton
                      aria-label="Edit"
                      variant="ghost"
                      size="sm"
                      color="fg.muted"
                      _hover={{ color: "fg.DEFAULT", bg: "bg.muted" }}
                      onClick={() => openEditModal(character)}
                    >
                      <FiEdit2 />
                    </IconButton>
                    <IconButton
                      aria-label="Delete"
                      variant="ghost"
                      size="sm"
                      color="error.fg"
                      _hover={{ bg: "error.muted" }}
                      onClick={() => handleDelete(character.id)}
                    >
                      <FiTrash2 />
                    </IconButton>
                  </Flex>
                </Flex>
                {character.blurb && (
                  <Text color="fg.muted" fontStyle="italic" fontSize="sm">
                    {character.blurb}
                  </Text>
                )}
              </Card.Body>
            </Card.Root>
          ))}
        </Grid>
      )}

      <CharacterModal
        open={isModalOpen}
        onOpenChange={(open) => setIsModalOpen(open)}
        character={editingCharacter}
        onSave={handleSave}
      />
    </Box>
  );
}

interface CharacterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  character: Character | null;
  onSave: (data: CreateCharacterInput) => Promise<void>;
}

function CharacterModal({ open, onOpenChange, character, onSave }: CharacterModalProps) {
  const [name, setName] = useState("");
  const [blurb, setBlurb] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(character?.name || "");
      setBlurb(character?.blurb || "");
    }
  }, [open, character]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toaster.error({ title: "Name is required" });
      return;
    }

    try {
      setSaving(true);
      await onSave({ name: name.trim(), blurb: blurb.trim() });
    } catch (err) {
      toaster.error({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogRoot open={open} onOpenChange={(e) => onOpenChange(e.open)} placement="center">
      <DialogBackdrop />
      <DialogContent bg="bg.panel" maxW="md" borderWidth="1px" borderColor="border.DEFAULT">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle color="fg.DEFAULT">
              {character ? "Edit Character" : "New Character"}
            </DialogTitle>
            <DialogCloseTrigger asChild>
              <CloseButton size="sm" />
            </DialogCloseTrigger>
          </DialogHeader>
          <DialogBody>
            <VStack gap={4}>
              <Field label="Name">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter character name"
                  bg="bg.subtle"
                  borderColor="border.DEFAULT"
                  _hover={{ borderColor: "border.strong" }}
                  _focus={{ borderColor: "accent.DEFAULT", boxShadow: "none" }}
                  autoFocus
                />
              </Field>
              <Field label="Blurb">
                <Textarea
                  value={blurb}
                  onChange={(e) => setBlurb(e.target.value)}
                  placeholder="A brief description of this character"
                  rows={3}
                  bg="bg.subtle"
                  borderColor="border.DEFAULT"
                  _hover={{ borderColor: "border.strong" }}
                  _focus={{ borderColor: "accent.DEFAULT", boxShadow: "none" }}
                />
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
              {character ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}
