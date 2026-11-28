import type { Note, Prisma } from "@prisma/client";
import { db } from "@/shared/database/client";
import type { NoteListRow, NoteRowInput } from "@/modules/notes/types/list";

/**
 * Prisma projection used by the Notes list and Knowledge overview queries.
 * Keep persistence-specific selection details inside the repository layer.
 */
export const NOTE_LIST_SELECT = {
  id: true,
  title: true,
  icon: true,
  folderId: true,
  tagIds: true,
  favorite: true,
  templateId: true,
  cover: true,
  wordGoal: true,
  properties: true,
  createdAt: true,
  updatedAt: true,
  lastViewedAt: true,
  deletedAt: true,
  mastery: true,
  lastReviewedAt: true,
  nextReviewAt: true,
  reviewCount: true,
  easeFactor: true,
  intervalDays: true,
} as const satisfies Prisma.NoteSelect;

/** Load the requesting user's folders in the same order used by the legacy facade. */
export function loadFolders(userId: string) {
  return db.noteFolder.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });
}

/** Load only tags owned by the requesting user. */
export function loadTags(userId: string) {
  return db.noteTag.findMany({ where: { userId } });
}

/** Resolve an active note only within its owner's scope. */
export function findActiveNote(userId: string, noteId: string): Promise<Note | null> {
  return db.note.findFirst({ where: { userId, id: noteId, deletedAt: null } });
}

/** Find a smart collection owned by the requesting user. */
export function findUserSmartCollection(userId: string, collectionId: string) {
  return db.smartCollection.findFirst({ where: { userId, id: collectionId } });
}

/** Load active notes belonging to the requesting user for collection matching. */
export function loadActiveNotesForCollection(userId: string): Promise<Note[]> {
  return db.note.findMany({ where: { userId, deletedAt: null } });
}

/** Load the requesting user's notes for reference-block matching. */
export function loadUserNotesForReference(userId: string): Promise<Note[]> {
  return db.note.findMany({ where: { userId } });
}

/** Load note metadata for the Knowledge overview without exposing Prisma types. */
export function loadOverviewNotesQuery(userId: string): Promise<NoteListRow[]> {
  return db.note.findMany({ where: { userId }, select: NOTE_LIST_SELECT });
}

/** Load active notes and their content for full-text note search. */
export function loadSearchNotesQuery(userId: string): Promise<NoteRowInput[]> {
  return db.note.findMany({
    where: { userId, deletedAt: null },
    select: { ...NOTE_LIST_SELECT, blocks: true },
  });
}

/** Load note content for a set of already owner-scoped note IDs. */
export async function loadBlocksFor(noteIds: string[]): Promise<Map<string, string>> {
  if (noteIds.length === 0) return new Map();
  const rows = await db.note.findMany({
    where: { id: { in: noteIds } },
    select: { id: true, blocks: true },
  });
  return new Map(rows.map((row) => [row.id, row.blocks]));
}
