import {
  getOrCreateDailyNoteCommand,
  getOrCreateWeeklyNoteCommand,
} from "@/modules/knowledge/services/periodic-notes";

type DailyDependencies = Parameters<typeof getOrCreateDailyNoteCommand>[1];
type WeeklyDependencies = Parameters<typeof getOrCreateWeeklyNoteCommand>[1];

export function getOrCreateDailyNote(
  userId: string,
  deps: DailyDependencies,
) {
  return getOrCreateDailyNoteCommand(userId, deps);
}

export function getOrCreateWeeklyNote(
  userId: string,
  deps: WeeklyDependencies,
) {
  return getOrCreateWeeklyNoteCommand(userId, deps);
}
