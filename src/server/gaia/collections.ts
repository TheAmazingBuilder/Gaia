import "server-only";

import {
  createCollectionCommand,
  deleteCollectionCommand,
  listCollectionNotesQuery,
  listCollectionsQuery,
  updateCollectionCommand,
} from "@/modules/knowledge/services/collections";
import { loadFolders } from "@/modules/notes/repositories/notes";
import { parseJsonProperties } from "@/modules/notes/mappers";
import { validationError, notFound } from "@/shared/errors/gaia-error";
import { listNotes } from "@/server/gaia/notes-read";

type CollectionDependencies = Parameters<typeof listCollectionsQuery>[1];

const collectionDependencies: CollectionDependencies = {
  validationError,
  collectionNotFound: () => notFound("COLLECTION_NOT_FOUND", "Collection not found."),
  folderNotFound: () => notFound("FOLDER_NOT_FOUND", "Folder not found."),
  loadFolders,
  parseJsonProperties,
  listNotes,
};

export function listCollections(userId: string) {
  return listCollectionsQuery(userId, collectionDependencies);
}

export function createCollection(userId: string, input: unknown) {
  return createCollectionCommand(userId, input, collectionDependencies);
}

export function updateCollection(
  userId: string,
  collectionId: string,
  input: unknown,
) {
  return updateCollectionCommand(userId, collectionId, input, collectionDependencies);
}

export function deleteCollection(userId: string, collectionId: string) {
  return deleteCollectionCommand(userId, collectionId, collectionDependencies);
}

export function listCollectionNotes(
  userId: string,
  collectionId: string,
  page: number,
) {
  return listCollectionNotesQuery(userId, collectionId, page, collectionDependencies);
}
