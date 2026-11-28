import {
  findActiveNote,
  findOwnedFolder,
  findOwnedNote,
  loadFolders,
} from "@/modules/notes/repositories/notes";

/**
 * Stable, Prisma-free collaboration surface for the Files module.
 * Notes remains the owner of note and folder records.
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
