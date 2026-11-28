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
export { gaiaNotePropertySchema } from "@/modules/notes/schemas";
import type { GaiaSmartCollectionDTO, GaiaCanvasDTO, GaiaInboxItemDTO } from "@/modules/knowledge/types";
export type { GaiaSmartCollectionDTO, GaiaCanvasDTO, GaiaCanvasItemDTO, GaiaInboxItemDTO } from "@/modules/knowledge/types";
import { gaiaCollectionCriteriaSchema } from "@/modules/knowledge/schemas";
export { gaiaCollectionCriteriaSchema } from "@/modules/knowledge/schemas";
import {
  listCollectionsQuery,
  createCollectionCommand,
  updateCollectionCommand,
  deleteCollectionCommand,
  listCollectionNotesQuery,
} from "@/modules/knowledge/services/collections";
import {
  listCanvasesQuery,
  getCanvasQuery,
  createCanvasCommand,
  updateCanvasCommand,
  deleteCanvasCommand,
} from "@/modules/knowledge/services/canvas";
import {
  listInboxQuery,
  createInboxItemCommand,
  toggleInboxItemCommand,
  deleteInboxItemCommand,
  convertInboxItemCommand,
} from "@/modules/knowledge/services/inbox";
import {
  getOrCreateDailyNoteCommand,
  getOrCreateWeeklyNoteCommand,
} from "@/modules/knowledge/services/periodic-notes";
import type {
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

import type {
  GaiaKnowledgeTimelineMonth,
  GaiaNoteRelationDTO,
  GaiaNoteLinksResponse,
  GaiaLinkSuggestion,
  GaiaMemoryGraphResponse,
  GaiaMemoryStatsResponse,
} from "@/modules/knowledge/types";
export type {
  GaiaKnowledgeTimelineMonth,
  GaiaNoteRelationDTO,
  GaiaNoteLinkItem,
  GaiaUnlinkedMention,
  GaiaNoteLinksResponse,
  GaiaLinkSuggestion,
  GaiaMemoryGraphNode,
  GaiaMemoryGraphEdge,
  GaiaMemoryGraphResponse,
  GaiaMemoryHeatmapDay,
  GaiaMemoryTimelineNote,
  GaiaMemoryTimelineMonth,
  GaiaMemoryJournal,
  GaiaMemoryStatsResponse,
} from "@/modules/knowledge/types";
import {
  createNoteRelationCommand,
  deleteNoteRelationCommand,
  listNoteRelationsQuery,
} from "@/modules/knowledge/services/relations";
import { getKnowledgeTimelineQuery } from "@/modules/knowledge/services/timeline";
import { getMemoryGraphQuery } from "@/modules/knowledge/services/memory-graph";
import { getMemoryStatsQuery } from "@/modules/knowledge/services/memory-stats";
import { getOverviewQuery } from "@/modules/knowledge/services/overview";
import { getNoteLinksQuery } from "@/modules/knowledge/services/links";
import { getLinkSuggestionsQuery } from "@/modules/knowledge/services/suggestions";
import { getOrphanNotesQuery } from "@/modules/knowledge/services/orphans";
import { parseJsonProperties, tagNamesOf, toRow, noteResponse } from "@/modules/notes/mappers";
import {
  listUserRelations as loadRelations,
  loadActiveNoteTitles as loadNoteTitles,
} from "@/modules/knowledge/repositories/relations";
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
import { listNotesQuery, loadBlocksFor, loadOverviewNotesQuery, loadSearchNotesQuery } from "@/modules/notes/services/list";
import { searchNotesQuery } from "@/modules/notes/services/search";
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
  excerptOf,
  gaiaBlocksInputSchema,
  gaiaRefKindSchema,
  normalizeBlocks,
  parseJsonBlocks,
  parseJsonStringArray,
  searchSnippet,
  textOfBlocks,
  type GaiaRefKind,
} from "@/lib/gaia/content";
import { listRefs as listRefsRaw, type GaiaRefHit } from "@/lib/gaia/refs";
import {
  isMasteryLevel,
  isTimePeriod,
  periodOf,
  type TimePeriod,
} from "@/lib/gaia/spaced-repetition";
import { createNoteSnapshotIfNeeded } from "@/modules/notes/services/snapshots";
import { normalizeProperties } from "@/modules/notes/normalization";
import { findActiveNote, loadFolders, loadTags } from "@/modules/notes/repositories/notes";
import { folderInputSchema, tagInputSchema } from "@/modules/knowledge/schemas";
import { assertSafeImageSources } from "@/modules/notes/content-validation";
import { createEmptyParagraphBlock } from "@/modules/notes/services/block-copy";
import { cloneBlocksWithNewIds } from "@/modules/notes/services/block-copy";
import {
  isDescendantOf,
  suggestLinks,
  tokenize,
  weekStart,
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


/* ── Types de réponse ────────────────────────────────────────────────── */

/* ── Module 2 — Knowledge Management System : types de réponse ─────── */

import type {
  GaiaFolderDTO,
  GaiaTagDTO,
  GaiaOverviewResponse,
} from "@/modules/knowledge/types";
export type {
  GaiaFolderDTO,
  GaiaTagDTO,
  GaiaActivityWeek,
  GaiaOverviewResponse,
} from "@/modules/knowledge/types";

/* ── Helpers ─────────────────────────────────────────────────────────── */






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
    emptyParagraphBlock: createEmptyParagraphBlock,
    assertSafeImageSources: (blocks) => assertSafeImageSources(blocks, validationError),
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
    assertSafeImageSources: (blocks) => assertSafeImageSources(blocks, validationError),
    normalizeProperties,
    maybeSnapshotVersion: createNoteSnapshotIfNeeded,
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
    emptyParagraphBlock: createEmptyParagraphBlock,
    assertSafeImageSources: (blocks) => assertSafeImageSources(blocks, validationError),
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

export async function getMemoryGraph(
  userId: string,
): Promise<GaiaMemoryGraphResponse> {
  return getMemoryGraphQuery(userId, { loadTags });
}

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
  return getMemoryStatsQuery(userId);
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
    maybeSnapshotVersion: createNoteSnapshotIfNeeded,
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
    emptyParagraphBlock: createEmptyParagraphBlock,
    assertSafeImageSources: (blocks) => assertSafeImageSources(blocks, validationError),
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
    emptyParagraphBlock: createEmptyParagraphBlock,
    assertSafeImageSources: (blocks) => assertSafeImageSources(blocks, validationError),
    findActiveNote,
    createNote,
  });
}

