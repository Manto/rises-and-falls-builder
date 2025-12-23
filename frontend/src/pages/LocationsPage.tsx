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
import { locationsApi } from "../api/client";
import type { Location, CreateLocationInput } from "../types";

export function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);

  useEffect(() => {
    loadLocations();
  }, []);

  async function loadLocations() {
    try {
      setLoading(true);
      const data = await locationsApi.list();
      setLocations(data);
    } catch (err) {
      toaster.error({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load locations",
      });
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingLocation(null);
    setIsModalOpen(true);
  }

  function openEditModal(location: Location) {
    setEditingLocation(location);
    setIsModalOpen(true);
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this location?")) return;
    try {
      await locationsApi.delete(id);
      toaster.success({ title: "Location deleted" });
      await loadLocations();
    } catch (err) {
      toaster.error({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete",
      });
    }
  }

  async function handleSave(data: CreateLocationInput) {
    if (editingLocation) {
      await locationsApi.update(editingLocation.id, data);
      toaster.success({ title: "Location updated" });
    } else {
      await locationsApi.create(data);
      toaster.success({ title: "Location created" });
    }
    setIsModalOpen(false);
    await loadLocations();
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
        <Heading size="lg" color="fg.DEFAULT">Locations</Heading>
        <Button
          bg="accent.DEFAULT"
          color="fg.inverted"
          _hover={{ bg: "accent.emphasis" }}
          onClick={openCreateModal}
        >
          <FiPlus /> New Location
        </Button>
      </Flex>

      {locations.length === 0 ? (
        <VStack py={8} gap={3}>
          <Text fontSize="3xl">📍</Text>
          <Text fontSize="md" color="fg.muted">
            No locations yet
          </Text>
          <Button
            bg="accent.DEFAULT"
            color="fg.inverted"
            _hover={{ bg: "accent.emphasis" }}
            onClick={openCreateModal}
          >
            Create your first location
          </Button>
        </VStack>
      ) : (
        <Grid templateColumns="repeat(auto-fill, minmax(280px, 1fr))" gap={3}>
          {locations.map((location) => (
            <Card.Root
              key={location.id}
              bg="bg.panel"
              borderWidth="1px"
              borderColor="border.DEFAULT"
              shadow="sm"
              _hover={{ borderColor: "border.strong", shadow: "md" }}
              transition="all 0.2s"
            >
              <Card.Body p={3}>
                <Flex justify="space-between" align="flex-start" mb={2}>
                  <Heading size="sm" color="fg.DEFAULT">{location.name}</Heading>
                  <Flex gap={1}>
                    <IconButton
                      aria-label="Edit"
                      variant="ghost"
                      size="sm"
                      color="fg.muted"
                      _hover={{ color: "fg.DEFAULT", bg: "bg.muted" }}
                      onClick={() => openEditModal(location)}
                    >
                      <FiEdit2 />
                    </IconButton>
                    <IconButton
                      aria-label="Delete"
                      variant="ghost"
                      size="sm"
                      color="error.fg"
                      _hover={{ bg: "error.muted" }}
                      onClick={() => handleDelete(location.id)}
                    >
                      <FiTrash2 />
                    </IconButton>
                  </Flex>
                </Flex>
                {location.blurb && (
                  <Text color="fg.muted" fontStyle="italic" fontSize="sm">
                    {location.blurb}
                  </Text>
                )}
              </Card.Body>
            </Card.Root>
          ))}
        </Grid>
      )}

      <LocationModal
        open={isModalOpen}
        onOpenChange={(open) => setIsModalOpen(open)}
        location={editingLocation}
        onSave={handleSave}
      />
    </Box>
  );
}

interface LocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: Location | null;
  onSave: (data: CreateLocationInput) => Promise<void>;
}

function LocationModal({ open, onOpenChange, location, onSave }: LocationModalProps) {
  const [name, setName] = useState("");
  const [blurb, setBlurb] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(location?.name || "");
      setBlurb(location?.blurb || "");
    }
  }, [open, location]);

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
              {location ? "Edit Location" : "New Location"}
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
                  placeholder="Enter location name"
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
                  placeholder="A brief description of this location"
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
              {location ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}
