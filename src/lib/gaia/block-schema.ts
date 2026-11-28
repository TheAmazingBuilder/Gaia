import { z } from "zod";

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
