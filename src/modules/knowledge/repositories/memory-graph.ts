import { db } from "@/shared/database/client";

/** Load the active notes and the exact projection required by the memory graph. */
export function loadMemoryGraphNotes(userId: string) {
  return db.note.findMany({
    where: { userId, deletedAt: null },
    select: {
      id: true,
      title: true,
      mastery: true,
      folderId: true,
      tagIds: true,
      blocks: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

/** Load user-scoped relations used to construct graph edges. */
export function loadMemoryGraphRelations(userId: string) {
  return db.noteRelation.findMany({ where: { userId } });
}
