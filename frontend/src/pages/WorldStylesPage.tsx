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
  Separator,
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
  ConfirmDialog,
} from "../components/ui/dialog";
import { Field } from "../components/ui/field";
import { toaster } from "../components/ui/toaster";
import { FiPlus, FiEdit2, FiTrash2, FiImage } from "react-icons/fi";
import { worldStylesApi, referenceImagesApi } from "../api/client";
import { ReferenceImageManager } from "../components/ReferenceImageManager";
import type { WorldStyle, CreateWorldStyleInput } from "../types";

export function WorldStylesPage() {
  const [styles, setStyles] = useState<WorldStyle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStyle, setEditingStyle] = useState<WorldStyle | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [styleToDelete, setStyleToDelete] = useState<number | null>(null);
  const [imageCounts, setImageCounts] = useState<Record<number, number>>({});

  useEffect(() => {
    loadStyles();
  }, []);

  async function loadStyles() {
    try {
      setLoading(true);
      const data = await worldStylesApi.list();
      setStyles(data);
      const counts: Record<number, number> = {};
      await Promise.all(
        data.map(async (s) => {
          try {
            const imgs = await referenceImagesApi.listForWorldStyle(s.id);
            counts[s.id] = imgs.length;
          } catch {
            counts[s.id] = 0;
          }
        })
      );
      setImageCounts(counts);
    } catch (err) {
      toaster.error({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load world styles",
      });
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingStyle(null);
    setIsModalOpen(true);
  }

  function openEditModal(style: WorldStyle) {
    setEditingStyle(style);
    setIsModalOpen(true);
  }

  function handleDeleteClick(id: number) {
    setStyleToDelete(id);
    setIsConfirmDeleteOpen(true);
  }

  async function handleDeleteConfirm() {
    if (!styleToDelete) return;
    try {
      await worldStylesApi.delete(styleToDelete);
      toaster.success({ title: "World style deleted" });
      await loadStyles();
    } catch (err) {
      toaster.error({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete",
      });
    } finally {
      setStyleToDelete(null);
    }
  }

  async function handleSave(data: CreateWorldStyleInput) {
    if (editingStyle) {
      await worldStylesApi.update(editingStyle.id, data);
      toaster.success({ title: "World style updated" });
    } else {
      await worldStylesApi.create(data);
      toaster.success({ title: "World style created" });
    }
    setIsModalOpen(false);
    await loadStyles();
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
        <VStack align="flex-start" gap={0}>
          <Heading size="lg" color="fg.DEFAULT">
            World Styles
          </Heading>
          <Text fontSize="sm" color="fg.muted">
            Style reference sets for visual LoRA training
          </Text>
        </VStack>
        <Button
          bg="accent.DEFAULT"
          color="fg.inverted"
          _hover={{ bg: "accent.emphasis" }}
          onClick={openCreateModal}
        >
          <FiPlus /> New Style
        </Button>
      </Flex>

      {styles.length === 0 ? (
        <VStack py={8} gap={3}>
          <Text fontSize="3xl">🎨</Text>
          <Text fontSize="md" color="fg.muted">
            No world styles yet
          </Text>
          <Text fontSize="sm" color="fg.subtle" textAlign="center" maxW="md">
            Create a world style to collect reference images that define the
            visual aesthetic for LoRA training.
          </Text>
          <Button
            bg="accent.DEFAULT"
            color="fg.inverted"
            _hover={{ bg: "accent.emphasis" }}
            onClick={openCreateModal}
          >
            Create your first world style
          </Button>
        </VStack>
      ) : (
        <Grid templateColumns="repeat(auto-fill, minmax(280px, 1fr))" gap={3}>
          {styles.map((style) => (
            <Card.Root
              key={style.id}
              bg="bg.panel"
              borderWidth="1px"
              borderColor="border.DEFAULT"
              shadow="sm"
              _hover={{ borderColor: "border.strong", shadow: "md" }}
              transition="all 0.2s"
            >
              <Card.Body p={3}>
                <Flex justify="space-between" align="flex-start" mb={2}>
                  <Heading size="sm" color="fg.DEFAULT">
                    {style.name}
                  </Heading>
                  <Flex gap={1}>
                    <IconButton
                      aria-label="Edit"
                      variant="ghost"
                      size="sm"
                      color="fg.muted"
                      _hover={{ color: "fg.DEFAULT", bg: "bg.muted" }}
                      onClick={() => openEditModal(style)}
                    >
                      <FiEdit2 />
                    </IconButton>
                    <IconButton
                      aria-label="Delete"
                      variant="ghost"
                      size="sm"
                      color="error.fg"
                      _hover={{ bg: "error.muted" }}
                      onClick={() => handleDeleteClick(style.id)}
                    >
                      <FiTrash2 />
                    </IconButton>
                  </Flex>
                </Flex>
                {style.description && (
                  <Text color="fg.muted" fontStyle="italic" fontSize="sm">
                    {style.description}
                  </Text>
                )}
                {(imageCounts[style.id] ?? 0) > 0 && (
                  <Flex align="center" gap={1} mt={2}>
                    <FiImage
                      size={12}
                      color="var(--chakra-colors-fg-subtle)"
                    />
                    <Text fontSize="xs" color="fg.subtle">
                      {imageCounts[style.id]} ref image
                      {imageCounts[style.id] > 1 ? "s" : ""}
                    </Text>
                  </Flex>
                )}
              </Card.Body>
            </Card.Root>
          ))}
        </Grid>
      )}

      <WorldStyleModal
        open={isModalOpen}
        onOpenChange={(open) => setIsModalOpen(open)}
        style={editingStyle}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={isConfirmDeleteOpen}
        onOpenChange={setIsConfirmDeleteOpen}
        title="Delete World Style"
        description="Are you sure you want to delete this world style? All reference images will be removed. This action cannot be undone."
        confirmText="Delete"
        onConfirm={handleDeleteConfirm}
        confirmColorScheme="red"
      />
    </Box>
  );
}

