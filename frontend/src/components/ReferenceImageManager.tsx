import { useState, useRef, useCallback, useEffect } from "react";
import {
  Box,
  Button,
  Flex,
  Grid,
  IconButton,
  Input,
  Text,
  VStack,
  Spinner,
  Image,
  Badge,
} from "@chakra-ui/react";
import { FiUpload, FiTrash2, FiDownload, FiImage } from "react-icons/fi";
import { toaster } from "./ui/toaster";
import { referenceImagesApi } from "../api/client";
import type { ReferenceImage } from "../types";

interface ReferenceImageManagerProps {
  entityType: "characters" | "world-styles";
  entityId: number;
  entityName: string;
}

export function ReferenceImageManager({
  entityType,
  entityId,
  entityName,
}: ReferenceImageManagerProps) {
  const [images, setImages] = useState<ReferenceImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captionTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const loadImages = useCallback(async () => {
    try {
      setLoading(true);
      const data =
        entityType === "characters"
          ? await referenceImagesApi.listForCharacter(entityId)
          : await referenceImagesApi.listForWorldStyle(entityId);
      setImages(data);
    } catch (err) {
      toaster.error({
        title: "Failed to load images",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  useEffect(() => {
    return () => {
      Object.values(captionTimers.current).forEach(clearTimeout);
    };
  }, []);

  async function handleFiles(files: FileList | File[]) {
    const imageFiles = Array.from(files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (imageFiles.length === 0) {
      toaster.error({ title: "Please select image files" });
      return;
    }

    try {
      setUploading(true);
      const uploadFn =
        entityType === "characters"
          ? referenceImagesApi.uploadForCharacter
          : referenceImagesApi.uploadForWorldStyle;
      await uploadFn(entityId, imageFiles);
      toaster.success({
        title: `${imageFiles.length} image${imageFiles.length > 1 ? "s" : ""} uploaded`,
      });
      await loadImages();
    } catch (err) {
      toaster.error({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setUploading(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }

  function handleCaptionChange(imageId: number, newCaption: string) {
    setImages((prev) =>
      prev.map((img) =>
        img.id === imageId ? { ...img, caption: newCaption } : img
      )
    );

    if (captionTimers.current[imageId]) {
      clearTimeout(captionTimers.current[imageId]);
    }

    captionTimers.current[imageId] = setTimeout(async () => {
      try {
        await referenceImagesApi.updateCaption(imageId, newCaption, entityType);
      } catch (err) {
        toaster.error({
          title: "Failed to save caption",
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }, 600);
  }

  async function handleDelete(imageId: number) {
    try {
      const deleteFn =
        entityType === "characters"
          ? referenceImagesApi.deleteCharacterImage
          : referenceImagesApi.deleteWorldStyleImage;
      await deleteFn(imageId);
      setImages((prev) => prev.filter((img) => img.id !== imageId));
      toaster.success({ title: "Image removed" });
    } catch (err) {
      toaster.error({
        title: "Failed to delete",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  function handleDownloadZip() {
    referenceImagesApi.downloadLoraZip(entityType, entityId);
  }

  if (loading) {
    return (
      <Flex justify="center" py={6}>
        <Spinner size="sm" color="accent.DEFAULT" />
      </Flex>
    );
  }

  return (
    <VStack gap={3} align="stretch" width="100%">
      {/* Header */}
      <Flex justify="space-between" align="center">
        <Flex align="center" gap={2}>
          <Text fontSize="sm" fontWeight="600" color="fg.DEFAULT">
            Reference Images
          </Text>
          <Badge
            bg="bg.muted"
            color="fg.muted"
            fontSize="xs"
            px={1.5}
            borderRadius="full"
          >
            {images.length}
          </Badge>
        </Flex>
        {images.length > 0 && (
          <Button
            size="xs"
            variant="outline"
            borderColor="border.DEFAULT"
            color="fg.muted"
            _hover={{ borderColor: "border.strong", color: "fg.DEFAULT" }}
            onClick={handleDownloadZip}
          >
            <FiDownload /> LoRA ZIP
          </Button>
        )}
      </Flex>

      {/* Drop zone */}
      <Box
        borderWidth="2px"
        borderStyle="dashed"
        borderColor={isDragOver ? "accent.DEFAULT" : "border.DEFAULT"}
        borderRadius="lg"
        bg={isDragOver ? "accent.muted" : "bg.subtle"}
        py={4}
        px={4}
        textAlign="center"
        cursor="pointer"
        transition="all 0.2s"
        _hover={{ borderColor: "border.strong", bg: "bg.muted" }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {uploading ? (
          <Flex justify="center" align="center" gap={2}>
            <Spinner size="sm" color="accent.DEFAULT" />
            <Text fontSize="sm" color="fg.muted">
              Uploading...
            </Text>
          </Flex>
        ) : (
          <VStack gap={1}>
            <FiUpload size={20} color="var(--chakra-colors-fg-muted)" />
            <Text fontSize="sm" color="fg.muted">
              Drop images here or click to browse
            </Text>
          </VStack>
        )}
      </Box>

      {/* Image grid */}
      {images.length > 0 && (
        <Grid
          templateColumns="repeat(auto-fill, minmax(180px, 1fr))"
          gap={3}
        >
          {images.map((img) => (
            <Box
              key={img.id}
              borderWidth="1px"
              borderColor="border.DEFAULT"
              borderRadius="lg"
              overflow="hidden"
              bg="bg.panel"
              transition="all 0.2s"
              _hover={{ borderColor: "border.strong", shadow: "sm" }}
            >
              {/* Thumbnail */}
              <Box position="relative" bg="bg.muted" minH="120px">
                <Image
                  src={referenceImagesApi.getImageUrl(
                    entityType,
                    entityId,
                    img.filename
                  )}
                  alt={img.caption || img.originalFilename}
                  width="100%"
                  height="120px"
                  objectFit="cover"
                />
                <IconButton
                  aria-label="Delete image"
                  size="xs"
                  variant="solid"
                  bg="error.DEFAULT"
                  color="white"
                  _hover={{ bg: "error.fg" }}
                  position="absolute"
                  top={1}
                  right={1}
                  borderRadius="full"
                  onClick={() => handleDelete(img.id)}
                >
                  <FiTrash2 size={12} />
                </IconButton>
              </Box>

              {/* Caption input */}
              <Box p={2}>
                <Input
                  size="sm"
                  value={img.caption}
                  onChange={(e) =>
                    handleCaptionChange(img.id, e.target.value)
                  }
                  placeholder={`Caption for ${entityName}...`}
                  bg="bg.subtle"
                  borderColor="border.DEFAULT"
                  fontSize="xs"
                  _hover={{ borderColor: "border.strong" }}
                  _focus={{
                    borderColor: "accent.DEFAULT",
                    boxShadow: "none",
                  }}
                  _placeholder={{ color: "fg.subtle" }}
                />
                <Text
                  fontSize="2xs"
                  color="fg.subtle"
                  mt={1}
                  truncate
                  title={img.originalFilename}
                >
                  {img.originalFilename}
                </Text>
              </Box>
            </Box>
          ))}
        </Grid>
      )}

      {/* Empty state */}
      {images.length === 0 && (
        <Flex
          justify="center"
          align="center"
          gap={2}
          py={2}
          color="fg.subtle"
        >
          <FiImage size={14} />
          <Text fontSize="xs">
            No reference images yet — upload some for LoRA training
          </Text>
        </Flex>
      )}
    </VStack>
  );
}
