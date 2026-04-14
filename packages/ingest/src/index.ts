import type { IngestItem } from "@namera/core";

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
  }));
}

function normalizeInputName(name: string): string {
  return name.replace(/^\.\//, "").trim();
}
