import {
  getNoteQuery,
  type GetNoteDependencies,
} from "@/modules/notes/services/details";
import {
  listNotesQuery,
  type ListNotesDependencies,
} from "@/modules/notes/services/list";
import type { GaiaListQuery, GaiaNoteResponse, GaiaNoteRow } from "@/modules/notes/types";

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
