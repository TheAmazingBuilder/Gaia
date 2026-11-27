/**
 * Gaïa : workspace de notes, accès données côté serveur (userId-scoped).
 *
 * Réplique du service Nofy d'Euforia, adaptée aux tables Prisma de Promethe
 * (Note / NoteFolder / NoteTag / NoteTemplate / NoteVersion). Aucun contenu
 * de démonstration : le workspace démarre vide, l'utilisateur crée ses
 * propres dossiers, tags et notes. L'accès inter-utilisateur est rendu
 * comme un 404.
 */
import { NextResponse } from "next/server";
import {
  gaiaNotePropertySchema,
  noteCreateInputSchema,
  noteUpdateInputSchema,
  noteDuplicateInputSchema,
} from "@/modules/notes/schemas";
export { gaiaNotePropertySchema } from "@/modules/notes/schemas";
import type {
  GaiaNoteDTO,
  GaiaNoteProperty,
  GaiaNotePropertyType,
  GaiaNoteResponse,
  GaiaNoteRow,
  GaiaVersionDetail,
  GaiaVersionSummary,
  GaiaTemplateDTO,
} from "@/modules/notes/types";
export type {
  GaiaNoteDTO,
  GaiaNoteProperty,
  GaiaNotePropertyType,
  GaiaNoteResponse,
  GaiaNoteRow,
  GaiaVersionDetail,
  GaiaVersionSummary,
  GaiaTemplateDTO,
} from "@/modules/notes/types";
import type {
  InboxItem,
  KnowledgeCanvas,
  Note,
  NoteFolder,
  NoteTag,
  NoteVersion,
  Prisma,
  SmartCollection,
} from "@prisma/client";
import type {
  GaiaFileAnnotationDTO,
  GaiaFileDTO,
  GaiaFileDetailDTO,
  GaiaFileVersionDTO,
  GaiaStorageUsageDTO,
} from "@/modules/files/types";
export type {
  GaiaFileAnnotationDTO,
  GaiaFileDTO,
  GaiaFileDetailDTO,
  GaiaFileVersionDTO,
  GaiaStorageUsageDTO,
} from "@/modules/files/types";
import { z } from "zod";
import { fileAnnotationInputSchema, fileTextInputSchema, fileUpdateInputSchema } from "@/modules/files/schemas";
import { fileToDTO } from "@/modules/files/mappers";
import {
  createFileAnnotationCommand,
  deleteFileAnnotationCommand,
  saveFileTextCommand,
  updateFileCommand,
} from "@/modules/files/services/commands";
import {
  attachFileToNoteCommand,
  detachFileFromNoteCommand,
  listFileNotesQuery,
  listNoteFilesQuery,
} from "@/modules/files/services/associations";
import {
  deleteFileCommand,
  replaceFileCommand,
  restoreFileVersionCommand,
} from "@/modules/files/services/lifecycle";
import {
  getFileQuery,
  getStorageUsageQuery,
  listFilesQuery,
  type ListFilesParams,
} from "@/modules/files/services/queries";
export type { ListFilesParams } from "@/modules/files/services/queries";

import type { GaiaNoteRelationDTO } from "@/modules/knowledge/types";
import {
  createNoteRelationCommand,
  deleteNoteRelationCommand,
  listNoteRelationsQuery,
} from "@/modules/knowledge/services/relations";
import { db } from "@/lib/db";
import {
  purgeNoteCommand,
  restoreNoteCommand,
  trashNoteCommand,
} from "@/modules/notes/services/lifecycle";
import { createNoteCommand, duplicateNoteCommand } from "@/modules/notes/services/commands";
import {
  createTemplateCommand,
  findTemplateQuery,
  instantiateTemplateCommand,
  listTemplatesQuery,
} from "@/modules/notes/services/templates";
import { updateNoteCommand } from "@/modules/notes/services/update";
import { getNoteQuery } from "@/modules/notes/services/details";
import {
  createFolderCommand,
  deleteFolderCommand,
  listFoldersQuery,
  updateFolderCommand,
  type GaiaFolderInput,
} from "@/modules/notes/services/folders";
import {
  createTagCommand,
  deleteTagCommand,
  listTagsQuery,
  updateTagCommand,
} from "@/modules/notes/services/tags";
import { listNotesQuery, loadBlocksFor, NOTE_LIST_SELECT, type NoteListRow, type NoteRowInput } from "@/modules/notes/services/list";
import type { GaiaListQuery } from "@/modules/notes/types";
export type { GaiaListQuery } from "@/modules/notes/types";
import { getVersionQuery, listVersionsQuery, restoreVersionCommand } from "@/modules/notes/services/versions";
import {
  getTodayWordsQuery,
  getWritingSettingsQuery,
  updateWritingSettingsCommand,
  type GaiaTodayWords,
  type GaiaWritingSettings,
} from "@/modules/notes/services/writing";
import {
  moveNoteToMasteryCommand,
  reviewNoteCommand,
  scheduleNoteCommand,
} from "@/modules/notes/services/review";
import {
  countOpenTodos,
  countWords,
  excerptOf,
  flattenBlocks,
  gaiaBlocksInputSchema,
  gaiaRefKindSchema,
  isSafeEmbedUrl,
  isSafeImageSrc,
  newBlockId,
  newSyncId,
  normalizeBlocks,
  parseJsonBlocks,
  parseJsonStringArray,
  searchSnippet,
  textOfBlocks,
  type GaiaBlock,
  type GaiaRefKind,
} from "@/lib/gaia/content";
import { listRefs as listRefsRaw, resolveNoteRefs, type GaiaRefHit } from "@/lib/gaia/refs";
import {
  isMasteryLevel,
  isTimePeriod,
  MASTERY_VALUE,
  periodOf,
  type MasteryLevel,
  type TimePeriod,
} from "@/lib/gaia/spaced-repetition";
import {
  shouldSnapshot,
  sortVersionsNewestFirst,
  versionsBeyondCap,
} from "@/lib/gaia/versioning";
import {
  buildTree,
  dailyNoteTitle,
  descendantIds,
  isDescendantOf,
  matchCollectionCriteria,
  suggestLinks,
  tokenize,
  weeklyNoteTitle,
  weekStart,
  type KnowledgeCollectionCriteria,
} from "@/lib/gaia/knowledge";
import { GAIA_MAX_FILE_BYTES } from "@/lib/gaia/files";
import {
  downloadFromStorage,
  getStorageClient,
  isStorageConfigured,
  removeFromStorage,
  storagePathFor,
  uploadToStorage,
} from "@/server/storage";

/* ── Erreurs ─────────────────────────────────────────────────────────── */

export class GaiaError extends Error {
  readonly error: string;
  readonly code: string;
  readonly status: number;
  readonly issues?: { path: string; message: string }[];
  constructor(
    error: string,
    code: string,
    status: number,
    message: string,
    issues?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = "GaiaError";
    this.error = error;
    this.code = code;
    this.status = status;
    this.issues = issues;
  }
}

function notFound(code: string, message: string): GaiaError {
  return new GaiaError("NotFound", code, 404, message);
}

function validationError(
  message: string,
  issues?: { path: string; message: string }[],
): GaiaError {
  return new GaiaError("ValidationError", "VALIDATION", 422, message, issues);
}

function conflictError(code: string, message: string): GaiaError {
  return new GaiaError("Conflict", code, 409, message);
}

const NOTE_NOT_FOUND = () => notFound("NOTE_NOT_FOUND", "Note not found.");
const FOLDER_NOT_FOUND = () => notFound("FOLDER_NOT_FOUND", "Folder not found.");
const TEMPLATE_NOT_FOUND = () => notFound("TEMPLATE_NOT_FOUND", "Template not found.");
const VERSION_NOT_FOUND = () => notFound("VERSION_NOT_FOUND", "Version not found.");
const FILE_NOT_FOUND = () => notFound("FILE_NOT_FOUND", "File not found.");
const STORAGE_NOT_CONFIGURED = () =>
  new GaiaError(
    "ServiceUnavailable",
    "STORAGE_NOT_CONFIGURED",
    503,
    "File storage is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to the environment.",
  );

/**
 * Convertit une GaiaError en réponse HTTP ({ error, code?, message?, issues? }).
 * Retourne null pour les autres erreurs (à passer à apiError).
 */
export function gaiaErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof GaiaError)) return null;
  return NextResponse.json(
    {
      error: error.error,
      code: error.code,
      message: error.message,
      ...(error.issues ? { issues: error.issues } : {}),
    },
    { status: error.status },
  );
}

/* ── Schémas d'entrée ────────────────────────────────────────────────── */


/* ── Module 2 — Knowledge Management System (K01–K17) ─────────────── */

export const gaiaCollectionCriteriaSchema = z.object({
  folderId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).max(24).optional(),
  mastery: z.string().max(20).optional(),
  favorite: z.boolean().optional(),
  q: z.string().max(200).optional(),
  properties: z
    .array(
      z.object({ key: z.string().min(1).max(40), value: z.string().max(500) }),
    )
    .max(12)
    .optional(),
});

const canvasItemSchema = z.object({
  noteId: z.string().min(1),
  x: z.number().min(-100).max(5000),
  y: z.number().min(-100).max(5000),
  w: z.number().min(120).max(1200).optional(),
  h: z.number().min(80).max(1200).optional(),
});

const collectionInputSchema = z.object({
  name: z.string().min(1).max(120),
  icon: z.string().max(16).optional(),
  criteria: gaiaCollectionCriteriaSchema.optional(),
});

const canvasInputSchema = z.object({
  name: z.string().min(1).max(120),
  items: z.array(canvasItemSchema).max(200).optional(),
});

const inboxInputSchema = z.object({ text: z.string().min(1).max(2000) });

const folderInputSchema = z.object({
  name: z.string().min(1).max(80),
  parentId: z.string().nullable().optional(),
});

const tagInputSchema = z.object({
  name: z.string().max(80),
  parentId: z.string().nullable().optional(),
  relatedIds: z.array(z.string()).max(24).optional(),
});

type SafeParser<T> = {
  safeParse: (
    input: unknown,
  ) =>
    | { success: true; data: T }
    | { success: false; error: z.ZodError };
};

function parseOrThrow<T>(schema: SafeParser<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw validationError(
      "Some fields are invalid.",
      parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }
  return parsed.data;
}

