import { db } from "@/shared/database/client";
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

/** Find an active note owned by the user. */
export function findActiveKnowledgeNote(userId: string, noteId: string) {
  return db.note.findFirst({ where: { userId, id: noteId, deletedAt: null } });
}

/** Check whether an identical directed relation already exists. */
export function findUserNoteRelation(
  userId: string,
  fromNoteId: string,
  toNoteId: string,
  type: string,
) {
  return db.noteRelation.findFirst({
    where: { userId, fromNoteId, toNoteId, type },
  });
}

/** Persist a directed note relation. */
export function createUserNoteRelation(
  userId: string,
  fromNoteId: string,
  toNoteId: string,
  type: string,
) {
  return db.noteRelation.create({
    data: { userId, fromNoteId, toNoteId, type },
  });
}

/** Find a relation only within the owning user's scope. */
export function findUserNoteRelationById(userId: string, relationId: string) {
  return db.noteRelation.findFirst({ where: { userId, id: relationId } });
}

/** Delete a relation by its primary key after ownership and endpoint checks. */
export function deleteUserNoteRelation(relationId: string) {
  return db.noteRelation.delete({ where: { id: relationId } });
}
