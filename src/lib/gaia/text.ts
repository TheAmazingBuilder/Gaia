import type { GaiaBlock } from "./block-schema";
import { stripInlineMarkers } from "./inline";
import { flattenBlocks } from "./tree";

const TEXT_BEARING = new Set([
  "paragraph",
  "h1",
  "h2",
  "h3",
  "bullet",
  "numbered",
  "todo",
  "quote",
  "callout",
  "code",
  "toggle",
  "equation",
  "mermaid",
  "synced",
]);

export function textOfBlocks(blocks: GaiaBlock[]): string {
  const parts: string[] = [];
  for (const block of flattenBlocks(blocks)) {
    if (TEXT_BEARING.has(block.type) && block.text.trim() !== "") {
      parts.push(stripInlineMarkers(block.text).trim());
    }
    if (block.type === "table" && block.rows) {
      for (const row of block.rows) parts.push(row.join(" | "));
    }
    if (block.type === "image" && block.caption) parts.push(block.caption);
    if (block.type === "drawing" && block.caption) parts.push(block.caption);
    if (block.type === "embed" && block.text.trim() !== "") {
      parts.push(block.text.trim());
    }
  }
  return parts.join("\n");
}

export function wordCountOf(text: string): number {
  return stripInlineMarkers(text)
    .split(/\s+/)
    .filter((word) => word !== "").length;
}

export function countWords(blocks: GaiaBlock[]): number {
  return wordCountOf(textOfBlocks(blocks));
}

/** Nombre de caractères (espaces exclus), pour le compteur avancé (E11). */
export function countChars(blocks: GaiaBlock[]): number {
  return textOfBlocks(blocks).replace(/\s+/g, "").length;
}

/** Temps de lecture estimé en minutes (200 mots/minute). */
export function readingTimeMinutes(words: number): number {
  return Math.max(1, Math.ceil(words / 200));
}

export function countOpenTodos(blocks: GaiaBlock[]): number {
  return flattenBlocks(blocks).filter(
    (block) => block.type === "todo" && !block.checked,
  ).length;
}

/** Extrait d'environ 180 caractères tiré des premiers blocs porteurs de texte. */
export function excerptOf(blocks: GaiaBlock[]): string {
  const text = textOfBlocks(blocks).replace(/\n+/g, " · ");
  return text.length > 180 ? `${text.slice(0, 177)}…` : text;
}

/**
 * Snippet de recherche centré sur le premier hit plein texte (60 caractères
 * avant, 80 après la fin du hit), ou l'extrait quand seuls le titre ou les
 * tags ont matché.
 */
export function searchSnippet(blocks: GaiaBlock[], query: string): string {
  const fullText = textOfBlocks(blocks);
  const index = fullText.toLowerCase().indexOf(query);
  if (index === -1) return excerptOf(blocks);
  const start = Math.max(0, index - 60);
  const end = Math.min(fullText.length, index + query.length + 80);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < fullText.length ? "…" : "";
  return `${prefix}${fullText.slice(start, end).replace(/\n+/g, " ")}${suffix}`;
}
