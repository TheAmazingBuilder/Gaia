import { db } from "@/shared/database/client";

/** Load active notes used to calculate outgoing links, backlinks and mentions. */
export function loadNoteLinkCandidates(userId: string) {
  return db.note.findMany({
    where: { userId, deletedAt: null },
  });
}
