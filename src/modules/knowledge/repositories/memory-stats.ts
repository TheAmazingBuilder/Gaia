import { db } from "@/shared/database/client";

/**
 * Persistence query for the Knowledge memory statistics.
 * Keep the projection narrow: the calculation layer does not need full notes.
 */
export function loadMemoryStatsNotes(userId: string) {
  return db.note.findMany({
    where: { userId, deletedAt: null },
    select: {
      id: true,
      title: true,
      mastery: true,
      lastReviewedAt: true,
      nextReviewAt: true,
      createdAt: true,
    },
  });
}
