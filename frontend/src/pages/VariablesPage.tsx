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
  Badge,
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
import { variablesApi } from "../api/client";
import type { Variable, CreateVariableInput } from "../types";

export function VariablesPage() {
  const [variables, setVariables] = useState<Variable[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVariable, setEditingVariable] = useState<Variable | null>(null);

  useEffect(() => {
    loadVariables();
  }, []);

  async function loadVariables() {
    try {
      setLoading(true);
      const data = await variablesApi.list();
      setVariables(data);
    } catch (err) {
      toaster.error({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load variables",
      });
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingVariable(null);
    setIsModalOpen(true);
  }

  function openEditModal(variable: Variable) {
    setEditingVariable(variable);
    setIsModalOpen(true);
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this variable?")) return;
    try {
      await variablesApi.delete(id);
      toaster.success({ title: "Variable deleted" });
      await loadVariables();
    } catch (err) {
      toaster.error({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete",
      });
    }
  }

  async function handleSave(data: CreateVariableInput) {
    if (editingVariable) {
      await variablesApi.update(editingVariable.id, data);
      toaster.success({ title: "Variable updated" });
    } else {
      await variablesApi.create(data);
      toaster.success({ title: "Variable created" });
    }
    setIsModalOpen(false);
    await loadVariables();
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
        <Heading size="lg" color="fg.DEFAULT">Variables</Heading>
        <Button
          bg="accent.DEFAULT"
          color="fg.inverted"
          _hover={{ bg: "accent.emphasis" }}
          onClick={openCreateModal}
        >
          <FiPlus /> New Variable
        </Button>
      </Flex>

      {variables.length === 0 ? (
        <VStack py={8} gap={3}>
          <Text fontSize="3xl">⚡</Text>
          <Text fontSize="md" color="fg.muted">
            No variables yet
          </Text>
          <Text color="fg.subtle" textAlign="center" fontSize="sm">
            Variables are used to track state and define conditions for scenes
          </Text>
          <Button
            bg="accent.DEFAULT"
            color="fg.inverted"
            _hover={{ bg: "accent.emphasis" }}
            onClick={openCreateModal}
          >
            Create your first variable
          </Button>
        </VStack>
      ) : (
        <Grid templateColumns="repeat(auto-fill, minmax(280px, 1fr))" gap={3}>
          {variables.map((variable) => (
            <Card.Root
              key={variable.id}
              bg="bg.panel"
              borderWidth="1px"
              borderColor="border.DEFAULT"
              shadow="sm"
              _hover={{ borderColor: "border.strong", shadow: "md" }}
              transition="all 0.2s"
            >
              <Card.Body p={3}>
                <Flex justify="space-between" align="flex-start" mb={2}>
                  <Box>
                    <Heading size="sm" mb={1} color="fg.DEFAULT">{variable.name}</Heading>
                    <Badge
                      bg="accent.muted"
                      color="accent.fg"
                      fontFamily="mono"
                      fontSize="xs"
                      px={2}
                      py={1}
                      rounded="md"
                    >
                      Default: {variable.defaultValue}
                    </Badge>
                  </Box>
                  <Flex gap={1}>
                    <IconButton
                      aria-label="Edit"
                      variant="ghost"
                      size="sm"
                      color="fg.muted"
                      _hover={{ color: "fg.DEFAULT", bg: "bg.muted" }}
                      onClick={() => openEditModal(variable)}
                    >
                      <FiEdit2 />
                    </IconButton>
                    <IconButton
                      aria-label="Delete"
                      variant="ghost"
                      size="sm"
                      color="error.fg"
                      _hover={{ bg: "error.muted" }}
                      onClick={() => handleDelete(variable.id)}
                    >
                      <FiTrash2 />
                    </IconButton>
                  </Flex>
                </Flex>
                {variable.description && (
                  <Text color="fg.muted" fontStyle="italic" fontSize="sm">
                    {variable.description}
                  </Text>
                )}
              </Card.Body>
            </Card.Root>
          ))}
        </Grid>
      )}

      <VariableModal
        open={isModalOpen}
        onOpenChange={(open) => setIsModalOpen(open)}
        variable={editingVariable}
        onSave={handleSave}
      />
    </Box>
  );
}

interface VariableModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variable: Variable | null;
  onSave: (data: CreateVariableInput) => Promise<void>;
}

function VariableModal({ open, onOpenChange, variable, onSave }: VariableModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultValue, setDefaultValue] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(variable?.name || "");
      setDescription(variable?.description || "");
      setDefaultValue(variable?.defaultValue ?? 0);
    }
  }, [open, variable]);

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
        description: description.trim(),
        defaultValue,
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

  return (
    <DialogRoot open={open} onOpenChange={(e) => onOpenChange(e.open)} placement="center">
      <DialogBackdrop />
      <DialogContent bg="bg.panel" maxW="md" borderWidth="1px" borderColor="border.DEFAULT">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle color="fg.DEFAULT">
              {variable ? "Edit Variable" : "New Variable"}
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
                  placeholder="e.g., trust_level, health, gold"
                  bg="bg.subtle"
                  borderColor="border.DEFAULT"
                  _hover={{ borderColor: "border.strong" }}
                  _focus={{ borderColor: "accent.DEFAULT", boxShadow: "none" }}
                  autoFocus
                />
              </Field>
              <Field label="Default Value">
                <Input
                  type="number"
                  value={defaultValue}
                  onChange={(e) => setDefaultValue(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  bg="bg.subtle"
                  borderColor="border.DEFAULT"
                  _hover={{ borderColor: "border.strong" }}
                  _focus={{ borderColor: "accent.DEFAULT", boxShadow: "none" }}
                />
              </Field>
              <Field label="Description">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this variable represent?"
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
              {variable ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}
