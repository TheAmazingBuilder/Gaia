import "server-only";

import {
  createNoteRelationCommand,
  deleteNoteRelationCommand,
  listNoteRelationsQuery,
} from "@/modules/knowledge/services/relations";
import { getNoteLinksQuery } from "@/modules/knowledge/services/links";
import { getLinkSuggestionsQuery } from "@/modules/knowledge/services/suggestions";
import { getOrphanNotesQuery } from "@/modules/knowledge/services/orphans";
import {
  findActiveNote,
  loadFolders,
  loadTags,
} from "@/modules/notes/repositories/notes";
import { toRow } from "@/modules/notes/mappers";
import {
  listUserRelations as loadRelations,
  loadActiveNoteTitles as loadNoteTitles,
} from "@/modules/knowledge/repositories/relations";
import {
  conflictError,
  notFound,
  validationError,
} from "@/shared/errors/gaia-error";
import type {
  GaiaNoteRelationDTO,
  GaiaNoteLinksResponse,
  GaiaLinkSuggestion,
} from "@/modules/knowledge/types";
import type { GaiaNoteRow } from "@/modules/notes/types";
import type {
  NoteFolderMappingRecord,
  NoteRowInput,
  NoteTagMappingRecord,
} from "@/modules/notes/types/list";

const noteNotFound = () => notFound("NOTE_NOT_FOUND", "Note not found.");

export async function listNoteRelations(
  userId: string,
  noteId: string,
): Promise<{ relations: GaiaNoteRelationDTO[] }> {
  return listNoteRelationsQuery(userId, noteId, { noteNotFound });
}

export async function createNoteRelation(
  userId: string,
  noteId: string,
  input: unknown,
): Promise<{ relation: GaiaNoteRelationDTO }> {
  return createNoteRelationCommand(userId, noteId, input, {
    validationError,
    noteNotFound,
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

type NoteRelationRecord = {
  id: string;
  fromNoteId: string;
  toNoteId: string;
  type: string;
  createdAt: Date;
};

type NoteLinksDeps = {
  findActiveNote: (userId: string, noteId: string) => Promise<NoteRowInput | null>;
  loadFolders: (userId: string) => Promise<NoteFolderMappingRecord[]>;
  loadTags: (userId: string) => Promise<NoteTagMappingRecord[]>;
  loadRelations: (userId: string) => Promise<NoteRelationRecord[]>;
  loadNoteTitles: (userId: string, ids: string[]) => Promise<Map<string, string>>;
  toRow: (
    note: NoteRowInput,
    folders: NoteFolderMappingRecord[],
    tags: NoteTagMappingRecord[],
  ) => GaiaNoteRow;
  noteNotFound: () => Error;
};

const noteLinksDependencies: NoteLinksDeps = {
  findActiveNote,
  loadFolders,
  loadTags,
  loadRelations,
  loadNoteTitles,
  toRow,
  noteNotFound,
};

export async function getNoteLinks(
  userId: string,
  noteId: string,
): Promise<GaiaNoteLinksResponse> {
  return getNoteLinksQuery(userId, noteId, noteLinksDependencies);
}

export async function getLinkSuggestions(
  userId: string,
  noteId: string,
): Promise<{ suggestions: GaiaLinkSuggestion[] }> {
  return getLinkSuggestionsQuery(userId, noteId, {
    findActiveNote,
    getNoteLinks,
    noteNotFound,
  });
}

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
