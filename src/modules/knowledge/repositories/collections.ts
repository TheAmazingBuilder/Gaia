import { db } from "@/shared/database/client";

/** Load active notes used to evaluate smart-collection criteria. */
export function loadSmartCollectionNotes(userId: string) {
  return db.note.findMany({ where: { userId, deletedAt: null } });
}

/** List collections in their established creation order. */
export function listUserSmartCollections(userId: string) {
  return db.smartCollection.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

export function findUserSmartCollection(userId: string, collectionId: string) {
  return db.smartCollection.findFirst({
    where: { userId, id: collectionId },
  });
}

export function findUserCollectionFolder(userId: string, folderId: string) {
  return db.noteFolder.findFirst({
    where: { userId, id: folderId },
  });
}

export function createUserSmartCollection(
  userId: string,
  name: string,
  icon: string,
  criteria: string,
) {
  return db.smartCollection.create({
    data: { userId, name, icon, criteria },
  });
}

export function updateUserSmartCollection(
  collectionId: string,
  name: string,
  icon: string,
  criteria: string,
) {
  return db.smartCollection.update({
    where: { id: collectionId },
    data: { name, icon, criteria },
  });
}

export function deleteUserSmartCollection(collectionId: string) {
  return db.smartCollection.delete({ where: { id: collectionId } });
}
