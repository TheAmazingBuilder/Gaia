import { db } from "@/shared/database/client";

type NoteLifecycleErrors = {
  noteNotFound: () => Error;
};

/**
 * Soft-delete an active note. The note remains recoverable in the trash.
 */
export async function trashNoteCommand(
  userId: string,
  noteId: string,
  errors: NoteLifecycleErrors,
): Promise<{ ok: true }> {
  const note = await db.note.findFirst({
    where: { userId, id: noteId, deletedAt: null },
  });
  if (!note) throw errors.noteNotFound();

  await db.note.update({
    where: { id: note.id },
    data: { deletedAt: new Date() },
  });
  return { ok: true };
}

/**
 * Restore a note only when it belongs to the user and is currently in trash.
 */
export async function restoreNoteCommand(
  userId: string,
  noteId: string,
  errors: NoteLifecycleErrors,
): Promise<{ ok: true }> {
  const note = await db.note.findFirst({
    where: { userId, id: noteId },
  });
  if (!note || note.deletedAt === null) throw errors.noteNotFound();

  await db.note.update({
    where: { id: note.id },
    data: { deletedAt: null, updatedAt: new Date() },
  });
  return { ok: true };
}

/**
 * Permanently delete a trashed note and its version history.
 */
export async function purgeNoteCommand(
  userId: string,
  noteId: string,
  errors: NoteLifecycleErrors,
): Promise<{ ok: true }> {
  const note = await db.note.findFirst({
    where: { userId, id: noteId },
  });
  if (!note || note.deletedAt === null) throw errors.noteNotFound();

  await db.noteVersion.deleteMany({
    where: { userId, noteId: note.id },
  });
  await db.note.delete({ where: { id: note.id } });
  return { ok: true };
}
