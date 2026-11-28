import { db } from "@/shared/database/client";

/** Load active notes with only the fields needed to score link suggestions. */
export function loadLinkSuggestionCandidates(userId: string) {
  return db.note.findMany({
    where: { userId, deletedAt: null },
    select: {
      id: true,
      title: true,
      blocks: true,
      tagIds: true,
    },
  });
}
