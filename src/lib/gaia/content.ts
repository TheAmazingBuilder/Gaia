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
import { z } from "zod";

export { parseInlineSegments, stripInlineMarkers } from "./inline";
export type { InlineSegment } from "./inline";


export const GAIA_BLOCK_TYPES = [
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
  "table",
  "image",
  "divider",
  "ref",
  // Module 1 — Advanced Editor.
  "toggle",
  "columns",
  "equation",
  "drawing",
  "mermaid",
  "embed",
  "toc",
  "synced",
  // Module 3 — File & Document Management : bloc fichier (F06/F09).
  "file",
] as const;

export type GaiaBlockType = (typeof GAIA_BLOCK_TYPES)[number];

export const GAIA_CALLOUT_TONES = ["info", "tip", "warn", "risk"] as const;
export type GaiaCalloutTone = (typeof GAIA_CALLOUT_TONES)[number];

export const GAIA_REF_KINDS = [
  "TRADE",
  "STRATEGY",
  "SETUP",
  "RULE",
  "LESSON",
  "EVENT",
  "SYMBOL",
  "NOTE",
] as const;
export type GaiaRefKind = (typeof GAIA_REF_KINDS)[number];

export const gaiaBlockTypeSchema = z.enum(GAIA_BLOCK_TYPES);
export const gaiaCalloutToneSchema = z.enum(GAIA_CALLOUT_TONES);
export const gaiaRefKindSchema = z.enum(GAIA_REF_KINDS);

/** Limites d'entrée (spec backend §2.2). */
export const GAIA_MAX_BLOCKS = 500;
export const GAIA_MAX_BLOCK_TEXT = 20_000;
export const GAIA_MAX_TABLE_ROWS = 200;
export const GAIA_MAX_TABLE_COLS = 8;
export const GAIA_MAX_IMAGE_SRC = 2_000_000;
/** Module 1 : profondeur max des enfants, enfants max par bloc, colonnes max. */
export const GAIA_MAX_NESTING_DEPTH = 3;
export const GAIA_MAX_CHILDREN = 50;
export const GAIA_MAX_COLUMNS = 3;
export const GAIA_MAX_COMMENTS = 50;

export const GAIA_TABLE_COL_TYPES = ["text", "number", "date", "checkbox"] as const;
export type GaiaTableColType = (typeof GAIA_TABLE_COL_TYPES)[number];
export const gaiaTableColTypeSchema = z.enum(GAIA_TABLE_COL_TYPES);

export const gaiaTableMetaInputSchema = z.object({
  sortBy: z.number().int().min(0).max(GAIA_MAX_TABLE_COLS - 1).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  colTypes: z.array(gaiaTableColTypeSchema).max(GAIA_MAX_TABLE_COLS).optional(),
});

export type GaiaTableMeta = z.infer<typeof gaiaTableMetaInputSchema>;

export const gaiaBlockCommentInputSchema = z.object({
  id: z.string().min(1).max(64),
  author: z.string().max(120).default(""),
  text: z.string().min(1).max(2_000),
  createdAt: z.string().max(40).optional(),
  resolved: z.boolean().optional(),
});

export type GaiaBlockComment = z.infer<typeof gaiaBlockCommentInputSchema>;

export const gaiaBlockRefInputSchema = z.object({
  kind: gaiaRefKindSchema,
  id: z.string().min(1).max(128),
  label: z.string().max(200).optional(),
  meta: z.string().max(200).nullable().optional(),
  href: z.string().max(300).nullable().optional(),
});

/**
 * Schéma récursif (z.lazy) : un bloc porte des `children` et/ou des
 * `columns` qui sont eux-mêmes des blocs. Le type TS est déclaré à la main
 * parce que z.infer ne peut pas s'auto-référencer.
 */