/* ── Overview ────────────────────────────────────────────────────────── */

export async function getOverview(userId: string): Promise<GaiaOverviewResponse> {
  return getOverviewQuery(userId, {
    loadFolders,
    loadTags,
    loadNotes: loadOverviewNotesQuery,
    loadBlocksFor,
    toRow,
    parseTagIds: parseJsonStringArray,
    listTemplates: (ownerId) => listTemplatesQuery(ownerId, parseJsonBlocks),
  });
}

/* ── Recherche ───────────────────────────────────────────────────────── */

export async function searchNotes(
  userId: string,
  q: string,
): Promise<{ results: (GaiaNoteRow & { snippet: string })[]; total: number }> {
  return searchNotesQuery(userId, q, {
    loadFolders,
    loadTags,
    loadNotes: loadSearchNotesQuery,
    parseBlocks: parseJsonBlocks,
    parseTagIds: parseJsonStringArray,
    textOfBlocks,
    searchSnippet,
    excerptOf,
    tagNamesOf,
    toRow,
  });
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
  return getNoteLinksQuery(userId, noteId, {
    findActiveNote,
    loadFolders,
    loadTags,
    loadRelations,
    loadNoteTitles,
    toRow,
    noteNotFound: NOTE_NOT_FOUND,
  });
}

// ── K14 — Suggestions de liens ────────────────────────────────────────

export async function getLinkSuggestions(
  userId: string,
  noteId: string,
): Promise<{ suggestions: GaiaLinkSuggestion[] }> {
  return getLinkSuggestionsQuery(userId, noteId, {
    findActiveNote,
    getNoteLinks,
    noteNotFound: NOTE_NOT_FOUND,
  });
}

// ── K15 — Notes orphelines ─────────────────────────────────────────────

export async function getOrphanNotes(
  userId: string,
): Promise<{ notes: GaiaNoteRow[]; total: number }> {
  return getOrphanNotesQuery(userId, {
    loadFolders,
    loadTags,
    loadRelations,
    toRow,
  });
}

// ── K16 — Timeline des connaissances ──────────────────────────────────

export async function getKnowledgeTimeline(
  userId: string,
): Promise<{ months: GaiaKnowledgeTimelineMonth[] }> {
  return getKnowledgeTimelineQuery(userId);
}

// ── K06 — Collections dynamiques ──────────────────────────────────────

