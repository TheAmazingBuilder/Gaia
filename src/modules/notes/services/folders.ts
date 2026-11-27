import { db } from "@/lib/db";
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
  return db.noteFolder.findMany({ where: { userId }, orderBy: { name: "asc" } });
}

export async function listFoldersQuery(userId: string): Promise<{ folders: GaiaFolderDTO[] }> {
  const [folders, notes] = await Promise.all([
    loadFolders(userId),
    db.note.findMany({ where: { userId, deletedAt: null } }),
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
  const folder = await db.noteFolder.create({ data: { userId, name, parentId } });
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
  const folder = await db.noteFolder.findFirst({ where: { userId, id: folderId } });
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
  const updated = await db.noteFolder.update({
    where: { id: folder.id },
    data: { name, ...(parentId !== undefined ? { parentId } : {}) },
  });
  const noteCount = await db.note.count({
    where: { userId, folderId: folder.id, deletedAt: null },
  });
  return { ...updated, noteCount };
}

export async function deleteFolderCommand(
  userId: string,
  folderId: string,
  folderNotFound: () => Error,
): Promise<{ ok: true }> {
  const folder = await db.noteFolder.findFirst({ where: { userId, id: folderId } });
  if (!folder) throw folderNotFound();
  // Preserve the existing behavior: child folders are reparented and notes become unfiled.
  await db.noteFolder.updateMany({
    where: { userId, parentId: folder.id },
    data: { parentId: folder.parentId ?? null },
  });
  await db.note.updateMany({
    where: { userId, folderId: folder.id },
    data: { folderId: null },
  });
  await db.noteFolder.delete({ where: { id: folder.id } });
  return { ok: true };
}
