import { db } from "@/lib/db";
import {
  shouldSnapshot,
  sortVersionsNewestFirst,
  versionsBeyondCap,
} from "@/lib/gaia/versioning";
import type { Note } from "@prisma/client";

/**
 * Create a pre-edit snapshot when the existing throttle allows it.
 * Keeps the legacy 3-minute throttle and 12-version retention policy.
 */
export async function createNoteSnapshotIfNeeded(
  userId: string,
  note: Note,
): Promise<void> {
  const versions = await db.noteVersion.findMany({
    where: { userId, noteId: note.id },
  });
  const newest = sortVersionsNewestFirst(versions)[0] ?? null;
  if (!shouldSnapshot(newest ? newest.savedAt : null, new Date())) return;

  await db.noteVersion.create({
    data: {
      userId,
      noteId: note.id,
      title: note.title,
      blocks: note.blocks,
      savedAt: note.updatedAt,
    },
  });

  const after = await db.noteVersion.findMany({
    where: { userId, noteId: note.id },
  });
  const extra = versionsBeyondCap(sortVersionsNewestFirst(after));
  if (extra.length > 0) {
    await db.noteVersion.deleteMany({
      where: { userId, id: { in: extra } },
    });
  }
}
