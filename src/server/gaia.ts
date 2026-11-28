import "server-only";

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
  createCollection as createCollectionAdapter,
  deleteCollection as deleteCollectionAdapter,
  listCollectionNotes as listCollectionNotesAdapter,
  listCollections as listCollectionsAdapter,
  updateCollection as updateCollectionAdapter,
} from "@/server/gaia/collections";
import {
  createCanvas as createCanvasAdapter,
  deleteCanvas as deleteCanvasAdapter,
  getCanvas as getCanvasAdapter,
  listCanvases as listCanvasesAdapter,
  updateCanvas as updateCanvasAdapter,
} from "@/server/gaia/canvas";
import {
  convertInboxItem as convertInboxItemAdapter,
  createInboxItem as createInboxItemAdapter,
  deleteInboxItem as deleteInboxItemAdapter,
  listInbox as listInboxAdapter,
  toggleInboxItem as toggleInboxItemAdapter,
} from "@/server/gaia/inbox";
import {
  getOrCreateDailyNote as getOrCreateDailyNoteAdapter,
  getOrCreateWeeklyNote as getOrCreateWeeklyNoteAdapter,
} from "@/server/gaia/periodic-notes";
import type {
  GaiaNoteProperty,
  GaiaNotePropertyType,
  GaiaNoteResponse,
  GaiaNoteRow,
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
  GaiaNoteRelationDTO,
  GaiaNoteLinksResponse,
  GaiaLinkSuggestion,
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
  createNoteRelation as createNoteRelationAdapter,
  deleteNoteRelation as deleteNoteRelationAdapter,
  getLinkSuggestions as getLinkSuggestionsAdapter,
  getNoteLinks as getNoteLinksAdapter,
  getOrphanNotes as getOrphanNotesAdapter,
  listNoteRelations as listNoteRelationsAdapter,
} from "@/server/gaia/knowledge-navigation";
import { getOverview as getOverviewAdapter } from "@/server/gaia/overview";
import { parseJsonProperties, toDTO, toRow, noteResponse } from "@/modules/notes/mappers";
import {
  listUserRelations as loadRelationsRaw,
  loadActiveNoteTitles as loadNoteTitlesRaw,
} from "@/modules/knowledge/repositories/relations";
import {
  purgeNote,
  restoreNote,
  trashNote,
} from "@/server/gaia/notes-lifecycle";
import { listTemplatesQuery } from "@/modules/notes/services/templates";
import {
  createNote as createNoteAdapter,
  updateNote as updateNoteAdapter,
  duplicateNote as duplicateNoteAdapter,
} from "@/server/gaia/notes-write";
import {
  createTemplate,
  instantiateTemplate as instantiateTemplateAdapter,
  listTemplates,
} from "@/server/gaia/templates";

import { loadOverviewNotesQuery, loadBlocksFor } from "@/modules/notes/services/list";
import {
  getNote as getNoteAdapter,
  listNotes as listNotesAdapter,
  searchNotes as searchNotesAdapter,
} from "@/server/gaia/notes-read";

import type { GaiaListQuery } from "@/modules/notes/types";
export type { GaiaListQuery } from "@/modules/notes/types";

import {
  moveNoteToMastery,
  reviewNote,
  scheduleNote,
} from "@/server/gaia/notes-review";
import {
  gaiaBlocksInputSchema,
  gaiaRefKindSchema,
  normalizeBlocks,
  parseJsonBlocks,
  parseJsonStringArray,
  type GaiaRefKind,
} from "@/lib/gaia/content";
export { listGaiaRefs } from "@/server/gaia/references";
export type { GaiaRefHit } from "@/server/gaia/references";


import { normalizeProperties } from "@/modules/notes/normalization";
import { findActiveNote, loadFolders, loadTags } from "@/modules/notes/repositories/notes";
import { assertSafeImageSources } from "@/modules/notes/content-validation";
import { createEmptyParagraphBlock } from "@/modules/notes/services/block-copy";


/* ── Erreurs ─────────────────────────────────────────────────────────── */

import {
  conflictError,
  notFound,
  validationError,
} from "@/shared/errors/gaia-error";
export { GaiaError } from "@/shared/errors/gaia-error";

const NOTE_NOT_FOUND = () => notFound("NOTE_NOT_FOUND", "Note not found.");
const FOLDER_NOT_FOUND = () => notFound("FOLDER_NOT_FOUND", "Folder not found.");


