import type { IngestItem } from "@namera/core";

const MEDIA_EXTENSIONS = new Set(["mkv", "mp4", "avi", "mov", "m4v", "mp3", "flac", "wav", "srt", "ass", "ssa", "vtt", "sub", "idx"]);

export function parseTextIngest(input: string): IngestItem[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((name) => ({
      source: "text",
      name: normalizeInputName(name),
    }));
}

export async function parseFileListIngest(files: Iterable<File>): Promise<IngestItem[]> {
  return Array.from(files, (file) => ({
    source: "file",
    name: normalizeInputName(file.name),
    size: file.size,
    pathHint: file.webkitRelativePath || file.name,
  })).filter((item) => looksLikeMediaFile(item.name));
}

export function looksLikeMediaFile(name: string): boolean {
  const extension = name.split(".").pop()?.toLowerCase();
  return Boolean(extension && MEDIA_EXTENSIONS.has(extension));
}

function normalizeInputName(name: string): string {
  return name.replace(/^\.\//, "").trim();
}
