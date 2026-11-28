/**
 * Gaïa : contenu des notes (blocs).
 *
 * Principe : BLOCK JSON, never HTML. L'éditeur parle JSON de blocs ; rien
 * n'accepte de HTML brut, donc aucune sanitisation HTML côté serveur : la
 * charge est validée par schéma (vocabulaire fermé + plafonds de taille).
 * Contrairement à Euforia, les fonctions pures définies ici sont APPELÉES
 * par le code serveur (isSafeImageSrc à l'écriture, parseStoredBlocks à la
 * relecture, normalizeBlocks avant stockage).
 *
 * Module 1 — Advanced Editor (26 Nov 2026) :
 * - 8 nouveaux types : toggle, columns, equation, drawing, mermaid, embed,
 *   toc, synced.
 * - Blocs imbriqués : `children` (profondeur max 3) et `columns`
 *   (2–3 colonnes de blocs) ; les helpers de parcours sont récursifs.
 * - Formatage riche inline dans `text` : **gras**, *italique*,
 *   __souligné__, ~~barré~~, ==surligné==, `code`, [#RRGGBB]couleur[/].
 *   Le texte reste du texte brut (jamais de HTML) ; `parseInlineSegments`
 *   le découpe en segments pour le rendu, `stripInlineMarkers` l'épure
 *   pour les comptes de mots.
 * - Commentaires par bloc (`comments`) et métadonnées de tableau
 *   (`tableMeta` : tri, types de colonnes).
 */
export { parseInlineSegments, stripInlineMarkers } from "./inline";
export type { InlineSegment } from "./inline";


export { GAIA_BLOCK_TYPES, GAIA_CALLOUT_TONES, GAIA_REF_KINDS, gaiaBlockTypeSchema, gaiaCalloutToneSchema, gaiaRefKindSchema, GAIA_MAX_BLOCKS, GAIA_MAX_BLOCK_TEXT, GAIA_MAX_TABLE_ROWS, GAIA_MAX_TABLE_COLS, GAIA_MAX_IMAGE_SRC, GAIA_MAX_NESTING_DEPTH, GAIA_MAX_CHILDREN, GAIA_MAX_COLUMNS, GAIA_MAX_COMMENTS, GAIA_TABLE_COL_TYPES, gaiaTableColTypeSchema, gaiaTableMetaInputSchema, gaiaBlockCommentInputSchema, gaiaBlockRefInputSchema, gaiaBlockInputSchema, gaiaBlocksInputSchema } from "./block-schema";

export type { GaiaBlockType, GaiaCalloutTone, GaiaRefKind, GaiaTableColType, GaiaTableMeta, GaiaBlockComment, GaiaBlockInput, GaiaBlockRef, GaiaBlock } from "./block-schema";

export { newBlockId, newSyncId, newCommentId } from "./block-ids";

// ── Formatage riche inline ─────────────────────────────────────────────────
// La syntaxe et le parser vivent dans ./inline.ts (client-safe, sans
// dépendance Node) ; content.ts les ré-exporte pour le serveur.
// ── Parcours récursif ──────────────────────────────────────────────────────
// flattenBlocks + extractHeadings vivent dans ./tree.ts (client-safe) ;
// content.ts les importe (usage local) et les ré-exporte pour le serveur.
export { extractHeadings, flattenBlocks } from "./tree";

// ── Normalisation / relecture ──────────────────────────────────────────────


export { isSafeImageSrc, isSafeEmbedUrl } from "./block-safety";

export { normalizeBlocks, parseStoredBlocks, parseJsonBlocks } from "./block-serialization";

export { parseJsonStringArray } from "./json";

export {
  textOfBlocks,
  wordCountOf,
  countWords,
  countChars,
  readingTimeMinutes,
  countOpenTodos,
  excerptOf,
  searchSnippet,
} from "./text";
