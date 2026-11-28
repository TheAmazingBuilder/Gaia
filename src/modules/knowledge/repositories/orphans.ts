import { db } from "@/shared/database/client";

/** Load active notes for orphan detection and the existing note-row mapper. */
export function loadOrphanDetectionNotes(userId: string) {
  return db.note.findMany({ where: { userId, deletedAt: null } });
}