export type GaiaBlockInput = {
  id: string;
  type: GaiaBlockType;
  text: string;
  checked?: boolean;
  tone?: GaiaCalloutTone;
  src?: string;
  alt?: string;
  caption?: string;
  rows?: string[][];
  ref?: z.infer<typeof gaiaBlockRefInputSchema>;
  children?: GaiaBlockInput[];
  columns?: GaiaBlockInput[][];
  collapsed?: boolean;
  syncId?: string;
  comments?: GaiaBlockComment[];
  tableMeta?: GaiaTableMeta;
  /** Module 3 : id du GaiaFile référencé (bloc `file`). */
  fileId?: string;
};

export const gaiaBlockInputSchema: z.ZodType<GaiaBlockInput> = z.lazy(() =>
  z.object({
    id: z.string().min(1).max(64),
    type: gaiaBlockTypeSchema,
    text: z.string().max(GAIA_MAX_BLOCK_TEXT).default(""),
    checked: z.boolean().optional(),
    tone: gaiaCalloutToneSchema.optional(),
    src: z.string().max(GAIA_MAX_IMAGE_SRC).optional(),
    alt: z.string().max(300).optional(),
    caption: z.string().max(300).optional(),
    rows: z
      .array(z.array(z.string().max(2_000)).max(GAIA_MAX_TABLE_COLS))
      .max(GAIA_MAX_TABLE_ROWS)
      .optional(),
    ref: gaiaBlockRefInputSchema.optional(),
    children: z.array(gaiaBlockInputSchema).max(GAIA_MAX_CHILDREN).optional(),
    columns: z
      .array(z.array(gaiaBlockInputSchema).max(GAIA_MAX_CHILDREN))
      .max(GAIA_MAX_COLUMNS)
      .optional(),
    collapsed: z.boolean().optional(),
    syncId: z.string().min(1).max(64).optional(),
    comments: z.array(gaiaBlockCommentInputSchema).max(GAIA_MAX_COMMENTS).optional(),
    tableMeta: gaiaTableMetaInputSchema.optional(),
    fileId: z.string().min(1).max(64).optional(),
  }),
);

export const gaiaBlocksInputSchema = z
  .array(gaiaBlockInputSchema)
  .max(GAIA_MAX_BLOCKS);

export type GaiaBlockRef = {
  kind: GaiaRefKind;
  id: string;
  label?: string;
  meta?: string | null;
  href?: string | null;
};

export type GaiaBlock = {
  id: string;
  type: GaiaBlockType;
  text: string;
  checked?: boolean;
  tone?: GaiaCalloutTone;
  src?: string;
  alt?: string;
  caption?: string;
  rows?: string[][];
  ref?: GaiaBlockRef;
  children?: GaiaBlock[];
  columns?: GaiaBlock[][];
  collapsed?: boolean;
  syncId?: string;
  comments?: GaiaBlockComment[];
  tableMeta?: GaiaTableMeta;
  /** Module 3 : id du GaiaFile référencé (bloc `file`). */
  fileId?: string;
};

export { newBlockId, newSyncId, newCommentId } from "./block-ids";

// ── Formatage riche inline ─────────────────────────────────────────────────
// La syntaxe et le parser vivent dans ./inline.ts (client-safe, sans
// dépendance Node) ; content.ts les ré-exporte pour le serveur.
// ── Parcours récursif ──────────────────────────────────────────────────────
// flattenBlocks + extractHeadings vivent dans ./tree.ts (client-safe) ;
// content.ts les importe (usage local) et les ré-exporte pour le serveur.
export { extractHeadings, flattenBlocks } from "./tree";

// ── Normalisation / relecture ──────────────────────────────────────────────

/**
 * Normalisation à l'écriture : les champs d'affichage du `ref` sont supprimés
 * avant stockage, seuls `kind` + `id` persistent. `label` / `meta` / `href`
 * sont re-résolus côté serveur à chaque lecture. Les enfants et colonnes
 * sont normalisés récursivement (profondeur plafonnée).
 */
