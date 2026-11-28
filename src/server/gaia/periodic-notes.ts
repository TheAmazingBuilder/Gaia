import "server-only";

import {
  getOrCreateDailyNoteCommand,
  getOrCreateWeeklyNoteCommand,
} from "@/modules/knowledge/services/periodic-notes";
import { loadFolders, loadTags } from "@/modules/notes/repositories/notes";
import { noteResponse } from "@/modules/notes/mappers";
import { createNote } from "@/server/gaia/notes-write";

type PeriodicNotesDependencies = Parameters<typeof getOrCreateDailyNoteCommand>[1];

const periodicNotesDependencies: PeriodicNotesDependencies = {
  loadFolders,
  loadTags,
  noteResponse,
  createNote,
};

export function getOrCreateDailyNote(userId: string) {
  return getOrCreateDailyNoteCommand(userId, periodicNotesDependencies);
}

export function getOrCreateWeeklyNote(userId: string) {
  return getOrCreateWeeklyNoteCommand(userId, periodicNotesDependencies);
}
