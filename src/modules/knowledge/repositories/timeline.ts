import { db } from "@/shared/database/client";

/** Persistence reads for the Knowledge timeline; keep projections minimal. */
export async function loadKnowledgeTimelineData(userId: string) {
  return Promise.all([
    db.note.findMany({
      where: { userId, deletedAt: null },
      select: { id: true, title: true, mastery: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
    }),
    db.noteRelation.findMany({ where: { userId }, select: { createdAt: true } }),
  ]);
}
