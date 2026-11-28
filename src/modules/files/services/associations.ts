import {
  deleteNoteFileAssociation,
  findOwnedFile,
  findOwnedNote,
  loadFilesForNote,
  loadNotesForFile,
  upsertNoteFileAssociation,
} from "@/modules/files/repositories/associations";
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
    findOwnedNote(userId, noteId, true),
    findOwnedFile(userId, fileId),
  ]);
  if (!note) throw errors.noteNotFound();
  if (!file) throw errors.fileNotFound();

  await upsertNoteFileAssociation(file.id, note.id);
  return { ok: true };
}

/** F06 — detach a file from an owned note; the file itself is retained. */
export async function detachFileFromNoteCommand(
  userId: string,
  noteId: string,
  fileId: string,
  noteNotFound: () => Error,
): Promise<{ ok: true }> {
  const note = await findOwnedNote(userId, noteId);
  if (!note) throw noteNotFound();
  await deleteNoteFileAssociation(fileId, note.id);
  return { ok: true };
}

/** F06 — list files attached to an owned note, preserving creation order. */
export async function listNoteFilesQuery(
  userId: string,
  noteId: string,
  noteNotFound: () => Error,
): Promise<{ files: GaiaFileDTO[] }> {
  const note = await findOwnedNote(userId, noteId);
  if (!note) throw noteNotFound();

  const { links, folderNames } = await loadFilesForNote(userId, note.id);
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
  const file = await findOwnedFile(userId, fileId);
  if (!file) throw fileNotFound();

  const links = await loadNotesForFile(userId, file.id);
  return {
    notes: links.map(({ note }) => ({
      id: note.id,
      title: note.title,
      updatedAt: note.updatedAt.toISOString(),
    })),
  };
}