export { gaiaErrorResponse } from "@/shared/http/gaia-error-response";

/* ── Schémas d'entrée ────────────────────────────────────────────────── */


/* ── Module 2 — Knowledge Management System (K01–K17) ─────────────── */





/**
 * Rejette les blocs image/dessin dont le src utilise un protocole non
 * autorisé, et les embeds dont l'URL n'est pas https. Récursif (Module 1).
 */


/* ── Types de réponse ────────────────────────────────────────────────── */

/* ── Module 2 — Knowledge Management System : types de réponse ─────── */

import type { GaiaOverviewResponse } from "@/modules/knowledge/types";
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
  return listNotesAdapter(userId, query);
}


export async function getNote(
  userId: string,
  noteId: string,
): Promise<GaiaNoteResponse> {
  return getNoteAdapter(userId, noteId);
}

/* ── Notes : écriture ────────────────────────────────────────────────── */

export async function createNote(
  userId: string,
  input: unknown,
): Promise<GaiaNoteResponse> {
  return createNoteAdapter(userId, input);
}

export async function updateNote(
  userId: string,
  noteId: string,
  input: unknown,
): Promise<GaiaNoteResponse> {
  return updateNoteAdapter(userId, noteId, input);
}

/* ── Module 1 — Objectifs d'écriture (E12) ─────────────────────────────── */

export type { GaiaWritingSettings, GaiaTodayWords } from "@/server/gaia/writing";
export { getWritingSettings, updateWritingSettings, getTodayWords } from "@/server/gaia/writing";

export { trashNote, restoreNote, purgeNote };

export async function duplicateNote(
  userId: string,
  noteId: string,
  input: unknown,
): Promise<GaiaNoteResponse> {
  return duplicateNoteAdapter(userId, noteId, input);
}

/* ── Phase 1 — Memory : révision espacée + statistiques ────────────────── */

export { reviewNote, moveNoteToMastery, scheduleNote };

/* ── Phase 2 — Knowledge graph ─────────────────────────────────────────── */

export { getMemoryGraph, getMemoryStats, getKnowledgeTimeline } from "@/server/gaia/knowledge-insights";

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


/* ── Versions ────────────────────────────────────────────────────────── */

export { listVersions, getVersion, restoreVersion } from "@/server/gaia/versions";





export {
  listFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  listTags,
  createTag,
  updateTag,
  deleteTag,
} from "@/server/gaia/taxonomy";

/* ── Modèles ─────────────────────────────────────────────────────────── */

export { listTemplates, createTemplate };

export async function instantiateTemplate(
  userId: string,
  input: unknown,
): Promise<GaiaNoteResponse> {
  return instantiateTemplateAdapter(userId, input, createNote);
}

/* ── Overview ────────────────────────────────────────────────────────── */

