import {
  deleteNoteVersionHistory,
  deleteOwnedNote,
  findNoteForTrash,
  findOwnedNote,
  setNoteDeletedAt,
} from "@/modules/notes/repositories/notes";

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
  const note = await findNoteForTrash(userId, noteId);
  if (!note) throw errors.noteNotFound();

  await setNoteDeletedAt(note.id, new Date());
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
  const note = await findOwnedNote(userId, noteId);
  if (!note || note.deletedAt === null) throw errors.noteNotFound();

  await setNoteDeletedAt(note.id, null, new Date());
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
  const note = await findOwnedNote(userId, noteId);
  if (!note || note.deletedAt === null) throw errors.noteNotFound();

  await deleteNoteVersionHistory(userId, note.id);
  await deleteOwnedNote(note.id);
  return { ok: true };
}
