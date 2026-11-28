import { db } from "@/shared/database/client";
import type { GaiaNoteResponse } from "@/modules/notes/types";
import type { Note } from "@prisma/client";

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

  const updated = await db.note.update({
    where: { id: note.id },
    data: { lastViewedAt: new Date() },
  });

  return deps.noteResponse(userId, updated);
}
