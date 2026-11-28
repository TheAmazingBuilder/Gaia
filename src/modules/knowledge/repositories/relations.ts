import { db } from "@/lib/db";
import type { NoteRelation } from "@prisma/client";

/**
 * Shared Knowledge repository queries for user-scoped note relations.
 * Keep ordering stable because consumers expose relations in creation order.
 */
export async function listUserRelations(userId: string): Promise<NoteRelation[]> {
  return db.noteRelation.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

/** Resolve active note titles for a set of ids, scoped to the owning user. */
export async function loadActiveNoteTitles(
  userId: string,
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();

  const rows = await db.note.findMany({
    where: { userId, id: { in: ids }, deletedAt: null },
    select: { id: true, title: true },
  });

  return new Map(
    rows.map((row) => [row.id, row.title === "" ? "Untitled note" : row.title]),
  );
}
