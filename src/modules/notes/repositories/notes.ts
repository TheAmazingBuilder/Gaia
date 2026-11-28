import type { Note } from "@prisma/client";
import { db } from "@/shared/database/client";

/** Load the requesting user's folders in the same order used by the legacy facade. */
export function loadFolders(userId: string) {
  return db.noteFolder.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });
}

/** Load only tags owned by the requesting user. */
export function loadTags(userId: string) {
  return db.noteTag.findMany({ where: { userId } });
}

/** Resolve an active note only within its owner's scope. */
export function findActiveNote(userId: string, noteId: string): Promise<Note | null> {
  return db.note.findFirst({ where: { userId, id: noteId, deletedAt: null } });
}
