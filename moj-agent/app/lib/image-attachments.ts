"use client";

import { ChangeEvent, DragEvent, ClipboardEvent, RefObject, useRef, useState } from "react";

export const maxImageBytes = 4 * 1024 * 1024;

const acceptedImageTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
]);

export type AttachedImage = {
  dataUrl: string;
  mimeType: string;
  name: string;
  size: number;
};

function isAcceptedImage(file: File) {
  return acceptedImageTypes.has(file.type.toLowerCase());
}

function validateImageFile(file: File) {
  if (!isAcceptedImage(file)) {
    return "Akceptuje tylko PNG, JPG, JPEG, GIF albo WEBP.";
  }

  if (file.size > maxImageBytes) {
    return "Max 4MB. Zrob screenshot fragmentu.";
  }

  return "";
}

function readImageFile(file: File): Promise<AttachedImage> {
  return new Promise((resolve, reject) => {
    const validationError = validateImageFile(file);

    if (validationError) {
      reject(new Error(validationError));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Nie udalo sie odczytac obrazu."));
        return;
      }

      resolve({
        dataUrl: reader.result,
        mimeType: file.type,
        name: file.name || "Screenshot",
        size: file.size,
      });
    };
    reader.onerror = () => reject(new Error("Nie udalo sie odczytac obrazu."));
    reader.readAsDataURL(file);
  });
}

function findImageFile(files: FileList | File[]) {
  return Array.from(files).find((file) => file.type.startsWith("image/"));
}

export function useImageAttachment() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(null);
  const [imageError, setImageError] = useState("");
  const [isDraggingImage, setIsDraggingImage] = useState(false);

  const attachFile = async (file: File) => {
    try {
      setImageError("");
      setAttachedImage(await readImageFile(file));
    } catch (error) {
      setImageError(
        error instanceof Error ? error.message : "Nie udalo sie dodac obrazu.",
      );
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLElement>) => {
    const items = Array.from(event.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith("image/"));

    if (!imageItem) {
      return;
    }

    const file = imageItem.getAsFile();

    if (!file) {
      return;
    }

    event.preventDefault();
    void attachFile(file);
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      void attachFile(file);
    }

    event.target.value = "";
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (!Array.from(event.dataTransfer.items).some((item) => item.type.startsWith("image/"))) {
      return;
    }

    event.preventDefault();
    setIsDraggingImage(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDraggingImage(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    const file = findImageFile(event.dataTransfer.files);

    if (!file) {
      setIsDraggingImage(false);
      return;
    }

    event.preventDefault();
    setIsDraggingImage(false);
    void attachFile(file);
  };

  return {
    attachedImage,
    imageError,
    isDraggingImage,
    fileInputRef: fileInputRef as RefObject<HTMLInputElement>,
    attachFile,
    clearImage: () => setAttachedImage(null),
    openFilePicker: () => fileInputRef.current?.click(),
    handlePaste,
    handleFileInputChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    setImageError,
  };
}