export async function getOverview(userId: string): Promise<GaiaOverviewResponse> {
  return getOverviewAdapter(userId, {
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
  return searchNotesAdapter(userId, q);
}

/* ── Refs ────────────────────────────────────────────────────────────── */

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
  return listNoteRelationsAdapter(userId, noteId, {
    noteNotFound: NOTE_NOT_FOUND,
  });
}

export async function createNoteRelation(
  userId: string,
  noteId: string,
  input: unknown,
): Promise<{ relation: GaiaNoteRelationDTO }> {
  return createNoteRelationAdapter(userId, noteId, input, {
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
  return deleteNoteRelationAdapter(userId, noteId, relationId, {
    relationNotFound: () => notFound("RELATION_NOT_FOUND", "Relation not found."),
  });
}

// ── K02 / K03 / K04 — Backlinks// ── K02 / K03 / K04 — Backlinks, mentions non liées, liens sortants ───

export async function getNoteLinks(
  userId: string,
  noteId: string,
): Promise<GaiaNoteLinksResponse> {
  return getNoteLinksAdapter(userId, noteId, {
    findActiveNote,
    loadFolders,
    loadTags,
    loadRelations: loadRelationsRaw,
    loadNoteTitles: loadNoteTitlesRaw,
    toRow,
    noteNotFound: NOTE_NOT_FOUND,
  });
}

// ── K14 — Suggestions de liens// ── K14 — Suggestions de liens ────────────────────────────────────────

export async function getLinkSuggestions(
  userId: string,
  noteId: string,
): Promise<{ suggestions: GaiaLinkSuggestion[] }> {
  return getLinkSuggestionsAdapter(userId, noteId, {
    findActiveNote,
    getNoteLinks,
    noteNotFound: NOTE_NOT_FOUND,
  });
}

// ── K15 — Notes orphelines// ── K15 — Notes orphelines ─────────────────────────────────────────────

export async function getOrphanNotes(
  userId: string,
): Promise<{ notes: GaiaNoteRow[]; total: number }> {
  return getOrphanNotesAdapter(userId, {
    loadFolders,
    loadTags,
    loadRelations: loadRelationsRaw,
    toRow,
  });
}

// ── K16 — Timeline des connaissances// ── K16 — Timeline des connaissances ──────────────────────────────────



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
  return listCollectionsAdapter(userId, collectionDependencies());
}

export async function createCollection(
  userId: string,
  input: unknown,
): Promise<{ collection: GaiaSmartCollectionDTO }> {
  return createCollectionAdapter(userId, input, collectionDependencies());
}

export async function updateCollection(
  userId: string,
  collectionId: string,
  input: unknown,
): Promise<{ collection: GaiaSmartCollectionDTO }> {
  return updateCollectionAdapter(userId, collectionId, input, collectionDependencies());
}

export async function deleteCollection(
  userId: string,
  collectionId: string,
): Promise<{ ok: true }> {
  return deleteCollectionAdapter(userId, collectionId, collectionDependencies());
}

export async function listCollectionNotes(
  userId: string,
  collectionId: string,
  page = 1,
): Promise<{ notes: GaiaNoteRow[]; total: number; collection: GaiaSmartCollectionDTO }> {
  return listCollectionNotesAdapter(userId, collectionId, page, collectionDependencies());
}

// ── K09 — Canvas de connaissances ─────────────────────────────────────

const canvasDependencies = () => ({
  validationError,
  canvasNotFound: () => notFound("CANVAS_NOT_FOUND", "Canvas not found."),
});

export async function listCanvases(
  userId: string,
): Promise<{ canvases: GaiaCanvasDTO[] }> {
  return listCanvasesAdapter(userId);
}

export async function getCanvas(
  userId: string,
  canvasId: string,
): Promise<{ canvas: GaiaCanvasDTO }> {
  return getCanvasAdapter(userId, canvasId, canvasDependencies());
}

export async function createCanvas(
  userId: string,
  input: unknown,
): Promise<{ canvas: GaiaCanvasDTO }> {
  return createCanvasAdapter(userId, input, canvasDependencies());
}

export async function updateCanvas(
  userId: string,
  canvasId: string,
  input: unknown,
): Promise<{ canvas: GaiaCanvasDTO }> {
  return updateCanvasAdapter(userId, canvasId, input, canvasDependencies());
}

export async function deleteCanvas(
  userId: string,
  canvasId: string,
): Promise<{ ok: true }> {
  return deleteCanvasAdapter(userId, canvasId, canvasDependencies());
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
  return listInboxAdapter(userId);
}

export async function createInboxItem(
  userId: string,
  input: unknown,
): Promise<{ item: GaiaInboxItemDTO }> {
  return createInboxItemAdapter(userId, input, inboxDependencies());
}

export async function toggleInboxItem(
  userId: string,
  itemId: string,
  done: boolean,
): Promise<{ item: GaiaInboxItemDTO }> {
  return toggleInboxItemAdapter(userId, itemId, done, inboxDependencies());
}

export async function deleteInboxItem(
  userId: string,
  itemId: string,
): Promise<{ ok: true }> {
  return deleteInboxItemAdapter(userId, itemId, inboxDependencies());
}

export async function convertInboxItem(
  userId: string,
  itemId: string,
): Promise<{ note: GaiaNoteResponse["note"]; item: GaiaInboxItemDTO }> {
  return convertInboxItemAdapter(userId, itemId, inboxDependencies());
}

// ── K10 / K11 — Notes quotidiennes et hebdomadaires ───────────────────

const periodicNotesDependencies = () => ({
  loadFolders,
  loadTags,
  noteResponse,
  createNote,
});

export async function getOrCreateDailyNote(
  userId: string,
): Promise<GaiaNoteResponse> {
  return getOrCreateDailyNoteAdapter(userId, periodicNotesDependencies());
}

export async function getOrCreateWeeklyNote(
  userId: string,
): Promise<GaiaNoteResponse> {
  return getOrCreateWeeklyNoteAdapter(userId, periodicNotesDependencies());
}
