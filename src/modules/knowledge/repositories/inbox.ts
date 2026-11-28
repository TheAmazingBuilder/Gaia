import { db } from "@/shared/database/client";

/** List the user's inbox items newest first, preserving the existing cap. */
export function listUserInboxItems(userId: string) {
  return db.inboxItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export function createUserInboxItem(userId: string, text: string) {
  return db.inboxItem.create({ data: { userId, text } });
}

export function findUserInboxItem(userId: string, itemId: string) {
  return db.inboxItem.findFirst({ where: { userId, id: itemId } });
}

export function setUserInboxItemDoneAt(itemId: string, doneAt: Date | null) {
  return db.inboxItem.update({
    where: { id: itemId },
    data: { doneAt },
  });
}

export function markUserInboxItemConverted(
  itemId: string,
  noteId: string,
  doneAt: Date,
) {
  return db.inboxItem.update({
    where: { id: itemId },
    data: { noteId, doneAt },
  });
}

export function deleteUserInboxItem(itemId: string) {
  return db.inboxItem.delete({ where: { id: itemId } });
}
