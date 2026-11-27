import { db } from "@/lib/db";
import { fileToDTO } from "@/modules/files/mappers";
import type { GaiaFileDTO } from "@/modules/files/types";

type AssociationErrors = {
  noteNotFound: () => Error;
  fileNotFound: () => Error;
};

/** F06/F15 — attach an owned file to an owned, non-deleted note. */
export async function attachFileToNoteCommand(
  userId: string,
  noteId: string,
  fileId: string,
  errors: AssociationErrors,
): Promise<{ ok: true }> {
  const [note, file] = await Promise.all([
    db.note.findFirst({ where: { userId, id: noteId, deletedAt: null }, select: { id: true } }),
    db.gaiaFile.findFirst({ where: { userId, id: fileId }, select: { id: true } }),
  ]);
  if (!note) throw errors.noteNotFound();
  if (!file) throw errors.fileNotFound();

  await db.noteFile.upsert({
    where: { fileId_noteId: { fileId: file.id, noteId: note.id } },
    create: { fileId: file.id, noteId: note.id },
    update: {},
  });
  return { ok: true };
}

/** F06 — detach a file from an owned note; the file itself is retained. */
export async function detachFileFromNoteCommand(
  userId: string,
  noteId: string,
  fileId: string,
  noteNotFound: () => Error,
): Promise<{ ok: true }> {
  const note = await db.note.findFirst({ where: { userId, id: noteId }, select: { id: true } });
  if (!note) throw noteNotFound();
  await db.noteFile.deleteMany({ where: { fileId, noteId: note.id } });
  return { ok: true };
}

/** F06 — list files attached to an owned note, preserving creation order. */
export async function listNoteFilesQuery(
  userId: string,
  noteId: string,
  noteNotFound: () => Error,
): Promise<{ files: GaiaFileDTO[] }> {
  const note = await db.note.findFirst({ where: { userId, id: noteId }, select: { id: true } });
  if (!note) throw noteNotFound();

  const links = await db.noteFile.findMany({
    where: { noteId: note.id, file: { userId } },
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
  const folderIds = [...new Set(links.flatMap(({ file }) => file.folderId ? [file.folderId] : []))];
  const folders = folderIds.length
    ? await db.noteFolder.findMany({ where: { userId, id: { in: folderIds } }, select: { id: true, name: true } })
    : [];
  const folderNames = new Map(folders.map((folder) => [folder.id, folder.name]));

  return {
    files: links.map(({ file }) =>
      fileToDTO(
        file,
        file.folderId ? (folderNames.get(file.folderId) ?? null) : null,
        file.versions.length,
        file.notes.length,
      ),
    ),
  };
}

/** F15 — list notes referencing an owned file, newest update first. */
export async function listFileNotesQuery(
  userId: string,
  fileId: string,
  fileNotFound: () => Error,
): Promise<{ notes: Array<{ id: string; title: string; updatedAt: string }> }> {
  const file = await db.gaiaFile.findFirst({ where: { userId, id: fileId }, select: { id: true } });
  if (!file) throw fileNotFound();

  const links = await db.noteFile.findMany({
    where: { fileId: file.id, note: { userId } },
    include: { note: { select: { id: true, title: true, updatedAt: true } } },
    orderBy: { createdAt: "desc" },
  });
  return {
    notes: links.map(({ note }) => ({
      id: note.id,
      title: note.title,
      updatedAt: note.updatedAt.toISOString(),
    })),
  };
}
