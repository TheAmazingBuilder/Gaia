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

/** Load versions belonging to the note owner for snapshot throttling and retention. */
export function loadNoteVersionsForSnapshot(userId: string, noteId: string) {
  return db.noteVersion.findMany({ where: { userId, noteId } });
}

/** Persist a pre-edit note snapshot with the original timestamp semantics. */
export function createNoteVersionSnapshot(data: {
  userId: string;
  noteId: string;
  title: string;
  blocks: string;
  savedAt: Date;
}) {
  return db.noteVersion.create({ data });
}

/** Remove only the excess versions selected by the snapshot retention policy. */
export function deleteNoteVersions(
  userId: string,
  versionIds: string[],
) {
  if (versionIds.length === 0) return Promise.resolve({ count: 0 });
  return db.noteVersion.deleteMany({
    where: { userId, id: { in: versionIds } },
  });
}

/** Load all versions belonging to one user and note. */
export function loadNoteVersions(userId: string, noteId: string) {
  return db.noteVersion.findMany({ where: { userId, noteId } });
}

/** Resolve a version only when its user, note and version IDs all match. */
export function findNoteVersion(userId: string, noteId: string, versionId: string) {
  return db.noteVersion.findFirst({ where: { userId, noteId, id: versionId } });
}

/** Persist a restored snapshot as a note update after ownership was verified. */
export function restoreNoteVersion(
  noteId: string,
  data: { title: string; blocks: string; updatedAt: Date },
): Promise<Note> {
  return db.note.update({ where: { id: noteId }, data });
}

/** Find an active note within its owner's scope for lifecycle operations. */
export function findNoteForTrash(userId: string, noteId: string) {
  return db.note.findFirst({ where: { userId, id: noteId, deletedAt: null } });
}

/** Find a note within its owner's scope, including notes already in trash. */
export function findOwnedNote(userId: string, noteId: string) {
  return db.note.findFirst({ where: { userId, id: noteId } });
}

/** Move an owned note into or out of trash after the service validates its state. */
export function setNoteDeletedAt(
  noteId: string,
  deletedAt: Date | null,
  updatedAt?: Date,
): Promise<Note> {
  return db.note.update({
    where: { id: noteId },
    data: { deletedAt, ...(updatedAt ? { updatedAt } : {}) },
  });
}

/** Permanently remove the version history for an already owner-scoped note. */
export function deleteNoteVersionHistory(userId: string, noteId: string) {
  return db.noteVersion.deleteMany({ where: { userId, noteId } });
}

/** Permanently remove an already owner-scoped note. */
export function deleteOwnedNote(noteId: string) {
  return db.note.delete({ where: { id: noteId } });
}

/** Read the user's daily writing goal. */
export function loadDailyWordGoal(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: { dailyWordGoal: true },
  });
}

/** Persist the user's daily writing goal. */
export function saveDailyWordGoal(userId: string, dailyWordGoal: number) {
  return db.user.update({
    where: { id: userId },
    data: { dailyWordGoal },
    select: { dailyWordGoal: true },
  });
}

/** Read the user's timezone for local-day writing statistics. */
export function loadUserTimezone(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
}

/** Load active notes touched during a computed local-day UTC interval. */
export function loadNotesTouchedBetween(userId: string, start: Date, end: Date) {
  return db.note.findMany({
    where: {
      userId,
      deletedAt: null,
      OR: [
        { createdAt: { gte: start, lt: end } },
        { updatedAt: { gte: start, lt: end } },
      ],
    },
    select: { blocks: true },
  });
}

/** Persist spaced-repetition metadata computed by the Notes domain service. */
export function updateNoteReviewMetadata(
  noteId: string,
  data: Prisma.NoteUpdateInput,
): Promise<Note> {
  return db.note.update({ where: { id: noteId }, data });
}

/** Update the last-viewed timestamp after the service has resolved an active owned note. */
export function updateNoteLastViewed(noteId: string): Promise<Note> {
  return db.note.update({
    where: { id: noteId },
    data: { lastViewedAt: new Date() },
  });
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

/** Load notes matching a previously constructed, user-scoped filter. */
export function loadNotesMatchingFilters(where: Prisma.NoteWhereInput): Promise<Note[]> {
  return db.note.findMany({ where });
}

/** Count notes matching the same filter used by the list page query. */
export function countNotes(where: Prisma.NoteWhereInput): Promise<number> {
  return db.note.count({ where });
}

/** Load one metadata page using the shared Notes list projection. */
export function loadNotesPage(
  where: Prisma.NoteWhereInput,
  orderBy: Prisma.NoteOrderByWithRelationInput[],
  skip: number,
  take: number,
): Promise<NoteListRow[]> {
  return db.note.findMany({
    where,
    select: NOTE_LIST_SELECT,
    orderBy,
    skip,
    take,
  });
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

/** Resolve a folder only when it belongs to the requesting user. */
export function findUserFolder(userId: string, folderId: string) {
  return db.noteFolder.findFirst({
    where: { userId, id: folderId },
    select: { id: true },
  });
}

/** Create a note from domain-prepared data. */
export function createNoteRecord(data: Prisma.NoteUncheckedCreateInput): Promise<Note> {
  return db.note.create({ data });
}
