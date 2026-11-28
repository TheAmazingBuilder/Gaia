import type { GaiaNoteResponse } from "@/modules/notes/types";
import type { Note } from "@prisma/client";
import { updateNoteLastViewed } from "@/modules/notes/repositories/notes";

type GetNoteDependencies = {
  noteNotFound: () => Error;
  findActiveNote: (userId: string, noteId: string) => Promise<Note | null>;
  noteResponse: (userId: string, note: Note) => Promise<GaiaNoteResponse>;
};

/**
 * Fetch an active note, update its last-viewed timestamp, and return its
 * fully resolved response. Ownership and response mapping stay behind
 * explicit module dependencies to preserve the legacy service contract.
 */
export async function getNoteQuery(
  userId: string,
  noteId: string,
  deps: GetNoteDependencies,
): Promise<GaiaNoteResponse> {
  const note = await deps.findActiveNote(userId, noteId);
  if (!note) throw deps.noteNotFound();

  const updated = await updateNoteLastViewed(note.id);

  return deps.noteResponse(userId, updated);
}
