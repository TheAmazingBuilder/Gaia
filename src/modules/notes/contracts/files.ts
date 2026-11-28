import {
  findActiveNote,
  findOwnedFolder,
  findOwnedNote,
  loadFolders,
} from "@/modules/notes/repositories/notes";
import {
  countFileLinks,
  countFileLinksByFileIds,
  deleteNoteFileLink,
  listFileIdsForNote,
  listNotesForFile,
  upsertNoteFileLink,
} from "@/modules/notes/repositories/files";

/**
 * Stable, Prisma-free collaboration surface for the Files module.
 * Notes owns note/folder records and the note-file attachment relationship.
 */
export async function findNoteForFileAssociation(
  userId: string,
  noteId: string,
  activeOnly = false,
): Promise<{ id: string } | null> {
  const note = activeOnly
    ? await findActiveNote(userId, noteId)
    : await findOwnedNote(userId, noteId);
  return note ? { id: note.id } : null;
}

export async function findFolderForFile(
  userId: string,
  folderId: string,
): Promise<{ id: string; name: string } | null> {
  const folder = await findOwnedFolder(userId, folderId);
  return folder ? { id: folder.id, name: folder.name } : null;
}

export async function listFoldersForFiles(
  userId: string,
): Promise<Array<{ id: string; name: string }>> {
  const folders = await loadFolders(userId);
  return folders.map(({ id, name }) => ({ id, name }));
}

export async function attachFileToNote(fileId: string, noteId: string): Promise<void> {
  await upsertNoteFileLink(fileId, noteId);
}

export async function detachFileFromNote(fileId: string, noteId: string): Promise<void> {
  await deleteNoteFileLink(fileId, noteId);
}

export async function listFileIdsAttachedToNote(
  userId: string,
  noteId: string,
): Promise<string[]> {
  const rows = await listFileIdsForNote(userId, noteId);
  return rows.map(({ fileId }) => fileId);
}

export async function listNotesAttachedToFile(
  userId: string,
  fileId: string,
): Promise<Array<{ id: string; title: string; updatedAt: Date }>> {
  const rows = await listNotesForFile(userId, fileId);
  return rows.map(({ note }) => note);
}

export function countNotesAttachedToFile(fileId: string): Promise<number> {
  return countFileLinks(fileId);
}

export function countNotesAttachedToFiles(fileIds: string[]): Promise<Map<string, number>> {
  return countFileLinksByFileIds(fileIds);
}