export function normalizeBlocks(input: GaiaBlockInput[]): GaiaBlock[] {
  const normalizeOne = (block: GaiaBlockInput, depth: number): GaiaBlock => {
    const out: GaiaBlock = {
      id: block.id,
      type: block.type,
      text: block.text ?? "",
    };
    if (block.checked !== undefined) out.checked = block.checked;
    if (block.tone !== undefined) out.tone = block.tone;
    if (block.src !== undefined) out.src = block.src;
    if (block.alt !== undefined) out.alt = block.alt;
    if (block.caption !== undefined) out.caption = block.caption;
    if (block.rows !== undefined) out.rows = block.rows;
    if (block.ref !== undefined && block.ref !== null) {
      out.ref = { kind: block.ref.kind, id: block.ref.id };
    }
    if (block.collapsed !== undefined) out.collapsed = block.collapsed;
    if (block.syncId !== undefined) out.syncId = block.syncId;
    if (block.comments !== undefined) {
      out.comments = block.comments.map((c) => ({
        id: c.id,
        author: c.author ?? "",
        text: c.text,
        createdAt: c.createdAt ?? new Date().toISOString(),
        resolved: c.resolved ?? false,
      }));
    }
    if (block.tableMeta !== undefined) out.tableMeta = block.tableMeta;
    if (block.fileId !== undefined) out.fileId = block.fileId;
    if (depth < GAIA_MAX_NESTING_DEPTH) {
      if (block.children !== undefined) {
        out.children = block.children.map((child) => normalizeOne(child, depth + 1));
      }
      if (block.columns !== undefined) {
        out.columns = block.columns.map((col) =>
          col.map((child) => normalizeOne(child, depth + 1)),
        );
      }
    }
    return out;
  };
  return input.map((block) => normalizeOne(block, 0));
}

/**
 * Images : protocole restreint. Seules les URL http(s) et les data URL
 * d'images en base64 sont acceptées. Appelée à l'écriture (create / patch).
 */
const SAFE_IMAGE_SRC =
  /^(https?:\/\/|data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,)/i;

export function isSafeImageSrc(src: string | undefined): boolean {
  if (src === undefined) return true;
  return SAFE_IMAGE_SRC.test(src);
}

/** Embeds : seules les URL https sont acceptées. */
export function isSafeEmbedUrl(url: string | undefined): boolean {
  if (url === undefined) return true;
  return /^https:\/\//i.test(url);
}

/**
 * Relecture défensive des blocs stockés : les blocs inconnus ou corrompus
 * sont ignorés (dropped), jamais servis. Récursive (enfants + colonnes).
 */
