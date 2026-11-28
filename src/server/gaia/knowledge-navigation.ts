import {
  createNoteRelationCommand,
  deleteNoteRelationCommand,
  listNoteRelationsQuery,
} from "@/modules/knowledge/services/relations";
import { getNoteLinksQuery } from "@/modules/knowledge/services/links";
import { getLinkSuggestionsQuery } from "@/modules/knowledge/services/suggestions";
import { getOrphanNotesQuery } from "@/modules/knowledge/services/orphans";
import type {
  GaiaNoteRelationDTO,
  GaiaNoteLinksResponse,
  GaiaLinkSuggestion,
} from "@/modules/knowledge/types";
import type { GaiaNoteRow } from "@/modules/notes/types";
import type { Note, NoteFolder, NoteRelation, NoteTag } from "@prisma/client";

type RelationDeps = {
  validationError: (message: string, issues?: { path: string; message: string }[]) => Error;
  noteNotFound: () => Error;
  conflictError: (code: string, message: string) => Error;
  relationNotFound: () => Error;
};

type NoteLinksDeps = {
  findActiveNote: (userId: string, noteId: string) => Promise<Note | null>;
  loadFolders: (userId: string) => Promise<NoteFolder[]>;
  loadTags: (userId: string) => Promise<NoteTag[]>;
  loadRelations: (userId: string) => Promise<NoteRelation[]>;
  loadNoteTitles: (userId: string, ids: string[]) => Promise<Map<string, string>>;
  toRow: (note: Note, folders: NoteFolder[], tags: NoteTag[]) => GaiaNoteRow;
  noteNotFound: () => Error;
};

type OrphanDeps = {
  loadFolders: (userId: string) => Promise<NoteFolder[]>;
  loadTags: (userId: string) => Promise<NoteTag[]>;
  loadRelations: (userId: string) => Promise<NoteRelation[]>;
  toRow: (note: Note, folders: NoteFolder[], tags: NoteTag[]) => GaiaNoteRow;
};

export async function listNoteRelations(
  userId: string,
  noteId: string,
  deps: Pick<RelationDeps, "noteNotFound">,
): Promise<{ relations: GaiaNoteRelationDTO[] }> {
  return listNoteRelationsQuery(userId, noteId, deps);
}

export async function createNoteRelation(
  userId: string,
  noteId: string,
  input: unknown,
  deps: Pick<RelationDeps, "validationError" | "noteNotFound" | "conflictError">,
): Promise<{ relation: GaiaNoteRelationDTO }> {
  return createNoteRelationCommand(userId, noteId, input, deps);
}

export async function deleteNoteRelation(
  userId: string,
  noteId: string,
  relationId: string,
  deps: Pick<RelationDeps, "relationNotFound">,
): Promise<{ ok: true }> {
  return deleteNoteRelationCommand(userId, noteId, relationId, deps);
}

export async function getNoteLinks(
  userId: string,
  noteId: string,
  deps: NoteLinksDeps,
): Promise<GaiaNoteLinksResponse> {
  return getNoteLinksQuery(userId, noteId, deps);
}

export async function getLinkSuggestions(
  userId: string,
  noteId: string,
  deps: {
    findActiveNote: (userId: string, noteId: string) => Promise<Note | null>;
    getNoteLinks: (userId: string, noteId: string) => Promise<{
      outgoing: Array<{ id: string }>;
      backlinks: Array<{ id: string }>;
    }>;
    noteNotFound: () => Error;
  },
): Promise<{ suggestions: GaiaLinkSuggestion[] }> {
  return getLinkSuggestionsQuery(userId, noteId, deps);
}

export async function getOrphanNotes(
  userId: string,
  deps: OrphanDeps,
): Promise<{ notes: GaiaNoteRow[]; total: number }> {
  return getOrphanNotesQuery(userId, deps);
}