const collectionDependencies = () => ({
  validationError,
  collectionNotFound: () => notFound("COLLECTION_NOT_FOUND", "Collection not found."),
  folderNotFound: FOLDER_NOT_FOUND,
  loadFolders,
  parseJsonProperties,
  listNotes,
});

export async function listCollections(
  userId: string,
): Promise<{ collections: GaiaSmartCollectionDTO[] }> {
  return listCollectionsQuery(userId, collectionDependencies());
}

export async function createCollection(
  userId: string,
  input: unknown,
): Promise<{ collection: GaiaSmartCollectionDTO }> {
  return createCollectionCommand(userId, input, collectionDependencies());
}

export async function updateCollection(
  userId: string,
  collectionId: string,
  input: unknown,
): Promise<{ collection: GaiaSmartCollectionDTO }> {
  return updateCollectionCommand(userId, collectionId, input, collectionDependencies());
}

export async function deleteCollection(
  userId: string,
  collectionId: string,
): Promise<{ ok: true }> {
  return deleteCollectionCommand(userId, collectionId, collectionDependencies());
}

export async function listCollectionNotes(
  userId: string,
  collectionId: string,
  page = 1,
): Promise<{ notes: GaiaNoteRow[]; total: number; collection: GaiaSmartCollectionDTO }> {
  return listCollectionNotesQuery(userId, collectionId, page, collectionDependencies());
}

// ── K09 — Canvas de connaissances ─────────────────────────────────────

const canvasDependencies = () => ({
  validationError,
  canvasNotFound: () => notFound("CANVAS_NOT_FOUND", "Canvas not found."),
});

export async function listCanvases(
  userId: string,
): Promise<{ canvases: GaiaCanvasDTO[] }> {
  return listCanvasesQuery(userId);
}

export async function getCanvas(
  userId: string,
  canvasId: string,
): Promise<{ canvas: GaiaCanvasDTO }> {
  return getCanvasQuery(userId, canvasId, canvasDependencies());
}

export async function createCanvas(
  userId: string,
  input: unknown,
): Promise<{ canvas: GaiaCanvasDTO }> {
  return createCanvasCommand(userId, input, canvasDependencies());
}

export async function updateCanvas(
  userId: string,
  canvasId: string,
  input: unknown,
): Promise<{ canvas: GaiaCanvasDTO }> {
  return updateCanvasCommand(userId, canvasId, input, canvasDependencies());
}

export async function deleteCanvas(
  userId: string,
  canvasId: string,
): Promise<{ ok: true }> {
  return deleteCanvasCommand(userId, canvasId, canvasDependencies());
}

// ── K12 — Inbox ───────────────────────────────────────────────────────

const inboxDependencies = () => ({
  validationError,
  inboxItemNotFound: () => notFound("INBOX_ITEM_NOT_FOUND", "Inbox item not found."),
  findActiveNote,
  loadFolders,
  loadTags,
  toDTO,
  createNote,
});

export async function listInbox(
  userId: string,
): Promise<{ open: GaiaInboxItemDTO[]; done: GaiaInboxItemDTO[] }> {
  return listInboxQuery(userId);
}

export async function createInboxItem(
  userId: string,
  input: unknown,
): Promise<{ item: GaiaInboxItemDTO }> {
  return createInboxItemCommand(userId, input, inboxDependencies());
}

export async function toggleInboxItem(
  userId: string,
  itemId: string,
  done: boolean,
): Promise<{ item: GaiaInboxItemDTO }> {
  return toggleInboxItemCommand(userId, itemId, done, inboxDependencies());
}

export async function deleteInboxItem(
  userId: string,
  itemId: string,
): Promise<{ ok: true }> {
  return deleteInboxItemCommand(userId, itemId, inboxDependencies());
}

export async function convertInboxItem(
  userId: string,
  itemId: string,
): Promise<{ note: GaiaNoteResponse["note"]; item: GaiaInboxItemDTO }> {
  return convertInboxItemCommand(userId, itemId, inboxDependencies());
}

// ── K10 / K11 — Notes quotidiennes et hebdomadaires ───────────────────

export async function getOrCreateDailyNote(
  userId: string,
): Promise<GaiaNoteResponse> {
  return getOrCreateDailyNoteCommand(userId, {
    loadFolders,
    loadTags,
    noteResponse,
    createNote,
  });
}

export async function getOrCreateWeeklyNote(
  userId: string,
): Promise<GaiaNoteResponse> {
  return getOrCreateWeeklyNoteCommand(userId, {
    loadFolders,
    loadTags,
    noteResponse,
    createNote,
  });
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