/**
 * Rejette les blocs image/dessin dont le src utilise un protocole non
 * autorisé, et les embeds dont l'URL n'est pas https. Récursif (Module 1).
 */
function assertSafeImageSources(blocks: GaiaBlock[]): void {
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

/* ── Types de réponse ────────────────────────────────────────────────── */

export type GaiaFolderDTO = NoteFolder & { noteCount: number };
export type GaiaTagDTO = NoteTag & { noteCount: number };

/* ── Module 2 — Knowledge Management System : types de réponse ─────── */

export type GaiaNoteLinkItem = {
  id: string;
  title: string;
  via: "ref" | "relation";
  relationType?: string;
};

export type GaiaUnlinkedMention = {
  id: string;
  title: string;
  snippet: string;
};

export type GaiaNoteLinksResponse = {
  outgoing: GaiaNoteLinkItem[];
  backlinks: GaiaNoteRow[];
  unlinkedMentions: GaiaUnlinkedMention[];
  relations: GaiaNoteRelationDTO[];
};

export type GaiaLinkSuggestion = {
  id: string;
  title: string;
  score: number;
  sharedWords: string[];
};

export type GaiaSmartCollectionDTO = {
  id: string;
  name: string;
  icon: string;
  criteria: KnowledgeCollectionCriteria;
  noteCount: number;
  createdAt: string;
  updatedAt: string;
};

export type GaiaCanvasItemDTO = {
  noteId: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
};

export type GaiaCanvasDTO = {
  id: string;
  name: string;
  items: GaiaCanvasItemDTO[];
  createdAt: string;
  updatedAt: string;
};

export type GaiaInboxItemDTO = {
  id: string;
  text: string;
  doneAt: string | null;
  noteId: string | null;
  createdAt: string;
};

export type GaiaKnowledgeTimelineMonth = {
  month: string;
  created: number;
  edited: number;
  relations: number;
  notes: Array<{ id: string; title: string; mastery: MasteryLevel; createdAt: string }>;
};

export type GaiaActivityWeek = { weekStart: string; created: number; edited: number };

export type GaiaOverviewResponse = {
  totals: {
    notes: number;
    createdThisWeek: number;
    favorites: number;
    folders: number;
    tags: number;
    trashed: number;
  };
  recentEdited: GaiaNoteRow[];
  recentViewed: GaiaNoteRow[];
  favorites: GaiaNoteRow[];
  folders: GaiaFolderDTO[];
  topTags: GaiaTagDTO[];
  activity: GaiaActivityWeek[];
  templates: GaiaTemplateDTO[];
};

/* ── Helpers ─────────────────────────────────────────────────────────── */

function normalizeTagName(name: string): string {
  return name.trim().replace(/^#/, "");
}

function nameKeyOf(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Clone profond avec nouveaux ids. Les groupes synchronisés sont
 * re-liés entre eux dans la copie (même ancien syncId → même nouveau
 * syncId) mais coupés de l'original : une note dupliquée est indépendante.
 */
function cloneBlocksWithNewIds(blocks: GaiaBlock[]): GaiaBlock[] {
  const syncMap = new Map<string, string>();
  const cloneOne = (block: GaiaBlock): GaiaBlock => {
    const next: GaiaBlock = { ...block, id: newBlockId() };
    if (block.type === "synced" && block.syncId) {
      let fresh = syncMap.get(block.syncId);
      if (!fresh) {
        fresh = newSyncId();
        syncMap.set(block.syncId, fresh);
      }
      next.syncId = fresh;
    }
    if (block.children) next.children = block.children.map(cloneOne);
    if (block.columns) next.columns = block.columns.map((col) => col.map(cloneOne));
    return next;
  };
  return blocks.map(cloneOne);
}

/** Parses a JSON string; anything invalid becomes null. */
function safeJsonParse(raw: string | null | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** Parses the Note.properties JSON; anything invalid becomes []. */
function parseJsonProperties(raw: string | null | undefined): GaiaNoteProperty[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: GaiaNoteProperty[] = [];
    for (const item of parsed) {
      const checked = gaiaNotePropertySchema.safeParse(item);
      if (checked.success) out.push(checked.data);
    }
    return out;
  } catch {
    return [];
  }
}

/** Normalizes properties: trims keys, drops empties, last value wins per key. */
function normalizeProperties(input: GaiaNoteProperty[]): GaiaNoteProperty[] {
  const byKey = new Map<string, GaiaNoteProperty>();
  for (const p of input) {
    const key = p.key.trim();
    if (key === "") continue;
    byKey.set(key.toLowerCase(), {
      key,
      value: p.value,
      type: p.type,
      ...(p.options ? { options: p.options } : {}),
    });
  }
  return [...byKey.values()];
}

function emptyParagraphBlock(): GaiaBlock {
  return { id: newBlockId(), type: "paragraph", text: "" };
}

async function loadFolders(userId: string): Promise<NoteFolder[]> {
  return db.noteFolder.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });
}

async function loadTags(userId: string): Promise<NoteTag[]> {
  return db.noteTag.findMany({ where: { userId } });
}

function folderNameOf(folderId: string | null, folders: NoteFolder[]): string | null {
  if (folderId === null) return null;
  return folders.find((f) => f.id === folderId)?.name ?? null;
}

function tagNamesOf(tagIds: string[], tags: NoteTag[]): string[] {
  return tagIds
    .map((tagId) => tags.find((t) => t.id === tagId)?.name ?? null)
    .filter((name): name is string => name !== null);
}

/**
 * Narrow note select for list/overview queries (Phase 2 perf, item 8):
 * every scalar EXCEPT `blocks` — the row's excerpt/wordCount/blockCount/
 * refCount/todoOpen come from a bounded second fetch for the displayed
 * rows only. Full rows (with blocks) still load for single-note reads.
 */
function toRow(note: NoteRowInput, folders: NoteFolder[], tags: NoteTag[]): GaiaNoteRow {
  const blocks = parseJsonBlocks(note.blocks);
  const tagIds = parseJsonStringArray(note.tagIds);
  return {
    id: note.id,
    title: note.title,
    icon: note.icon,
    folderId: note.folderId,
    folderName: folderNameOf(note.folderId, folders),
    tagIds,
    tagNames: tagNamesOf(tagIds, tags),
    favorite: note.favorite,
    templateId: note.templateId,
    excerpt: excerptOf(blocks),
    wordCount: countWords(blocks),
    blockCount: flattenBlocks(blocks).length,
    refCount: flattenBlocks(blocks).filter((b) => b.type === "ref").length,
    todoOpen: countOpenTodos(blocks),
    cover: note.cover ?? null,
    wordGoal: note.wordGoal ?? null,
    properties: parseJsonProperties(note.properties),
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    lastViewedAt: note.lastViewedAt?.toISOString() ?? null,
    deletedAt: note.deletedAt?.toISOString() ?? null,
    // Phase 1 — Memory. Older rows (created before the feature, or
    // written by a client that predates it) fall back to "fragile".
    mastery: isMasteryLevel(note.mastery) ? note.mastery : "fragile",
    lastReviewedAt: note.lastReviewedAt?.toISOString() ?? null,
    nextReviewAt: note.nextReviewAt?.toISOString() ?? null,
    reviewCount: note.reviewCount,
    easeFactor: note.easeFactor,
    intervalDays: note.intervalDays,
  };
}

function toDTO(note: Note): GaiaNoteDTO {
  return {
    id: note.id,
    userId: note.userId,
    title: note.title,
    icon: note.icon,
    folderId: note.folderId,
    tagIds: parseJsonStringArray(note.tagIds),
    favorite: note.favorite,
    templateId: note.templateId,
    blocks: parseJsonBlocks(note.blocks),
    cover: note.cover ?? null,
    wordGoal: note.wordGoal ?? null,
    properties: parseJsonProperties(note.properties),
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    lastViewedAt: note.lastViewedAt?.toISOString() ?? null,
    deletedAt: note.deletedAt?.toISOString() ?? null,
    // Phase 1 — Memory (same fallback as toRow).
    mastery: isMasteryLevel(note.mastery) ? note.mastery : "fragile",
    lastReviewedAt: note.lastReviewedAt?.toISOString() ?? null,
    nextReviewAt: note.nextReviewAt?.toISOString() ?? null,
    reviewCount: note.reviewCount,
    easeFactor: note.easeFactor,
    intervalDays: note.intervalDays,
  };
}

async function noteResponse(
  userId: string,
  note: Note,
  folders: NoteFolder[],
  tags: NoteTag[],
): Promise<GaiaNoteResponse> {
  const dto = toDTO(note);
  dto.blocks = await resolveNoteRefs(userId, dto.blocks);
  return {
    note: dto,
    folderName: folderNameOf(note.folderId, folders),
    tagNames: tagNamesOf(dto.tagIds, tags),
  };
}

async function findActiveNote(userId: string, noteId: string): Promise<Note | null> {
  return db.note.findFirst({ where: { userId, id: noteId, deletedAt: null } });
}

async function findNoteAnyState(userId: string, noteId: string): Promise<Note | null> {
  return db.note.findFirst({ where: { userId, id: noteId } });
}

/* ── Versioning ──────────────────────────────────────────────────────── */

async function versionsOf(userId: string, noteId: string): Promise<NoteVersion[]> {
  const versions = await db.noteVersion.findMany({
    where: { userId, noteId },
  });
  return sortVersionsNewestFirst(versions);
}

async function maybeSnapshotVersion(userId: string, note: Note): Promise<void> {
  const versions = await versionsOf(userId, note.id);
  const newest = versions[0] ?? null;
  if (!shouldSnapshot(newest ? newest.savedAt : null, new Date())) return;
  await db.noteVersion.create({
    data: {
      userId,
      noteId: note.id,
      title: note.title,
      blocks: note.blocks,
      savedAt: note.updatedAt,
    },
  });
  const after = await versionsOf(userId, note.id);
  const extra = versionsBeyondCap(after);
  if (extra.length > 0) {
    await db.noteVersion.deleteMany({
      where: { userId, id: { in: extra } },
    });
  }
}

/* ── Notes : lecture ─────────────────────────────────────────────────── */

export async function listNotes(
  userId: string,
  query: GaiaListQuery,
): Promise<{ notes: GaiaNoteRow[]; total: number }> {
  return listNotesQuery(userId, query, {
    validationError,
    collectionNotFound: () => notFound("COLLECTION_NOT_FOUND", "Collection not found."),
    collectionCriteriaSchema: gaiaCollectionCriteriaSchema,
    parseJsonProperties,
    toRow,
  });
}


export async function getNote(
  userId: string,
  noteId: string,
): Promise<GaiaNoteResponse> {
  return getNoteQuery(userId, noteId, {
    noteNotFound: NOTE_NOT_FOUND,
    findActiveNote,
    noteResponse: async (ownerId, note) => {
      const [folders, tags] = await Promise.all([loadFolders(ownerId), loadTags(ownerId)]);
      return noteResponse(ownerId, note, folders, tags);
    },
  });
}

/* ── Notes : écriture ────────────────────────────────────────────────── */

export async function createNote(
  userId: string,
  input: unknown,
): Promise<GaiaNoteResponse> {
  return createNoteCommand(userId, input, {
    validationError,
    noteNotFound: NOTE_NOT_FOUND,
    folderNotFound: FOLDER_NOT_FOUND,
    parseBlocks: normalizeBlocks,
    parseStoredBlocks: parseJsonBlocks,
    cloneBlocksWithNewIds,
    emptyParagraphBlock,
    assertSafeImageSources,
    normalizeProperties,
    findTemplate: async (ownerId, templateId) =>
      findTemplateQuery(ownerId, templateId, parseJsonBlocks),
    findActiveNote,
    noteResponse: async (ownerId, note) => {
      const [folders, tags] = await Promise.all([loadFolders(ownerId), loadTags(ownerId)]);
      return noteResponse(ownerId, note, folders, tags);
    },
  });
}

export async function updateNote(
  userId: string,
  noteId: string,
  input: unknown,
): Promise<GaiaNoteResponse> {
  return updateNoteCommand(userId, noteId, input, {
    validationError,
    noteNotFound: NOTE_NOT_FOUND,
    normalizeBlocks,
    parseStoredBlocks: parseJsonBlocks,
    assertSafeImageSources,
    normalizeProperties,
    maybeSnapshotVersion,
    noteResponse: async (ownerId, note) => {
      const [folders, tags] = await Promise.all([loadFolders(ownerId), loadTags(ownerId)]);
      return noteResponse(ownerId, note, folders, tags);
    },
  });
}

/* ── Module 1 — Objectifs d'écriture (E12) ─────────────────────────────── */

export type { GaiaWritingSettings, GaiaTodayWords } from "@/modules/notes/services/writing";

export async function getWritingSettings(userId: string): Promise<GaiaWritingSettings> {
  return getWritingSettingsQuery(userId);
}

export async function updateWritingSettings(
  userId: string,
  input: unknown,
): Promise<GaiaWritingSettings> {
  return updateWritingSettingsCommand(userId, input);
}

export async function getTodayWords(userId: string): Promise<GaiaTodayWords> {
  return getTodayWordsQuery(userId);
}

export async function trashNote(userId: string, noteId: string): Promise<{ ok: true }> {
  return trashNoteCommand(userId, noteId, { noteNotFound: NOTE_NOT_FOUND });
}

export async function restoreNote(userId: string, noteId: string): Promise<{ ok: true }> {
  return restoreNoteCommand(userId, noteId, { noteNotFound: NOTE_NOT_FOUND });
}

export async function purgeNote(userId: string, noteId: string): Promise<{ ok: true }> {
  return purgeNoteCommand(userId, noteId, { noteNotFound: NOTE_NOT_FOUND });
}

export async function duplicateNote(
  userId: string,
  noteId: string,
  input: unknown,
): Promise<GaiaNoteResponse> {
  return duplicateNoteCommand(userId, noteId, input, {
    validationError,
    noteNotFound: NOTE_NOT_FOUND,
    folderNotFound: FOLDER_NOT_FOUND,
    parseBlocks: normalizeBlocks,
    parseStoredBlocks: parseJsonBlocks,
    cloneBlocksWithNewIds,
    emptyParagraphBlock,
    assertSafeImageSources,
    normalizeProperties,
    findTemplate: async (ownerId, templateId) =>
      findTemplateQuery(ownerId, templateId, parseJsonBlocks),
    findActiveNote,
    noteResponse: async (ownerId, note) => {
      const [folders, tags] = await Promise.all([loadFolders(ownerId), loadTags(ownerId)]);
      return noteResponse(ownerId, note, folders, tags);
    },
  });
}

/* ── Phase 1 — Memory : révision espacée + statistiques ────────────────── */

export async function reviewNote(
  userId: string,
  noteId: string,
  input: unknown,
): Promise<GaiaNoteResponse> {
  return reviewNoteCommand(userId, noteId, input, {
    validationError,
    noteNotFound: NOTE_NOT_FOUND,
    noteResponse: async (ownerId, note) => {
      const [folders, tags] = await Promise.all([loadFolders(ownerId), loadTags(ownerId)]);
      return noteResponse(ownerId, note, folders, tags);
    },
  });
}

/** Manual mastery move is a reclassification, not a spaced-repetition review. */
export async function moveNoteToMastery(
  userId: string,
  noteId: string,
  input: unknown,
): Promise<GaiaNoteResponse> {
  return moveNoteToMasteryCommand(userId, noteId, input, {
    validationError,
    noteNotFound: NOTE_NOT_FOUND,
    noteResponse: async (ownerId, note) => {
      const [folders, tags] = await Promise.all([loadFolders(ownerId), loadTags(ownerId)]);
      return noteResponse(ownerId, note, folders, tags);
    },
  });
}

/** Reschedule a note without changing mastery, ease factor or review count. */
export async function scheduleNote(
  userId: string,
  noteId: string,
  input: unknown,
): Promise<GaiaNoteResponse> {
  return scheduleNoteCommand(userId, noteId, input, {
    validationError,
    noteNotFound: NOTE_NOT_FOUND,
    noteResponse: async (ownerId, note) => {
      const [folders, tags] = await Promise.all([loadFolders(ownerId), loadTags(ownerId)]);
      return noteResponse(ownerId, note, folders, tags);
    },
  });
}

/* ── Phase 2 — Knowledge graph ─────────────────────────────────────────── */

export type GaiaMemoryGraphNode = {
  id: string;
  title: string;
  mastery: MasteryLevel;
  folderId: string | null;
  /** Module 2 (K15) : aucune arête ne touche cette note. */
  orphan: boolean;
};

export type GaiaMemoryGraphEdge = {
  from: string;
  to: string;
  /** "ref" = a note links to another note; "tag" = two notes share a tag;
   *  "relation" = a custom relation (Module 2, K08). */
  kind: "ref" | "tag" | "relation";
  /** Tag name for "tag" edges (the shared tag). */
  tagName?: string;
  /** Relation label for "relation" edges (e.g. "contradicts"). */
  label?: string;
};

export type GaiaMemoryGraphResponse = {
  nodes: GaiaMemoryGraphNode[];
  edges: GaiaMemoryGraphEdge[];
  /** Module 2 (K08) : distinct relation labels, for the legend/filter. */
  relationTypes: string[];
};

/** Max tag edges in one response: a tag shared by many notes would
 *  otherwise explode combinatorially (a 50-note tag = 1,225 edges). */
const MAX_TAG_EDGES = 200;
/** A tag shared by more than this many notes is too generic to draw. */
const MAX_TAG_GROUP_SIZE = 8;

/**
 * Knowledge graph: nodes are the user's active notes, edges are note→note
 * references (from `ref` blocks, kind NOTE) and shared tags. Ref edges
 * are solid; tag edges are dashed and only drawn for tags shared by 2–8
 * notes, capped at 200 edges total. Deterministic order (createdAt asc)
 * so the layout is stable between loads.
 */
export async function getMemoryGraph(
  userId: string,
): Promise<GaiaMemoryGraphResponse> {
  const notes = await db.note.findMany({
    where: { userId, deletedAt: null },
    select: {
      id: true,
      title: true,
      mastery: true,
      folderId: true,
      tagIds: true,
      blocks: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const ids = new Set(notes.map((n) => n.id));
  const nodes: GaiaMemoryGraphNode[] = notes.map((note) => ({
    id: note.id,
    title: note.title,
    mastery: isMasteryLevel(note.mastery) ? note.mastery : "fragile",
    folderId: note.folderId,
    orphan: true,
  }));

  const edges: GaiaMemoryGraphEdge[] = [];
  const seenRef = new Set<string>();
  for (const note of notes) {
    for (const block of flattenBlocks(parseJsonBlocks(note.blocks))) {
      if (block.type !== "ref" || block.ref?.kind !== "NOTE") continue;
      const target = block.ref.id;
      if (target === note.id || !ids.has(target)) continue;
      const key = `${note.id}→${target}`;
      if (seenRef.has(key)) continue;
      seenRef.add(key);
      edges.push({ from: note.id, to: target, kind: "ref" });
    }
  }

  // Tag edges: cliques per shared tag, capped (see constants above).
  const tags = await loadTags(userId);
  const tagNameOf = new Map(tags.map((t) => [t.id, t.name]));
  const byTag = new Map<string, string[]>();
  for (const note of notes) {
    for (const tagId of parseJsonStringArray(note.tagIds)) {
      const list = byTag.get(tagId) ?? [];
      list.push(note.id);
      byTag.set(tagId, list);
    }
  }
  let tagEdges = 0;
  for (const [tagId, members] of [...byTag.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    if (members.length < 2 || members.length > MAX_TAG_GROUP_SIZE) continue;
    for (let i = 0; i < members.length && tagEdges < MAX_TAG_EDGES; i++) {
      for (let j = i + 1; j < members.length && tagEdges < MAX_TAG_EDGES; j++) {
        edges.push({
          from: members[i],
          to: members[j],
          kind: "tag",
          tagName: tagNameOf.get(tagId) ?? tagId,
        });
        tagEdges += 1;
      }
    }
    if (tagEdges >= MAX_TAG_EDGES) break;
  }

  // Module 2 (K08) : arêtes de relations personnalisées.
  const relations = await db.noteRelation.findMany({ where: { userId } });
  const relationTypes = [...new Set(relations.map((r) => r.type))].sort();
  for (const rel of relations) {
    if (!ids.has(rel.fromNoteId) || !ids.has(rel.toNoteId)) continue;
    edges.push({
      from: rel.fromNoteId,
      to: rel.toNoteId,
      kind: "relation",
      label: rel.type,
    });
  }

  // Une note orpheline n'a aucune arête (K15).
  const touched = new Set<string>();
  for (const e of edges) {
    touched.add(e.from);
    touched.add(e.to);
  }
  for (const node of nodes) node.orphan = !touched.has(node.id);

  return { nodes, edges, relationTypes };
}

export type GaiaMemoryHeatmapDay = {
  /** UTC date, YYYY-MM-DD. */
  date: string;
  /** Reviews completed that day (see note below). */
  reviews: number;
  /** Notes created that day. */
  created: number;
};

export type GaiaMemoryTimelineNote = {
  id: string;
  title: string;
  mastery: MasteryLevel;
  /** ISO timestamp of creation. */
  createdAt: string;
};

export type GaiaMemoryTimelineMonth = {
  /** Month key, YYYY-MM (UTC). */
  month: string;
  /** Total notes created that month (the list below is capped at 20). */
  count: number;
  /** Newest first, max 20. */
  notes: GaiaMemoryTimelineNote[];
};

export type GaiaMemoryJournal = {
  today: {
    created: number;
    /** See the caveat in getMemoryStats (derived from lastReviewedAt). */
    reviewed: number;
    dueRemaining: number;
    /** See the caveat in getMemoryStats (mastered + reviewed today). */
    newlyMastered: number;
  };
  week: {
    created: number;
    reviewed: number;
  };
};

export type GaiaMemoryStatsResponse = {
  totalNotes: number;
  dueCount: number;
  countsByMastery: Record<MasteryLevel, number>;
  /** null when the workspace has no notes yet (empty state). */
  score: number | null;
  scoreParts: {
    /** Mean mastery value (forgotten 0, fragile 0.33, medium 0.66, mastered 1). */
    avgMastery: number;
    /** 1 − dueCount / totalNotes. */
    dueClearance: number;
    /** min(7, streakDays) / 7. */
    streakFactor: number;
  };
  /** Consecutive days with ≥ 1 review, ending today or yesterday. */
  streakDays: number;
  /** 26 weeks × 7 days, oldest first, ending today (UTC). */
  heatmap: GaiaMemoryHeatmapDay[];
  /** Phase 2 — Timeline: months newest first, max 12 months. */
  timeline: GaiaMemoryTimelineMonth[];
  /** Phase 2 — Daily journal, computed on the fly (no new table). */
  journal: GaiaMemoryJournal;
};

/**
 * Memory Score — transparent formula (also documented in the README):
 *
 *   score = round(100 × (0.55 × avgMastery
 *                        + 0.25 × dueClearance
 *                        + 0.20 × streakFactor))
 *
 *   avgMastery    mean mastery value over all active notes
 *                 (forgotten 0, fragile 0.33, medium 0.66, mastered 1)
 *   dueClearance  1 − dueCount / max(1, totalNotes)
 *   streakFactor  min(7, streakDays) / 7
 *
 * Heatmap caveat: there is no review-history table in Phase 1, so the
 * per-day "reviews" count is derived from each note's lastReviewedAt —
 * a note reviewed twice on different days only counts on its most recent
 * review day. "created" is exact (from createdAt). If per-day review
 * history ever needs to be exact, add a review-events table.
 */
export async function getMemoryStats(
  userId: string,
): Promise<GaiaMemoryStatsResponse> {
  const notes = await db.note.findMany({
    where: { userId, deletedAt: null },
    select: {
      id: true,
      title: true,
      mastery: true,
      lastReviewedAt: true,
      nextReviewAt: true,
      createdAt: true,
    },
  });
  const now = new Date();
  const totalNotes = notes.length;

  const countsByMastery: Record<MasteryLevel, number> = {
    forgotten: 0,
    fragile: 0,
    medium: 0,
    mastered: 0,
  };
  let masterySum = 0;
  let dueCount = 0;
  for (const note of notes) {
    const level: MasteryLevel = isMasteryLevel(note.mastery)
      ? note.mastery
      : "fragile";
    countsByMastery[level] += 1;
    masterySum += MASTERY_VALUE[level];
    if (note.nextReviewAt === null || note.nextReviewAt.getTime() <= now.getTime()) {
      dueCount += 1;
    }
  }

  // ── Heatmap: 182 days ending today (UTC) ──
  const dayKey = (d: Date): string => d.toISOString().slice(0, 10);
  const todayKey = dayKey(now);
  const heatmap: GaiaMemoryHeatmapDay[] = [];
  const byDay = new Map<string, GaiaMemoryHeatmapDay>();
  for (let i = 181; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    const day = { date: dayKey(d), reviews: 0, created: 0 };
    heatmap.push(day);
    byDay.set(day.date, day);
  }
  for (const note of notes) {
    const created = byDay.get(dayKey(note.createdAt));
    if (created) created.created += 1;
    if (note.lastReviewedAt !== null) {
      const reviewed = byDay.get(dayKey(note.lastReviewedAt));
      if (reviewed) reviewed.reviews += 1;
    }
  }

  // ── Streak: consecutive days with ≥ 1 review, ending today or yesterday.
  const reviewDays = new Set(
    notes
      .filter((n) => n.lastReviewedAt !== null)
      .map((n) => dayKey(n.lastReviewedAt as Date)),
  );
  let streakDays = 0;
  // If today has no review yet, the streak may still be alive from yesterday.
  let cursor = reviewDays.has(todayKey) ? 0 : 1;
  while (reviewDays.has(dayKey(new Date(now.getTime() - cursor * 86_400_000)))) {
    streakDays += 1;
    cursor += 1;
  }

  // ── Phase 2 — Timeline: notes grouped by creation month (UTC),
  //    newest month first, max 12 months, max 20 notes per month.
  const timelineByMonth = new Map<string, GaiaMemoryTimelineNote[]>();
  const countByMonth = new Map<string, number>();
  for (const note of [...notes].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  )) {
    const month = note.createdAt.toISOString().slice(0, 7);
    countByMonth.set(month, (countByMonth.get(month) ?? 0) + 1);
    const list = timelineByMonth.get(month) ?? [];
    if (list.length < 20) {
      list.push({
        id: note.id,
        title: note.title,
        mastery: isMasteryLevel(note.mastery) ? note.mastery : "fragile",
        createdAt: note.createdAt.toISOString(),
      });
    }
    timelineByMonth.set(month, list);
  }
  const timeline: GaiaMemoryTimelineMonth[] = [...timelineByMonth.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 12)
    .map(([month, monthNotes]) => ({
      month,
      count: countByMonth.get(month) ?? monthNotes.length,
      notes: monthNotes,
    }));

  // ── Phase 2 — Daily journal (computed on the fly, no new table).
  //    Caveat (same as the heatmap above): there is no review-history
  //    table, so "reviewed today / this week" is derived from each
  //    note's lastReviewedAt — a note reviewed twice on different days
  //    counts only on its most recent review day. "newlyMastered" is
  //    likewise approximate: notes that are mastered AND were reviewed
  //    today (a note mastered long ago and re-reviewed today counts).
  //    "created" and "dueRemaining" are exact.
  const startOfTodayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const journal: GaiaMemoryJournal = {
    today: {
      created: notes.filter((n) => n.createdAt >= startOfTodayUtc).length,
      reviewed: notes.filter(
        (n) => n.lastReviewedAt !== null && n.lastReviewedAt >= startOfTodayUtc,
      ).length,
      dueRemaining: dueCount,
      newlyMastered: notes.filter(
        (n) =>
          n.mastery === "mastered" &&
          n.lastReviewedAt !== null &&
          n.lastReviewedAt >= startOfTodayUtc,
      ).length,
    },
    week: {
      created: notes.filter((n) => n.createdAt >= weekAgo).length,
      reviewed: notes.filter(
        (n) => n.lastReviewedAt !== null && n.lastReviewedAt >= weekAgo,
      ).length,
    },
  };

  if (totalNotes === 0) {
    return {
      totalNotes: 0,
      dueCount: 0,
      countsByMastery,
      score: null,
      scoreParts: { avgMastery: 0, dueClearance: 0, streakFactor: 0 },
      streakDays,
      heatmap,
      timeline,
      journal,
    };
  }

  const avgMastery = masterySum / totalNotes;
  const dueClearance = 1 - dueCount / Math.max(1, totalNotes);
  const streakFactor = Math.min(7, streakDays) / 7;
  const score = Math.round(
    100 * (0.55 * avgMastery + 0.25 * dueClearance + 0.2 * streakFactor),
  );
  return {
    totalNotes,
    dueCount,
    countsByMastery,
    score,
    scoreParts: { avgMastery, dueClearance, streakFactor },
    streakDays,
    heatmap,
    timeline,
    journal,
  };
}

/* ── Versions ────────────────────────────────────────────────────────── */

export async function listVersions(
  userId: string,
  noteId: string,
): Promise<{ versions: GaiaVersionSummary[] }> {
  return listVersionsQuery(userId, noteId);
}

export async function getVersion(
  userId: string,
  noteId: string,
  versionId: string,
): Promise<{ version: GaiaVersionDetail }> {
  return getVersionQuery(userId, noteId, versionId, VERSION_NOT_FOUND);
}

export async function restoreVersion(
  userId: string,
  noteId: string,
  versionId: string,
): Promise<GaiaNoteResponse> {
  return restoreVersionCommand(userId, noteId, versionId, {
    noteNotFound: NOTE_NOT_FOUND,
    versionNotFound: VERSION_NOT_FOUND,
    maybeSnapshotVersion,
    cloneBlocksWithNewIds,
    noteResponse: async (ownerId, note) => {
      const [folders, tags] = await Promise.all([loadFolders(ownerId), loadTags(ownerId)]);
      return noteResponse(ownerId, note, folders, tags);
    },
  });
}

/* ── Dossiers ────────────────────────────────────────────────────────── */

export async function listFolders(userId: string): Promise<{ folders: GaiaFolderDTO[] }> {
  return listFoldersQuery(userId);
}

export async function createFolder(userId: string, input: unknown): Promise<GaiaFolderDTO> {
  const parsed = parseOrThrow(folderInputSchema, input);
  return createFolderCommand(userId, parsed, {
    folderNotFound: FOLDER_NOT_FOUND,
    validationError,
    conflictError,
  });
}

export async function updateFolder(
  userId: string,
  folderId: string,
  input: unknown,
): Promise<GaiaFolderDTO> {
  const parsed = parseOrThrow(folderInputSchema, input);
  return updateFolderCommand(userId, folderId, parsed, {
    folderNotFound: FOLDER_NOT_FOUND,
    validationError,
    conflictError,
    isDescendantOf,
  });
}

export async function deleteFolder(userId: string, folderId: string): Promise<{ ok: true }> {
  return deleteFolderCommand(userId, folderId, FOLDER_NOT_FOUND);
}

/* ── Tags ────────────────────────────────────────────────────────────── */

export async function listTags(userId: string): Promise<{ tags: GaiaTagDTO[] }> {
  return listTagsQuery(userId, parseJsonStringArray);
}

export async function createTag(userId: string, input: unknown): Promise<GaiaTagDTO> {
  const parsed = parseOrThrow(tagInputSchema, input);
  return createTagCommand(userId, parsed, {
    notFound: (code, message) => notFound(code, message),
    validationError,
    conflictError,
    parseJsonStringArray,
  });
}

export async function updateTag(
  userId: string,
  tagId: string,
  input: unknown,
): Promise<GaiaTagDTO> {
  const parsed = parseOrThrow(tagInputSchema, input);
  return updateTagCommand(userId, tagId, parsed, {
    notFound: (code, message) => notFound(code, message),
    validationError,
    conflictError,
    isDescendantOf,
    parseJsonStringArray,
  });
}

export async function deleteTag(userId: string, tagId: string): Promise<{ ok: true }> {
  return deleteTagCommand(userId, tagId, {
    notFound: (code, message) => notFound(code, message),
    parseJsonStringArray,
  });
}

/* ── Modèles ─────────────────────────────────────────────────────────── */

export async function listTemplates(userId: string): Promise<{ templates: GaiaTemplateDTO[] }> {
  return listTemplatesQuery(userId, parseJsonBlocks);
}

export async function createTemplate(
  userId: string,
  input: unknown,
): Promise<GaiaTemplateDTO> {
  return createTemplateCommand(userId, input, {
    validationError,
    noteNotFound: NOTE_NOT_FOUND,
    templateNotFound: TEMPLATE_NOT_FOUND,
    parseBlocks: normalizeBlocks,
    parseStoredBlocks: parseJsonBlocks,
    cloneBlocksWithNewIds,
    emptyParagraphBlock,
    assertSafeImageSources,
    findActiveNote,
    createNote,
  });
}

export async function instantiateTemplate(
  userId: string,
  input: unknown,
): Promise<GaiaNoteResponse> {
  return instantiateTemplateCommand(userId, input, {
    validationError,
    noteNotFound: NOTE_NOT_FOUND,
    templateNotFound: TEMPLATE_NOT_FOUND,
    parseBlocks: normalizeBlocks,
    parseStoredBlocks: parseJsonBlocks,
    cloneBlocksWithNewIds,
    emptyParagraphBlock,
    assertSafeImageSources,
    findActiveNote,
    createNote,
  });
}

/* ── Overview ────────────────────────────────────────────────────────── */

function startOfWeekMondayUTC(now: Date): Date {
  const day = now.getUTCDay();
  const mondayOffset = (day + 6) % 7;
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - mondayOffset),
  );
  return monday;
}

export async function getOverview(userId: string): Promise<GaiaOverviewResponse> {
  const [folders, tags, allNotes] = await Promise.all([
    loadFolders(userId),
    loadTags(userId),
    // Phase 2 perf (item 8) — narrow select, no blocks: counts, folders,
    // tags and activity need scalars only. Blocks load once, bounded to
    // the ≤16 rows actually displayed below.
    db.note.findMany({ where: { userId }, select: NOTE_LIST_SELECT }),
  ]);
  const active = allNotes.filter((n) => n.deletedAt === null);
  const trashed = allNotes.filter((n) => n.deletedAt !== null);
  const weekAgo = Date.now() - 7 * 86_400_000;

  const recentEdited = [...active]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 6);
  const recentViewed = active
    .filter((n) => n.lastViewedAt !== null)
    .sort((a, b) => (b.lastViewedAt?.getTime() ?? 0) - (a.lastViewedAt?.getTime() ?? 0))
    .slice(0, 5);
  const favorites = active
    .filter((n) => n.favorite)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 5);

  const blocksById = await loadBlocksFor([
    ...new Set(
      [...recentEdited, ...recentViewed, ...favorites].map((n) => n.id)
    ),
  ]);
  const toDisplayRow = (n: NoteListRow): GaiaNoteRow =>
    toRow({ ...n, blocks: blocksById.get(n.id) ?? "[]" }, folders, tags);

  const foldersWithCounts: GaiaFolderDTO[] = folders
    .map((folder) => ({
      ...folder,
      noteCount: active.filter((n) => n.folderId === folder.id).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const tagsWithCounts: GaiaTagDTO[] = tags
    .map((tag) => ({
      ...tag,
      noteCount: active.filter((n) =>
        parseJsonStringArray(n.tagIds).includes(tag.id),
      ).length,
    }))
    .sort((a, b) => b.noteCount - a.noteCount || a.name.localeCompare(b.name));

  const monday = startOfWeekMondayUTC(new Date());
  const activity: GaiaActivityWeek[] = [];
  for (let offset = 7; offset >= 0; offset--) {
    const weekStartMs = monday.getTime() - offset * 7 * 86_400_000;
    const weekEndMs = weekStartMs + 7 * 86_400_000;
    const createdInWeek = active.filter(
      (n) => n.createdAt.getTime() >= weekStartMs && n.createdAt.getTime() < weekEndMs,
    );
    const createdIds = new Set(createdInWeek.map((n) => n.id));
    const editedInWeek = active.filter(
      (n) =>
        n.updatedAt.getTime() >= weekStartMs &&
        n.updatedAt.getTime() < weekEndMs &&
        !createdIds.has(n.id),
    );
    activity.push({
      weekStart: new Date(weekStartMs).toISOString().slice(0, 10),
      created: createdInWeek.length,
      edited: editedInWeek.length,
    });
  }

  const { templates } = await listTemplates(userId);

  return {
    totals: {
      notes: active.length,
      createdThisWeek: active.filter((n) => n.createdAt.getTime() >= weekAgo).length,
      favorites: active.filter((n) => n.favorite).length,
      folders: folders.length,
      tags: tags.length,
      trashed: trashed.length,
    },
    recentEdited: recentEdited.map(toDisplayRow),
    recentViewed: recentViewed.map(toDisplayRow),
    favorites: favorites.map(toDisplayRow),
    folders: foldersWithCounts,
    topTags: tagsWithCounts.slice(0, 8),
    activity,
    templates: templates.slice(0, 4),
  };
}

/* ── Recherche ───────────────────────────────────────────────────────── */

export async function searchNotes(
  userId: string,
  q: string,
): Promise<{ results: (GaiaNoteRow & { snippet: string })[]; total: number }> {
  const query = q.trim().toLowerCase();
  if (query === "") return { results: [], total: 0 };
  const [folders, tags, notes] = await Promise.all([
    loadFolders(userId),
    loadTags(userId),
    db.note.findMany({ where: { userId, deletedAt: null } }),
  ]);
  const results: (GaiaNoteRow & { snippet: string })[] = [];
  for (const note of notes) {
    const blocks = parseJsonBlocks(note.blocks);
    const tagIds = parseJsonStringArray(note.tagIds);
    const titleHit = note.title.toLowerCase().includes(query);
    const fullText = textOfBlocks(blocks);
    const textHit = fullText.toLowerCase().includes(query);
    const tagHit = tagNamesOf(tagIds, tags).some((name) =>
      name.toLowerCase().includes(query),
    );
    if (!titleHit && !textHit && !tagHit) continue;
    const row = toRow(note, folders, tags);
    results.push({
      ...row,
      snippet: textHit ? searchSnippet(blocks, query) : excerptOf(blocks),
    });
  }
  results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const sliced = results.slice(0, 30);
  return { results: sliced, total: sliced.length };
}

/* ── Refs ────────────────────────────────────────────────────────────── */

export async function listGaiaRefs(
  userId: string,
  q: string,
  kind?: string,
): Promise<{ refs: GaiaRefHit[] }> {
  const refs = await listRefsRaw(userId, q, kind);
  return { refs };
}

export async function listLinkedNotes(
  userId: string,
  kind: GaiaRefKind,
  id: string,
): Promise<{ notes: GaiaNoteRow[]; total: number }> {
  return listNotes(userId, { refKind: kind, refId: id });
}

/* ══════════════════════════════════════════════════════════════════════
   Module 2 — Knowledge Management System (K01–K17)
   ══════════════════════════════════════════════════════════════════ */

// ── Helpers Module 2 ──────────────────────────────────────────────────

// ── K08 — Relations personnalisées ────────────────────────────────────

export async function listNoteRelations(
  userId: string,
  noteId: string,
): Promise<{ relations: GaiaNoteRelationDTO[] }> {
  return listNoteRelationsQuery(userId, noteId, {
    noteNotFound: NOTE_NOT_FOUND,
  });
}

export async function createNoteRelation(
  userId: string,
  noteId: string,
  input: unknown,
): Promise<{ relation: GaiaNoteRelationDTO }> {
  return createNoteRelationCommand(userId, noteId, input, {
    validationError,
    noteNotFound: NOTE_NOT_FOUND,
    conflictError,
  });
}

export async function deleteNoteRelation(
  userId: string,
  noteId: string,
  relationId: string,
): Promise<{ ok: true }> {
  return deleteNoteRelationCommand(userId, noteId, relationId, {
    relationNotFound: () => notFound("RELATION_NOT_FOUND", "Relation not found."),
  });
}

// ── K02 / K03 / K04 — Backlinks, mentions non liées, liens sortants ───

export async function getNoteLinks(
  userId: string,
  noteId: string,
): Promise<GaiaNoteLinksResponse> {
  const note = await findActiveNote(userId, noteId);
  if (!note) throw NOTE_NOT_FOUND();
  const [folders, tags, relations, allNotes] = await Promise.all([
    loadFolders(userId),
    loadTags(userId),
    loadRelations(userId),
    db.note.findMany({ where: { userId, deletedAt: null } }),
  ]);

  // Outgoing: ref blocks (NOTE) + relations.
  const outgoing: GaiaNoteLinkItem[] = [];
  const seenOutgoing = new Set<string>();
  for (const block of flattenBlocks(parseJsonBlocks(note.blocks))) {
    if (block.type !== "ref" || block.ref?.kind !== "NOTE") continue;
    const target = allNotes.find((n) => n.id === block.ref?.id);
    if (!target || target.id === noteId || seenOutgoing.has(target.id)) continue;
    seenOutgoing.add(target.id);
    outgoing.push({
      id: target.id,
      title: target.title === "" ? "Untitled note" : target.title,
      via: "ref",
    });
  }
  const myRelations = relations.filter((r) => r.fromNoteId === noteId);
  for (const rel of myRelations) {
    const target = allNotes.find((n) => n.id === rel.toNoteId);
    if (!target || seenOutgoing.has(target.id)) continue;
    seenOutgoing.add(target.id);
    outgoing.push({
      id: target.id,
      title: target.title === "" ? "Untitled note" : target.title,
      via: "relation",
      relationType: rel.type,
    });
  }

  // Backlinks: every other note with a ref block to this note.
  const backlinks = allNotes
    .filter(
      (n) =>
        n.id !== noteId &&
        flattenBlocks(parseJsonBlocks(n.blocks)).some(
          (b) => b.type === "ref" && b.ref?.kind === "NOTE" && b.ref.id === noteId,
        ),
    )
    .map((n) => toRow(n, folders, tags));

  // Unlinked mentions: the title appears in another note's text (title or
  // body) without any link to this note. Short titles (< 3 chars) are
  // skipped — they would match almost everything.
  const unlinkedMentions: GaiaUnlinkedMention[] = [];
  const title = note.title.trim();
  if (title.length >= 3) {
    const needle = title.toLowerCase();
    const linkedIds = new Set([
      ...backlinks.map((b) => b.id),
      ...outgoing.map((o) => o.id),
    ]);
    for (const other of allNotes) {
      if (other.id === noteId || linkedIds.has(other.id)) continue;
      const blocks = parseJsonBlocks(other.blocks);
      const hayTitle = other.title.toLowerCase();
      const hayText = textOfBlocks(blocks).toLowerCase();
      if (!hayTitle.includes(needle) && !hayText.includes(needle)) continue;
      unlinkedMentions.push({
        id: other.id,
        title: other.title === "" ? "Untitled note" : other.title,
        snippet: hayText.includes(needle)
          ? searchSnippet(blocks, needle)
          : excerptOf(blocks),
      });
      if (unlinkedMentions.length >= 20) break;
    }
  }

  // Relations (both directions) with the other note's title.
  const titles = await loadNoteTitles(
    userId,
    relations
      .filter((r) => r.fromNoteId === noteId || r.toNoteId === noteId)
      .map((r) => (r.fromNoteId === noteId ? r.toNoteId : r.fromNoteId)),
  );
  const relationDTOs = relations
    .filter((r) => r.fromNoteId === noteId || r.toNoteId === noteId)
    .map((r) =>
      relationToDTO(
        r,
        r.fromNoteId === noteId ? "outgoing" : "incoming",
        titles.get(r.fromNoteId === noteId ? r.toNoteId : r.fromNoteId) ??
          "Untitled note",
      ),
    );

  return { outgoing, backlinks, unlinkedMentions, relations: relationDTOs };
}

// ── K14 — Suggestions de liens ────────────────────────────────────────

export async function getLinkSuggestions(
  userId: string,
  noteId: string,
): Promise<{ suggestions: GaiaLinkSuggestion[] }> {
  const note = await findActiveNote(userId, noteId);
  if (!note) throw NOTE_NOT_FOUND();
  const [links, allNotes] = await Promise.all([
    getNoteLinks(userId, noteId),
    db.note.findMany({ where: { userId, deletedAt: null } }),
  ]);
  const linkedIds = new Set([
    noteId,
    ...links.outgoing.map((o) => o.id),
    ...links.backlinks.map((b) => b.id),
  ]);
  const sourceBlocks = parseJsonBlocks(note.blocks);
  const scored = suggestLinks(
    {
      title: note.title,
      text: textOfBlocks(sourceBlocks),
      tagIds: parseJsonStringArray(note.tagIds),
    },
    allNotes
      .filter((n) => !linkedIds.has(n.id))
      .map((n) => ({
        id: n.id,
        title: n.title,
        text: textOfBlocks(parseJsonBlocks(n.blocks)),
        tagIds: parseJsonStringArray(n.tagIds),
      })),
    8,
  );
  const titles = new Map(allNotes.map((n) => [n.id, n.title]));
  return {
    suggestions: scored.map((s) => ({
      id: s.id,
      title: titles.get(s.id) === "" ? "Untitled note" : (titles.get(s.id) ?? "Untitled note"),
      score: s.score,
      sharedWords: s.sharedWords,
    })),
  };
}

// ── K15 — Notes orphelines ─────────────────────────────────────────────

export async function getOrphanNotes(
  userId: string,
): Promise<{ notes: GaiaNoteRow[]; total: number }> {
  const [folders, tags, relations, allNotes] = await Promise.all([
    loadFolders(userId),
    loadTags(userId),
    loadRelations(userId),
    db.note.findMany({ where: { userId, deletedAt: null } }),
  ]);
  const outgoing = new Map<string, Set<string>>();
  const incoming = new Set<string>();
  const tagGroups = new Map<string, string[]>();
  for (const note of allNotes) {
    const targets = new Set<string>();
    for (const block of flattenBlocks(parseJsonBlocks(note.blocks))) {
      if (block.type === "ref" && block.ref?.kind === "NOTE" && block.ref.id !== note.id) {
        targets.add(block.ref.id);
        incoming.add(block.ref.id);
      }
    }
    outgoing.set(note.id, targets);
    for (const tagId of parseJsonStringArray(note.tagIds)) {
      const list = tagGroups.get(tagId) ?? [];
      list.push(note.id);
      tagGroups.set(tagId, list);
    }
  }
  const relatedIds = new Set<string>();
  for (const rel of relations) {
    relatedIds.add(rel.fromNoteId);
    relatedIds.add(rel.toNoteId);
  }
  const sharedTagIds = new Set<string>();
  for (const members of tagGroups.values()) {
    if (members.length >= 2) {
      for (const id of members) sharedTagIds.add(id);
    }
  }
  const orphans = allNotes.filter(
    (note) =>
      (outgoing.get(note.id)?.size ?? 0) === 0 &&
      !incoming.has(note.id) &&
      !relatedIds.has(note.id) &&
      !sharedTagIds.has(note.id),
  );
  orphans.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const total = orphans.length;
  return {
    notes: orphans.slice(0, 50).map((n) => toRow(n, folders, tags)),
    total,
  };
}

// ── K16 — Timeline des connaissances ──────────────────────────────────

export async function getKnowledgeTimeline(
  userId: string,
): Promise<{ months: GaiaKnowledgeTimelineMonth[] }> {
  const [notes, relations] = await Promise.all([
    db.note.findMany({
      where: { userId, deletedAt: null },
      select: { id: true, title: true, mastery: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
    }),
    db.noteRelation.findMany({ where: { userId }, select: { createdAt: true } }),
  ]);
  const monthKey = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const byMonth = new Map<string, GaiaKnowledgeTimelineMonth>();
  const ensure = (key: string): GaiaKnowledgeTimelineMonth => {
    let m = byMonth.get(key);
    if (!m) {
      m = { month: key, created: 0, edited: 0, relations: 0, notes: [] };
      byMonth.set(key, m);
    }
    return m;
  };
  for (const note of notes) {
    const created = ensure(monthKey(note.createdAt));
    created.created += 1;
    if (created.notes.length < 10) {
      created.notes.push({
        id: note.id,
        title: note.title,
        mastery: isMasteryLevel(note.mastery) ? note.mastery : "fragile",
        createdAt: note.createdAt.toISOString(),
      });
    }
    const updatedKey = monthKey(note.updatedAt);
    if (updatedKey !== monthKey(note.createdAt)) {
      ensure(updatedKey).edited += 1;
    }
  }
  for (const rel of relations) {
    ensure(monthKey(rel.createdAt)).relations += 1;
  }
  const months = [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month));
  return { months: months.slice(0, 12) };
}

// ── K06 — Collections dynamiques ──────────────────────────────────────

function collectionToDTO(
  row: SmartCollection,
  noteCount: number,
): GaiaSmartCollectionDTO {
  const criteria = gaiaCollectionCriteriaSchema.safeParse(
    safeJsonParse(row.criteria),
  ).success
    ? (gaiaCollectionCriteriaSchema.parse(
        safeJsonParse(row.criteria),
      ) as KnowledgeCollectionCriteria)
    : {};
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    criteria,
    noteCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function countCollectionNotes(
  userId: string,
  criteria: KnowledgeCollectionCriteria,
): Promise<number> {
  const [folders, allNotes] = await Promise.all([
    loadFolders(userId),
    db.note.findMany({ where: { userId, deletedAt: null } }),
  ]);
  const folderDescendants =
    criteria.folderId != null
      ? descendantIds(buildTree(folders), criteria.folderId, false)
      : [];
  return allNotes.filter((note) =>
    matchCollectionCriteria(
      {
        folderId: note.folderId,
        tagIds: parseJsonStringArray(note.tagIds),
        mastery: note.mastery,
        favorite: note.favorite,
        title: note.title,
        text: textOfBlocks(parseJsonBlocks(note.blocks)),
        properties: parseJsonProperties(note.properties),
      },
      criteria,
      folderDescendants,
    ),
  ).length;
}

export async function listCollections(
  userId: string,
): Promise<{ collections: GaiaSmartCollectionDTO[] }> {
  const rows = await db.smartCollection.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  const collections: GaiaSmartCollectionDTO[] = [];
  for (const row of rows) {
    const criteria = gaiaCollectionCriteriaSchema.safeParse(
      safeJsonParse(row.criteria),
    ).success
      ? (gaiaCollectionCriteriaSchema.parse(
          safeJsonParse(row.criteria),
        ) as KnowledgeCollectionCriteria)
      : {};
    collections.push(collectionToDTO(row, await countCollectionNotes(userId, criteria)));
  }
  return { collections };
}

export async function createCollection(
  userId: string,
  input: unknown,
): Promise<{ collection: GaiaSmartCollectionDTO }> {
  const parsed = parseOrThrow(collectionInputSchema, input);
  if (parsed.criteria?.folderId) {
    const folder = await db.noteFolder.findFirst({
      where: { userId, id: parsed.criteria.folderId },
    });
    if (!folder) throw FOLDER_NOT_FOUND();
  }
  const row = await db.smartCollection.create({
    data: {
      userId,
      name: parsed.name.trim(),
      icon: parsed.icon ?? "📁",
      criteria: JSON.stringify(parsed.criteria ?? {}),
    },
  });
  return { collection: collectionToDTO(row, 0) };
}

export async function updateCollection(
  userId: string,
  collectionId: string,
  input: unknown,
): Promise<{ collection: GaiaSmartCollectionDTO }> {
  const parsed = parseOrThrow(collectionInputSchema, input);
  const row = await db.smartCollection.findFirst({ where: { userId, id: collectionId } });
  if (!row) throw notFound("COLLECTION_NOT_FOUND", "Collection not found.");
  if (parsed.criteria?.folderId) {
    const folder = await db.noteFolder.findFirst({
      where: { userId, id: parsed.criteria.folderId },
    });
    if (!folder) throw FOLDER_NOT_FOUND();
  }
  const updated = await db.smartCollection.update({
    where: { id: row.id },
    data: {
      name: parsed.name.trim(),
      icon: parsed.icon ?? row.icon,
      criteria: JSON.stringify(parsed.criteria ?? {}),
    },
  });
  const criteria = gaiaCollectionCriteriaSchema.parse(
    safeJsonParse(updated.criteria),
  ) as KnowledgeCollectionCriteria;
  return {
    collection: collectionToDTO(updated, await countCollectionNotes(userId, criteria)),
  };
}

export async function deleteCollection(
  userId: string,
  collectionId: string,
): Promise<{ ok: true }> {
  const row = await db.smartCollection.findFirst({ where: { userId, id: collectionId } });
  if (!row) throw notFound("COLLECTION_NOT_FOUND", "Collection not found.");
  await db.smartCollection.delete({ where: { id: row.id } });
  return { ok: true };
}

export async function listCollectionNotes(
  userId: string,
  collectionId: string,
  page = 1,
): Promise<{ notes: GaiaNoteRow[]; total: number; collection: GaiaSmartCollectionDTO }> {
  const { notes, total } = await listNotes(userId, {
    collectionId,
    page,
    pageSize: 50,
  });
  const row = await db.smartCollection.findFirst({ where: { userId, id: collectionId } });
  if (!row) throw notFound("COLLECTION_NOT_FOUND", "Collection not found.");
  const criteria = gaiaCollectionCriteriaSchema.safeParse(
    safeJsonParse(row.criteria),
  ).success
    ? (gaiaCollectionCriteriaSchema.parse(
        safeJsonParse(row.criteria),
      ) as KnowledgeCollectionCriteria)
    : {};
  return {
    notes,
    total,
    collection: collectionToDTO(row, total),
  };
}

// ── K09 — Canvas de connaissances ─────────────────────────────────────

function canvasToDTO(row: KnowledgeCanvas): GaiaCanvasDTO {
  const parsed = safeJsonParse(row.items);
  const items: GaiaCanvasItemDTO[] = [];
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      const checked = canvasItemSchema.safeParse(item);
      if (checked.success) items.push(checked.data);
    }
  }
  return {
    id: row.id,
    name: row.name,
    items,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listCanvases(
  userId: string,
): Promise<{ canvases: GaiaCanvasDTO[] }> {
  const rows = await db.knowledgeCanvas.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  return { canvases: rows.map(canvasToDTO) };
}

export async function getCanvas(
  userId: string,
  canvasId: string,
): Promise<{ canvas: GaiaCanvasDTO }> {
  const row = await db.knowledgeCanvas.findFirst({ where: { userId, id: canvasId } });
  if (!row) throw notFound("CANVAS_NOT_FOUND", "Canvas not found.");
  return { canvas: canvasToDTO(row) };
}

export async function createCanvas(
  userId: string,
  input: unknown,
): Promise<{ canvas: GaiaCanvasDTO }> {
  const parsed = parseOrThrow(canvasInputSchema, input);
  const row = await db.knowledgeCanvas.create({
    data: {
      userId,
      name: parsed.name.trim(),
      items: JSON.stringify(parsed.items ?? []),
    },
  });
  return { canvas: canvasToDTO(row) };
}

export async function updateCanvas(
  userId: string,
  canvasId: string,
  input: unknown,
): Promise<{ canvas: GaiaCanvasDTO }> {
  const parsed = parseOrThrow(canvasInputSchema, input);
  const row = await db.knowledgeCanvas.findFirst({ where: { userId, id: canvasId } });
  if (!row) throw notFound("CANVAS_NOT_FOUND", "Canvas not found.");
  // Les cartes ne peuvent référencer que des notes existantes et actives.
  let items = parsed.items;
  if (items !== undefined) {
    const ids = [...new Set(items.map((i) => i.noteId))];
    const existing = await db.note.findMany({
      where: { userId, id: { in: ids }, deletedAt: null },
      select: { id: true },
    });
    const known = new Set(existing.map((n) => n.id));
    items = items.filter((i) => known.has(i.noteId));
  }
  const updated = await db.knowledgeCanvas.update({
    where: { id: row.id },
    data: {
      name: parsed.name.trim(),
      ...(items !== undefined ? { items: JSON.stringify(items) } : {}),
    },
  });
  return { canvas: canvasToDTO(updated) };
}

export async function deleteCanvas(
  userId: string,
  canvasId: string,
): Promise<{ ok: true }> {
  const row = await db.knowledgeCanvas.findFirst({ where: { userId, id: canvasId } });
  if (!row) throw notFound("CANVAS_NOT_FOUND", "Canvas not found.");
  await db.knowledgeCanvas.delete({ where: { id: row.id } });
  return { ok: true };
}

// ── K12 — Inbox ───────────────────────────────────────────────────────

function inboxToDTO(row: InboxItem): GaiaInboxItemDTO {
  return {
    id: row.id,
    text: row.text,
    doneAt: row.doneAt?.toISOString() ?? null,
    noteId: row.noteId,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listInbox(
  userId: string,
): Promise<{ open: GaiaInboxItemDTO[]; done: GaiaInboxItemDTO[] }> {
  const rows = await db.inboxItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return {
    open: rows.filter((r) => r.doneAt === null).map(inboxToDTO),
    done: rows.filter((r) => r.doneAt !== null).map(inboxToDTO),
  };
}

export async function createInboxItem(
  userId: string,
  input: unknown,
): Promise<{ item: GaiaInboxItemDTO }> {
  const parsed = parseOrThrow(inboxInputSchema, input);
  const row = await db.inboxItem.create({
    data: { userId, text: parsed.text.trim() },
  });
  return { item: inboxToDTO(row) };
}

export async function toggleInboxItem(
  userId: string,
  itemId: string,
  done: boolean,
): Promise<{ item: GaiaInboxItemDTO }> {
  const row = await db.inboxItem.findFirst({ where: { userId, id: itemId } });
  if (!row) throw notFound("INBOX_ITEM_NOT_FOUND", "Inbox item not found.");
  const updated = await db.inboxItem.update({
    where: { id: row.id },
    data: { doneAt: done ? new Date() : null },
  });
  return { item: inboxToDTO(updated) };
}

export async function deleteInboxItem(
  userId: string,
  itemId: string,
): Promise<{ ok: true }> {
  const row = await db.inboxItem.findFirst({ where: { userId, id: itemId } });
  if (!row) throw notFound("INBOX_ITEM_NOT_FOUND", "Inbox item not found.");
  await db.inboxItem.delete({ where: { id: row.id } });
  return { ok: true };
}

export async function convertInboxItem(
  userId: string,
  itemId: string,
): Promise<{ note: GaiaNoteResponse["note"]; item: GaiaInboxItemDTO }> {
  const row = await db.inboxItem.findFirst({ where: { userId, id: itemId } });
  if (!row) throw notFound("INBOX_ITEM_NOT_FOUND", "Inbox item not found.");
  if (row.noteId) {
    const note = await findActiveNote(userId, row.noteId);
    if (note) {
      const [folders, tags] = await Promise.all([loadFolders(userId), loadTags(userId)]);
      return { note: toDTO(note), item: inboxToDTO(row) };
    }
  }
  const lines = row.text.split("\n").map((l) => l.trim()).filter((l) => l !== "");
  const title = (lines[0] ?? "").slice(0, 200);
  const blocks: GaiaBlock[] = lines.slice(0, 50).map((line) => ({
    id: newBlockId(),
    type: "paragraph",
    text: line,
  }));
  if (blocks.length === 0) blocks.push(emptyParagraphBlock());
  const created = await createNote(userId, { title, blocks });
  const updated = await db.inboxItem.update({
    where: { id: row.id },
    data: { noteId: created.note.id, doneAt: new Date() },
  });
  return { note: created.note, item: inboxToDTO(updated) };
}

// ── K10 / K11 — Notes quotidiennes et hebdomadaires ───────────────────

async function findOrCreateFolder(userId: string, name: string): Promise<NoteFolder> {
  const existing = await db.noteFolder.findFirst({ where: { userId, name } });
  if (existing) return existing;
  return db.noteFolder.create({ data: { userId, name, parentId: null } });
}

export async function getOrCreateDailyNote(
  userId: string,
): Promise<GaiaNoteResponse> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const tz = user?.timezone ?? "UTC";
  const now = new Date();
  const title = dailyNoteTitle(now, tz);
  const folder = await findOrCreateFolder(userId, "Daily Notes");
  const existing = await db.note.findFirst({
    where: { userId, folderId: folder.id, title, deletedAt: null },
  });
  if (existing) {
    const touched = await db.note.update({
      where: { id: existing.id },
      data: { lastViewedAt: new Date() },
    });
    const [folders, tags] = await Promise.all([loadFolders(userId), loadTags(userId)]);
    return noteResponse(userId, touched, folders, tags);
  }
  const longDate = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);
  const blocks: GaiaBlock[] = [
    { id: newBlockId(), type: "h1", text: longDate },
    { id: newBlockId(), type: "h2", text: "Tasks" },
    { id: newBlockId(), type: "todo", text: "" },
    { id: newBlockId(), type: "h2", text: "Notes" },
    { id: newBlockId(), type: "paragraph", text: "" },
  ];
  return createNote(userId, { title, folderId: folder.id, blocks });
}

export async function getOrCreateWeeklyNote(
  userId: string,
): Promise<GaiaNoteResponse> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const tz = user?.timezone ?? "UTC";
  const now = new Date();
  const title = weeklyNoteTitle(now);
  const folder = await findOrCreateFolder(userId, "Weekly Notes");
  const existing = await db.note.findFirst({
    where: { userId, folderId: folder.id, title, deletedAt: null },
  });
  if (existing) {
    const touched = await db.note.update({
      where: { id: existing.id },
      data: { lastViewedAt: new Date() },
    });
    const [folders, tags] = await Promise.all([loadFolders(userId), loadTags(userId)]);
    return noteResponse(userId, touched, folders, tags);
  }
  const monday = weekStart(now);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
  });
  const range = `${fmt.format(monday)} – ${fmt.format(sunday)}, ${monday.getFullYear()}`;
  const blocks: GaiaBlock[] = [
    { id: newBlockId(), type: "h1", text: title },
    { id: newBlockId(), type: "paragraph", text: range },
    { id: newBlockId(), type: "h2", text: "Goals" },
    { id: newBlockId(), type: "todo", text: "" },
    { id: newBlockId(), type: "h2", text: "Review" },
    { id: newBlockId(), type: "paragraph", text: "" },
    { id: newBlockId(), type: "h2", text: "Notes" },
    { id: newBlockId(), type: "paragraph", text: "" },
  ];
  return createNote(userId, { title, folderId: folder.id, blocks });
}

// ── Module 3 — File & Document Management (F01–F15) ─────────────────────
// Les binaires vivent dans Supabase Storage (bucket privé `gaia-files`) ;
// ici ne vivent que les métadonnées, toujours scopées par userId.

/** F03/F12 — liste des fichiers : lecture déléguée au module Files. */
export async function listFiles(
  userId: string,
  params: ListFilesParams = {},
): Promise<{ files: GaiaFileDTO[]; total: number }> {
  return listFilesQuery(userId, params);
}

/** F03 — détail d'un fichier : lecture déléguée au module Files. */
export async function getFile(
  userId: string,
  fileId: string,
): Promise<{ file: GaiaFileDetailDTO }> {
  return getFileQuery(userId, fileId, FILE_NOT_FOUND);
}

/** F01/F02 — upload : binaire → Storage, métadonnées + version 1 en base. */
export async function createFileRecord(
  userId: string,
  input: { name: string; mimeType: string; size: number; folderId?: string | null; buffer: Buffer },
): Promise<{ file: GaiaFileDTO }> {
  if (!isStorageConfigured()) throw STORAGE_NOT_CONFIGURED();
  const client = getStorageClient();
  if (!client) throw STORAGE_NOT_CONFIGURED();
  const name = input.name.trim().slice(0, 200);
  if (name === "") throw validationError("File name is required.");
  if (input.size <= 0 || input.size > GAIA_MAX_FILE_BYTES) {
    throw validationError("File size is out of bounds.");
  }
  let folderId: string | null = null;
  if (input.folderId) {
    const folder = await db.noteFolder.findFirst({ where: { userId, id: input.folderId } });
    if (!folder) throw FOLDER_NOT_FOUND();
    folderId = folder.id;
  }
  const id = `cm${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const path = storagePathFor(userId, id, 1, name);
  const uploaded = await uploadToStorage(client, path, input.buffer, input.mimeType);
  if (!uploaded.ok) {
    throw new GaiaError("ServiceUnavailable", "STORAGE_UPLOAD_FAILED", 503, uploaded.error ?? "Upload failed.");
  }
  try {
    const row = await db.gaiaFile.create({
      data: {
        id,
        userId,
        name,
        mimeType: input.mimeType.slice(0, 200),
        size: input.size,
        storagePath: path,
        folderId,
        versions: { create: { version: 1, storagePath: path, size: input.size } },
      },
    });
    return { file: fileToDTO(row, folderId ? (await loadFolders(userId)).find((f) => f.id === folderId)?.name ?? null : null, 1, 0) };
  } catch (error) {
    await removeFromStorage(client, [path]);
    throw error;
  }
}

/** F01 — renommer / déplacer un fichier (métadonnées uniquement). */
export async function updateFile(
  userId: string,
  fileId: string,
  input: unknown,
): Promise<{ file: GaiaFileDTO }> {
  const parsed = parseOrThrow(fileUpdateInputSchema, input);
  return updateFileCommand(userId, fileId, parsed, {
    fileNotFound: FILE_NOT_FOUND,
    folderNotFound: FOLDER_NOT_FOUND,
  });
}
/** F13 — remplacer le contenu : nouvelle version, l'ancienne est conservée. */
export async function replaceFile(
  userId: string,
  fileId: string,
  input: { name: string; mimeType: string; size: number; buffer: Buffer },
): Promise<{ file: GaiaFileDTO }> {
  return replaceFileCommand(userId, fileId, input, {
    fileNotFound: FILE_NOT_FOUND,
    storageNotConfigured: STORAGE_NOT_CONFIGURED,
    validationError,
    storageUploadFailed: (message) =>
      new GaiaError("ServiceUnavailable", "STORAGE_UPLOAD_FAILED", 503, message),
    storageCleanupFailed: (message) =>
      new GaiaError("ServiceUnavailable", "STORAGE_CLEANUP_FAILED", 503, message),
    versionConflict: () =>
      conflictError("FILE_VERSION_CONFLICT", "The file changed during this operation. Refresh and retry."),
  }, {
    isConfigured: isStorageConfigured,
    getClient: getStorageClient,
    remove: removeFromStorage,
    pathFor: storagePathFor,
    upload: uploadToStorage,
  });
}

/** F13 — restaurer une ancienne version : crée une version qui pointe vers l'ancien binaire. */
export async function restoreFileVersion(
  userId: string,
  fileId: string,
  version: number,
): Promise<{ file: GaiaFileDTO }> {
  return restoreFileVersionCommand(userId, fileId, version, {
    fileNotFound: FILE_NOT_FOUND,
    versionNotFound: () => notFound("FILE_VERSION_NOT_FOUND", "File version not found."),
    validationError,
    versionConflict: () =>
      conflictError("FILE_VERSION_CONFLICT", "The file changed during this operation. Refresh and retry."),
  });
}

/** F01 — supprimer un fichier : base + toutes les versions dans Storage. */
export async function deleteFile(userId: string, fileId: string): Promise<{ ok: true }> {
  return deleteFileCommand(userId, fileId, {
    fileNotFound: FILE_NOT_FOUND,
    storageNotConfigured: STORAGE_NOT_CONFIGURED,
    storageRemovalFailed: (message) =>
      new GaiaError("ServiceUnavailable", "STORAGE_DELETE_FAILED", 503, message),
  }, {
    isConfigured: isStorageConfigured,
    getClient: getStorageClient,
    remove: removeFromStorage,
  });
}

/** F01 — télécharger le binaire d'un fichier (version courante). */
export async function downloadFile(
  userId: string,
  fileId: string,
): Promise<{ blob: Blob; contentType: string; name: string; size: number }> {
  if (!isStorageConfigured()) throw STORAGE_NOT_CONFIGURED();
  const client = getStorageClient();
  if (!client) throw STORAGE_NOT_CONFIGURED();
  const row = await db.gaiaFile.findFirst({ where: { userId, id: fileId } });
  if (!row) throw FILE_NOT_FOUND();
  const result = await downloadFromStorage(client, row.storagePath);
  if (!result.ok) {
    throw new GaiaError("ServiceUnavailable", "STORAGE_DOWNLOAD_FAILED", 503, result.error);
  }
  return { blob: result.blob, contentType: result.contentType, name: row.name, size: row.size };
}

/** F10/F12 — enregistrer le texte extrait (calque texte PDF ou OCR). */
export async function saveFileText(
  userId: string,
  fileId: string,
  input: unknown,
): Promise<{ file: GaiaFileDTO }> {
  const parsed = parseOrThrow(fileTextInputSchema, input);
  return saveFileTextCommand(userId, fileId, parsed, FILE_NOT_FOUND);
}

/** F05 — ajouter une annotation à un document. */
export async function createFileAnnotation(
  userId: string,
  fileId: string,
  input: unknown,
): Promise<{ annotation: GaiaFileAnnotationDTO }> {
  const parsed = parseOrThrow(fileAnnotationInputSchema, input);
  return createFileAnnotationCommand(userId, fileId, parsed, FILE_NOT_FOUND);
}

/** F05 — supprimer une annotation. */
export async function deleteFileAnnotation(
  userId: string,
  fileId: string,
  annotationId: string,
): Promise<{ ok: true }> {
  return deleteFileAnnotationCommand(
    userId,
    fileId,
    annotationId,
    () => notFound("ANNOTATION_NOT_FOUND", "Annotation not found."),
  );
}

/** F06/F15 — attacher un fichier à une note. */
export async function attachFileToNote(
  userId: string,
  noteId: string,
  fileId: string,
): Promise<{ ok: true }> {
  return attachFileToNoteCommand(userId, noteId, fileId, {
    noteNotFound: NOTE_NOT_FOUND,
    fileNotFound: FILE_NOT_FOUND,
  });
}

/** F06 — détacher un fichier d'une note (le fichier lui-même est conservé). */
export async function detachFileFromNote(
  userId: string,
  noteId: string,
  fileId: string,
): Promise<{ ok: true }> {
  return detachFileFromNoteCommand(userId, noteId, fileId, NOTE_NOT_FOUND);
}

/** F06 — fichiers attachés à une note. */
export async function listNoteFiles(
  userId: string,
  noteId: string,
): Promise<{ files: GaiaFileDTO[] }> {
  return listNoteFilesQuery(userId, noteId, NOTE_NOT_FOUND);
}

/** F15 — notes qui référencent un fichier. */
export async function listFileNotes(
  userId: string,
  fileId: string,
): Promise<{ notes: Array<{ id: string; title: string; updatedAt: string }> }> {
  return listFileNotesQuery(userId, fileId, FILE_NOT_FOUND);
}

/** F14 — espace de stockage : lecture déléguée au module Files. */
export async function getStorageUsage(userId: string): Promise<{ usage: GaiaStorageUsageDTO }> {
  return getStorageUsageQuery(userId);
}
