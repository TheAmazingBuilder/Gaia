import { db } from "@/shared/database/client";

/** Persistence operations for file/note associations. */
export async function findOwnedFile(userId: string, fileId: string) {
  return db.gaiaFile.findFirst({ where: { userId, id: fileId }, select: { id: true } });
}

export async function upsertNoteFileAssociation(fileId: string, noteId: string) {
  return db.noteFile.upsert({
    where: { fileId_noteId: { fileId, noteId } },
    create: { fileId, noteId },
    update: {},
  });
}

export async function deleteNoteFileAssociation(fileId: string, noteId: string) {
  return db.noteFile.deleteMany({ where: { fileId, noteId } });
}

export async function loadFilesForNote(userId: string, noteId: string) {
  return db.noteFile.findMany({
    where: { noteId, file: { userId } },
    include: {
      file: {
        include: {
          versions: { select: { id: true } },
          notes: { select: { fileId: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function loadNotesForFile(userId: string, fileId: string) {
  return db.noteFile.findMany({
    where: { fileId, note: { userId } },
    include: { note: { select: { id: true, title: true, updatedAt: true } } },
    orderBy: { createdAt: "desc" },
  });
}
