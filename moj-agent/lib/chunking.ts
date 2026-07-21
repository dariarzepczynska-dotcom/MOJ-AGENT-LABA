function splitLongPart(part: string, chunkSize: number) {
  const chunks: string[] = [];

  for (let start = 0; start < part.length; start += chunkSize) {
    chunks.push(part.slice(start, start + chunkSize).trim());
  }

  return chunks.filter(Boolean);
}

export function splitIntoChunks(
  text: string,
  chunkSize = 500,
  overlap = 50,
): string[] {
  if (!Number.isFinite(chunkSize) || chunkSize < 1) {
    throw new Error("chunkSize musi być większy od zera.");
  }

  if (!Number.isFinite(overlap) || overlap < 0 || overlap >= chunkSize) {
    throw new Error("overlap musi być nieujemny i mniejszy niż chunkSize.");
  }

  const normalized = text.replace(/\r\n?/g, "\n").trim();

  if (!normalized) {
    return [];
  }

  const sentenceParts =
    normalized.match(/[^.!?\n]+(?:[.!?]+|\n+|$)/g)?.map((part) => part.trim()) ??
    [normalized];
  const parts = sentenceParts.flatMap((part) =>
    part.length > chunkSize ? splitLongPart(part, chunkSize) : [part],
  );
  const chunks: string[] = [];
  let current = "";

  for (const part of parts) {
    const candidate = current ? `${current} ${part}` : part;

    if (candidate.length <= chunkSize || !current) {
      current = candidate;
      continue;
    }

    chunks.push(current.trim());
    const overlapText = overlap > 0 ? current.slice(-overlap).trimStart() : "";
    current = overlapText ? `${overlapText} ${part}` : part;
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}