interface WorldStyleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  style: WorldStyle | null;
  onSave: (data: CreateWorldStyleInput) => Promise<void>;
}

function WorldStyleModal({
  open,
  onOpenChange,
  style,
  onSave,
}: WorldStyleModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(style?.name || "");
      setDescription(style?.description || "");
    }
  }, [open, style]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toaster.error({ title: "Name is required" });
      return;
    }
    try {
      setSaving(true);
      await onSave({ name: name.trim(), description: description.trim() });
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
    <DialogRoot
      open={open}
      onOpenChange={(e) => onOpenChange(e.open)}
      placement="center"
    >
      <DialogBackdrop />
      <DialogContent
        bg="bg.panel"
        maxW={style ? "2xl" : "md"}
        borderWidth="1px"
        borderColor="border.DEFAULT"
        maxH="85vh"
        overflow="auto"
      >
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle color="fg.DEFAULT">
              {style ? "Edit World Style" : "New World Style"}
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
                  placeholder="e.g. Watercolor Fantasy, Ink Wash, Pixel Art"
                  bg="bg.subtle"
                  borderColor="border.DEFAULT"
                  _hover={{ borderColor: "border.strong" }}
                  _focus={{
                    borderColor: "accent.DEFAULT",
                    boxShadow: "none",
                  }}
                  autoFocus
                />
              </Field>
              <Field label="Description">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the visual style this set of references represents"
                  rows={3}
                  bg="bg.subtle"
                  borderColor="border.DEFAULT"
                  _hover={{ borderColor: "border.strong" }}
                  _focus={{
                    borderColor: "accent.DEFAULT",
                    boxShadow: "none",
                  }}
                />
              </Field>

              {style && (
                <>
                  <Separator borderColor="border.DEFAULT" />
                  <ReferenceImageManager
                    entityType="world-styles"
                    entityId={style.id}
                    entityName={style.name}
                  />
                </>
              )}
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
              {style ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}
