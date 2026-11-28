/**
 * Gaïa : workspace de notes, accès données côté serveur (userId-scoped).
 *
 * Réplique du service Nofy d'Euforia, adaptée aux tables Prisma de Promethe
 * (Note / NoteFolder / NoteTag / NoteTemplate / NoteVersion). Aucun contenu
 * de démonstration : le workspace démarre vide, l'utilisateur crée ses
 * propres dossiers, tags et notes. L'accès inter-utilisateur est rendu
 * comme un 404.
 */
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
export type {
  GaiaFileAnnotationDTO,
  GaiaFileDTO,
  GaiaFileDetailDTO,
  GaiaFileVersionDTO,
  GaiaStorageUsageDTO,
  ListFilesParams,
} from "@/server/gaia/files";
export {
  listFiles,
  getFile,
  createFileRecord,
  updateFile,
  replaceFile,
  restoreFileVersion,
  deleteFile,
  downloadFile,
  saveFileText,
  createFileAnnotation,
  deleteFileAnnotation,
  attachFileToNote,
  detachFileFromNote,
  listNoteFiles,
  listFileNotes,
  getStorageUsage,
} from "@/server/gaia/files";

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

/* ── Erreurs ─────────────────────────────────────────────────────────── */

import {
  conflictError,
  notFound,
  validationError,
} from "@/shared/errors/gaia-error";
import { parseOrThrow } from "@/shared/validation/parse-or-throw";
export { GaiaError } from "@/shared/errors/gaia-error";

const NOTE_NOT_FOUND = () => notFound("NOTE_NOT_FOUND", "Note not found.");
const FOLDER_NOT_FOUND = () => notFound("FOLDER_NOT_FOUND", "Folder not found.");
const TEMPLATE_NOT_FOUND = () => notFound("TEMPLATE_NOT_FOUND", "Template not found.");
const VERSION_NOT_FOUND = () => notFound("VERSION_NOT_FOUND", "Version not found.");

export { gaiaErrorResponse } from "@/shared/http/gaia-error-response";

/* ── Schémas d'entrée ────────────────────────────────────────────────── */


/* ── Module 2 — Knowledge Management System (K01–K17) ─────────────── */





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

export type { GaiaWritingSettings, GaiaTodayWords } from "@/server/gaia/writing";
export { getWritingSettings, updateWritingSettings, getTodayWords } from "@/server/gaia/writing";

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
