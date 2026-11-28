import {
  countActiveNotesInFolder,
  createNoteFolder,
  deleteNoteFolder,
  findOwnedFolder,
  loadActiveNoteFolderAssignments,
  loadFolders as loadNoteFolders,
  reparentChildFolders,
  unassignNotesFromFolder,
  updateNoteFolder,
} from "@/modules/notes/repositories/notes";
import type { NoteFolder } from "@prisma/client";

export type GaiaFolderInput = {
  name: string;
  parentId?: string | null;
};

export type GaiaFolderDTO = NoteFolder & { noteCount: number };

type FolderDependencies = {
  folderNotFound: () => Error;
  validationError: (message: string, issues?: { path: string; message: string }[]) => Error;
  conflictError: (code: string, message: string) => Error;
};

type FolderTreeDependencies = FolderDependencies & {
  isDescendantOf: (folders: NoteFolder[], candidateId: string, ancestorId: string) => boolean;
};

function nameKeyOf(name: string): string {
  return name.trim().toLowerCase();
}

async function loadFolders(userId: string): Promise<NoteFolder[]> {
  return loadNoteFolders(userId);
}

export async function listFoldersQuery(userId: string): Promise<{ folders: GaiaFolderDTO[] }> {
  const [folders, notes] = await Promise.all([
    loadFolders(userId),
    loadActiveNoteFolderAssignments(userId),
  ]);
  return {
    folders: folders.map((folder) => ({
      ...folder,
      noteCount: notes.filter((note) => note.folderId === folder.id).length,
    })),
  };
}

export async function createFolderCommand(
  userId: string,
  parsed: GaiaFolderInput,
  deps: FolderDependencies,
): Promise<GaiaFolderDTO> {
  const name = parsed.name.trim();
  if (name === "") {
    throw deps.validationError("The folder name is required.", [
      { path: "name", message: "The folder name is required." },
    ]);
  }
  const folders = await loadFolders(userId);
  if (folders.some((folder) => nameKeyOf(folder.name) === nameKeyOf(name))) {
    throw deps.conflictError("FOLDER_EXISTS", "A folder with this name already exists.");
  }
  let parentId: string | null = null;
  if (parsed.parentId !== undefined && parsed.parentId !== null) {
    const parent = folders.find((folder) => folder.id === parsed.parentId);
    if (!parent) throw deps.folderNotFound();
    parentId = parent.id;
  }
  const folder = await createNoteFolder({ userId, name, parentId });
  return { ...folder, noteCount: 0 };
}

export async function updateFolderCommand(
  userId: string,
  folderId: string,
  parsed: GaiaFolderInput,
  deps: FolderTreeDependencies,
): Promise<GaiaFolderDTO> {
  const name = parsed.name.trim();
  if (name === "") {
    throw deps.validationError("The folder name is required.", [
      { path: "name", message: "The folder name is required." },
    ]);
  }
  const folder = await findOwnedFolder(userId, folderId);
  if (!folder) throw deps.folderNotFound();
  const folders = await loadFolders(userId);
  if (folders.some((item) => item.id !== folder.id && nameKeyOf(item.name) === nameKeyOf(name))) {
    throw deps.conflictError("FOLDER_EXISTS", "A folder with this name already exists.");
  }
  let parentId: string | null | undefined;
  if (parsed.parentId !== undefined) {
    if (parsed.parentId === null) {
      parentId = null;
    } else {
      const parent = folders.find((item) => item.id === parsed.parentId);
      if (!parent) throw deps.folderNotFound();
      if (parent.id === folder.id || deps.isDescendantOf(folders, parent.id, folder.id)) {
        throw deps.validationError("A folder cannot be moved under itself or one of its children.");
      }
      parentId = parent.id;
    }
  }
  const updated = await updateNoteFolder(folder.id, {
    name,
    ...(parentId !== undefined ? { parentId } : {}),
  });
  const noteCount = await countActiveNotesInFolder(userId, folder.id);
  return { ...updated, noteCount };
}

export async function deleteFolderCommand(
  userId: string,
  folderId: string,
  folderNotFound: () => Error,
): Promise<{ ok: true }> {
  const folder = await findOwnedFolder(userId, folderId);
  if (!folder) throw folderNotFound();
  // Preserve the existing behavior: child folders are reparented and notes become unfiled.
  await reparentChildFolders(userId, folder.id, folder.parentId ?? null);
  await unassignNotesFromFolder(userId, folder.id);
  await deleteNoteFolder(folder.id);
  return { ok: true };
}
