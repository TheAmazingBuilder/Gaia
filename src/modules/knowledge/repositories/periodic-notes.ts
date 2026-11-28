import { db } from "@/shared/database/client";

/** Resolve the timezone used when naming a user's periodic notes. */
export function findUserTimezone(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
}

export function findUserPeriodicNoteFolder(userId: string, name: string) {
  return db.noteFolder.findFirst({ where: { userId, name } });
}

export function createUserPeriodicNoteFolder(userId: string, name: string) {
  return db.noteFolder.create({
    data: { userId, name, parentId: null },
  });
}

export function findUserPeriodicNote(
  userId: string,
  folderId: string,
  title: string,
) {
  return db.note.findFirst({
    where: { userId, folderId, title, deletedAt: null },
  });
}

export function touchUserPeriodicNote(noteId: string, lastViewedAt: Date) {
  return db.note.update({
    where: { id: noteId },
    data: { lastViewedAt },
  });
}
