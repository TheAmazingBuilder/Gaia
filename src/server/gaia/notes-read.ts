import { getNoteQuery } from "@/modules/notes/services/details";
import { listNotesQuery } from "@/modules/notes/services/list";
import type { GaiaListQuery, GaiaNoteResponse, GaiaNoteRow } from "@/modules/notes/types";

type ListNotesDependencies = Parameters<typeof listNotesQuery>[2];
type GetNoteDependencies = Parameters<typeof getNoteQuery>[2];

export async function listNotes(
  userId: string,
  query: GaiaListQuery,
  dependencies: ListNotesDependencies,
): Promise<{ notes: GaiaNoteRow[]; total: number }> {
  return listNotesQuery(userId, query, dependencies);
}

export async function getNote(
  userId: string,
  noteId: string,
  dependencies: GetNoteDependencies,
): Promise<GaiaNoteResponse> {
  return getNoteQuery(userId, noteId, dependencies);
}

import { searchNotesQuery } from "@/modules/notes/services/search";

type SearchNotesDependencies = Parameters<typeof searchNotesQuery>[2];

export async function searchNotes(
  userId: string,
  query: string,
  dependencies: SearchNotesDependencies,
): ReturnType<typeof searchNotesQuery> {
  return searchNotesQuery(userId, query, dependencies);
}
