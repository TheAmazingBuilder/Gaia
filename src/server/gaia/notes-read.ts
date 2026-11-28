import "server-only";

import { getNoteQuery } from "@/modules/notes/services/details";
import { listNotesQuery } from "@/modules/notes/services/list";
import { searchNotesQuery } from "@/modules/notes/services/search";
import type { GaiaListQuery, GaiaNoteResponse, GaiaNoteRow } from "@/modules/notes/types";
import { gaiaCollectionCriteriaSchema } from "@/modules/knowledge/schemas";
import { findActiveNote, loadFolders, loadTags, loadSearchNotesQuery } from "@/modules/notes/repositories/notes";
import { parseJsonProperties, tagNamesOf, toRow, noteResponse } from "@/modules/notes/mappers";
import {
  excerptOf,
  parseJsonBlocks,
  parseJsonStringArray,
  searchSnippet,
  textOfBlocks,
} from "@/lib/gaia/content";
import { notFound, validationError } from "@/shared/errors/gaia-error";

const NOTE_NOT_FOUND = () => notFound("NOTE_NOT_FOUND", "Note not found.");
const COLLECTION_NOT_FOUND = () => notFound("COLLECTION_NOT_FOUND", "Collection not found.");

type ListNotesDependencies = Parameters<typeof listNotesQuery>[2];
type GetNoteDependencies = Parameters<typeof getNoteQuery>[2];
type SearchNotesDependencies = Parameters<typeof searchNotesQuery>[2];

const listDependencies: ListNotesDependencies = {
  validationError,
  collectionNotFound: COLLECTION_NOT_FOUND,
  collectionCriteriaSchema: gaiaCollectionCriteriaSchema,
  parseJsonProperties,
  toRow,
};

const getDependencies: GetNoteDependencies = {
  noteNotFound: NOTE_NOT_FOUND,
  findActiveNote,
  noteResponse: async (ownerId, note) => {
    const [folders, tags] = await Promise.all([loadFolders(ownerId), loadTags(ownerId)]);
    return noteResponse(ownerId, note, folders, tags);
  },
};

const searchDependencies: SearchNotesDependencies = {
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
};

export async function listNotes(
  userId: string,
  query: GaiaListQuery,
): Promise<{ notes: GaiaNoteRow[]; total: number }> {
  return listNotesQuery(userId, query, listDependencies);
}

export async function getNote(
  userId: string,
  noteId: string,
): Promise<GaiaNoteResponse> {
  return getNoteQuery(userId, noteId, getDependencies);
}

export async function searchNotes(
  userId: string,
  query: string,
): ReturnType<typeof searchNotesQuery> {
  return searchNotesQuery(userId, query, searchDependencies);
}
