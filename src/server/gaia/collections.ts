import {
  createCollectionCommand,
  deleteCollectionCommand,
  listCollectionNotesQuery,
  listCollectionsQuery,
  updateCollectionCommand,
} from "@/modules/knowledge/services/collections";

type CollectionDependencies = Parameters<typeof listCollectionsQuery>[1];

export function listCollections(
  userId: string,
  deps: CollectionDependencies,
) {
  return listCollectionsQuery(userId, deps);
}

export function createCollection(
  userId: string,
  input: unknown,
  deps: CollectionDependencies,
) {
  return createCollectionCommand(userId, input, deps);
}

export function updateCollection(
  userId: string,
  collectionId: string,
  input: unknown,
  deps: CollectionDependencies,
) {
  return updateCollectionCommand(userId, collectionId, input, deps);
}

export function deleteCollection(
  userId: string,
  collectionId: string,
  deps: CollectionDependencies,
) {
  return deleteCollectionCommand(userId, collectionId, deps);
}

export function listCollectionNotes(
  userId: string,
  collectionId: string,
  page: number,
  deps: CollectionDependencies,
) {
  return listCollectionNotesQuery(userId, collectionId, page, deps);
}
