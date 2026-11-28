import {
  moveNoteToMasteryCommand,
  reviewNoteCommand,
  scheduleNoteCommand,
} from "@/modules/notes/services/review";
import { loadFolders, loadTags } from "@/modules/notes/repositories/notes";
import { noteResponse } from "@/modules/notes/mappers";
import { notFound, validationError } from "@/shared/errors/gaia-error";

const NOTE_NOT_FOUND = () => notFound("NOTE_NOT_FOUND", "Note not found.");

const reviewDependencies = () => ({
  validationError,
  noteNotFound: NOTE_NOT_FOUND,
  noteResponse: async (ownerId: string, note: Parameters<typeof noteResponse>[1]) => {
    const [folders, tags] = await Promise.all([loadFolders(ownerId), loadTags(ownerId)]);
    return noteResponse(ownerId, note, folders, tags);
  },
});

export async function reviewNote(
  userId: string,
  noteId: string,
  input: unknown,
) {
  return reviewNoteCommand(userId, noteId, input, reviewDependencies());
}

/** Manual mastery move is a reclassification, not a spaced-repetition review. */
export async function moveNoteToMastery(
  userId: string,
  noteId: string,
  input: unknown,
) {
  return moveNoteToMasteryCommand(userId, noteId, input, reviewDependencies());
}

/** Reschedule a note without changing mastery, ease factor or review count. */
export async function scheduleNote(
  userId: string,
  noteId: string,
  input: unknown,
) {
  return scheduleNoteCommand(userId, noteId, input, reviewDependencies());
}
