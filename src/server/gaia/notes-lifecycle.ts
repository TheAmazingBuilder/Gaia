import "server-only";

import {
  purgeNoteCommand,
  restoreNoteCommand,
  trashNoteCommand,
} from "@/modules/notes/services/lifecycle";
import { notFound } from "@/shared/errors/gaia-error";

const NOTE_NOT_FOUND = () => notFound("NOTE_NOT_FOUND", "Note not found.");

export async function trashNote(userId: string, noteId: string): Promise<{ ok: true }> {
  return trashNoteCommand(userId, noteId, { noteNotFound: NOTE_NOT_FOUND });
}

export async function restoreNote(userId: string, noteId: string): Promise<{ ok: true }> {
  return restoreNoteCommand(userId, noteId, { noteNotFound: NOTE_NOT_FOUND });
}

export async function purgeNote(userId: string, noteId: string): Promise<{ ok: true }> {
  return purgeNoteCommand(userId, noteId, { noteNotFound: NOTE_NOT_FOUND });
}
