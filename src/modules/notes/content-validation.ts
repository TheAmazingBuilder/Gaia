import {
  flattenBlocks,
  isSafeEmbedUrl,
  isSafeImageSrc,
  type GaiaBlock,
} from "@/lib/gaia/content";

type ValidationError = (message: string) => never;

/**
 * Reject image/drawing sources with unsupported protocols and embeds that
 * do not use HTTPS. Nested block trees are validated recursively.
 */
export function assertSafeImageSources(
  blocks: GaiaBlock[],
  validationError: ValidationError,
): void {
  for (const block of flattenBlocks(blocks)) {
    if (
      (block.type === "image" || block.type === "drawing") &&
      !isSafeImageSrc(block.src)
    ) {
      throw validationError("Image source not allowed.");
    }
    if (block.type === "embed" && !isSafeEmbedUrl(block.text)) {
      throw validationError("Embed URL must use https.");
    }
  }
}