export function parseStoredBlocks(value: unknown): GaiaBlock[] {
  if (!Array.isArray(value)) return [];
  const parseOne = (entry: unknown, depth: number): GaiaBlock | null => {
    if (typeof entry !== "object" || entry === null) return null;
    const raw = entry as Record<string, unknown>;
    if (typeof raw.id !== "string" || raw.id === "") return null;
    if (
      typeof raw.type !== "string" ||
      !(GAIA_BLOCK_TYPES as readonly string[]).includes(raw.type)
    ) {
      return null;
    }
    const block: GaiaBlock = {
      id: raw.id,
      type: raw.type as GaiaBlockType,
      text: typeof raw.text === "string" ? raw.text : "",
    };
    if (typeof raw.checked === "boolean") block.checked = raw.checked;
    if (
      typeof raw.tone === "string" &&
      (GAIA_CALLOUT_TONES as readonly string[]).includes(raw.tone)
    ) {
      block.tone = raw.tone as GaiaCalloutTone;
    }
    if (typeof raw.src === "string") block.src = raw.src;
    if (typeof raw.alt === "string") block.alt = raw.alt;
    if (typeof raw.caption === "string") block.caption = raw.caption;
    if (
      Array.isArray(raw.rows) &&
      raw.rows.every(
        (row) =>
          Array.isArray(row) &&
          row.every((cell) => typeof cell === "string"),
      )
    ) {
      block.rows = raw.rows as string[][];
    }
    if (typeof raw.ref === "object" && raw.ref !== null) {
      const ref = raw.ref as Record<string, unknown>;
      if (
        typeof ref.kind === "string" &&
        (GAIA_REF_KINDS as readonly string[]).includes(ref.kind) &&
        typeof ref.id === "string" &&
        ref.id !== ""
      ) {
        const resolved: GaiaBlockRef = {
          kind: ref.kind as GaiaRefKind,
          id: ref.id,
        };
        if (typeof ref.label === "string") resolved.label = ref.label;
        if (typeof ref.meta === "string" || ref.meta === null) {
          resolved.meta = ref.meta;
        }
        if (typeof ref.href === "string" || ref.href === null) {
          resolved.href = ref.href;
        }
        block.ref = resolved;
      }
    }
    if (typeof raw.collapsed === "boolean") block.collapsed = raw.collapsed;
    if (typeof raw.syncId === "string" && raw.syncId !== "") {
      block.syncId = raw.syncId;
    }
    if (Array.isArray(raw.comments)) {
      const comments: GaiaBlockComment[] = [];
      for (const c of raw.comments) {
        if (typeof c !== "object" || c === null) continue;
        const cr = c as Record<string, unknown>;
        if (typeof cr.id !== "string" || typeof cr.text !== "string") continue;
        comments.push({
          id: cr.id,
          author: typeof cr.author === "string" ? cr.author : "",
          text: cr.text,
          createdAt: typeof cr.createdAt === "string" ? cr.createdAt : "",
          resolved: cr.resolved === true,
        });
      }
      if (comments.length > 0) block.comments = comments;
    }
    if (typeof raw.tableMeta === "object" && raw.tableMeta !== null) {
      const tm = raw.tableMeta as Record<string, unknown>;
      const meta: GaiaTableMeta = {};
      if (typeof tm.sortBy === "number") meta.sortBy = tm.sortBy;
      if (tm.sortDir === "asc" || tm.sortDir === "desc") meta.sortDir = tm.sortDir;
      if (
        Array.isArray(tm.colTypes) &&
        tm.colTypes.every(
          (ct) =>
            typeof ct === "string" &&
            (GAIA_TABLE_COL_TYPES as readonly string[]).includes(ct),
        )
      ) {
        meta.colTypes = tm.colTypes as GaiaTableColType[];
      }
      if (Object.keys(meta).length > 0) block.tableMeta = meta;
    }
    if (depth < GAIA_MAX_NESTING_DEPTH) {
      if (Array.isArray(raw.children)) {
        const children: GaiaBlock[] = [];
        for (const child of raw.children) {
          const parsed = parseOne(child, depth + 1);
          if (parsed) children.push(parsed);
        }
        if (children.length > 0) block.children = children;
      }
      if (Array.isArray(raw.columns)) {
        const columns: GaiaBlock[][] = [];
        for (const col of raw.columns) {
          if (!Array.isArray(col)) continue;
          const parsedCol: GaiaBlock[] = [];
          for (const child of col) {
            const parsed = parseOne(child, depth + 1);
            if (parsed) parsedCol.push(parsed);
          }
          columns.push(parsedCol);
        }
        if (columns.length > 0) block.columns = columns;
      }
    }
    return block;
  };
  const out: GaiaBlock[] = [];
  for (const entry of value) {
    const parsed = parseOne(entry, 0);
    if (parsed) out.push(parsed);
  }
  return out;
}

/** Parse une colonne JSON String du repo (défaut [] si vide ou corrompue). */
export function parseJsonBlocks(stored: string | null | undefined): GaiaBlock[] {
  if (!stored) return [];
  try {
    return parseStoredBlocks(JSON.parse(stored));
  } catch {
    return [];
  }
}

export function parseJsonStringArray(
  stored: string | null | undefined,
): string[] {
  if (!stored) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

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
import {
  textOfBlocks,
  wordCountOf,
  countWords,
  countChars,
  readingTimeMinutes,
  countOpenTodos,
  excerptOf,
  searchSnippet,
} from "./text";
