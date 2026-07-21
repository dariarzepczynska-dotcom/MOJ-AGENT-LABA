"use client";

import type { AttachedImage } from "../lib/image-attachments";

type ImageAttachmentPreviewProps = {
  image: AttachedImage;
  onRemove: () => void;
  className?: string;
};

export function ImageAttachmentPreview({
  image,
  onRemove,
  className = "",
}: ImageAttachmentPreviewProps) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-[#2f403b] bg-[#091310] p-3 ${className}`}
    >
      <img
        src={image.dataUrl}
        alt={image.name}
        className="max-h-[120px] w-auto max-w-[160px] rounded-md border border-[#3d514b] object-contain"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#dce7e2]">
          📎 Screenshot - zadaj pytanie o ten obraz
        </p>
        <p className="mt-1 truncate text-xs text-[#8fa39c]">{image.name}</p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Usun obraz"
        className="h-8 w-8 rounded-lg border border-[#4b2a2a] text-sm font-semibold text-[#fecaca] transition hover:border-[#ef4444] hover:bg-[#2a0d0d]"
      >
        X
      </button>
    </div>
  );
}
