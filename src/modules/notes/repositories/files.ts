import { db } from "@/shared/database/client";

/** Persistence for note-owned file attachment relationships. */
export async function upsertNoteFileLink(fileId: string, noteId: string) {
  return db.noteFile.upsert({
    where: { fileId_noteId: { fileId, noteId } },
    create: { fileId, noteId },
    update: {},
  });
}

export async function deleteNoteFileLink(fileId: string, noteId: string) {
  return db.noteFile.deleteMany({ where: { fileId, noteId } });
}

export async function listFileIdsForNote(userId: string, noteId: string) {
  return db.noteFile.findMany({
    where: { noteId, file: { userId } },
    select: { fileId: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function listNotesForFile(userId: string, fileId: string) {
  return db.noteFile.findMany({
    where: { fileId, note: { userId } },
    select: {
      note: { select: { id: true, title: true, updatedAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function countFileLinks(fileId: string): Promise<number> {
  return db.noteFile.count({ where: { fileId } });
}

export async function countFileLinksByFileIds(fileIds: string[]): Promise<Map<string, number>> {
  if (fileIds.length === 0) return new Map();
  const rows = await db.noteFile.groupBy({
    by: ["fileId"],
    where: { fileId: { in: fileIds } },
    _count: { _all: true },
  });
  return new Map(rows.map((row) => [row.fileId, row._count._all]));
}
