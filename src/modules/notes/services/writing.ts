import { db } from "@/lib/db";
import { countWords, parseJsonBlocks } from "@/lib/gaia/content";
import { writingSettingsInputSchema } from "@/modules/notes/schemas";

export type GaiaWritingSettings = { dailyWordGoal: number };

export type GaiaTodayWords = {
  wordsToday: number;
  notesTouchedToday: number;
  date: string;
};

/** Read the user's daily writing target. */
export async function getWritingSettingsQuery(
  userId: string,
): Promise<GaiaWritingSettings> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { dailyWordGoal: true },
  });
  return { dailyWordGoal: user?.dailyWordGoal ?? 0 };
}

/** Update the user's daily writing target after validating the input. */
export async function updateWritingSettingsCommand(
  userId: string,
  input: unknown,
): Promise<GaiaWritingSettings> {
  const parsed = writingSettingsInputSchema.parse(input);
  const user = await db.user.update({
    where: { id: userId },
    data: { dailyWordGoal: parsed.dailyWordGoal },
    select: { dailyWordGoal: true },
  });
  return { dailyWordGoal: user.dailyWordGoal };
}

/**
 * Count words in notes created or modified during the user's local day.
 * This intentionally preserves the existing approximation: it counts the
 * full contents of notes touched today, not a word-by-word content diff.
 */
export async function getTodayWordsQuery(userId: string): Promise<GaiaTodayWords> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const tz = user?.timezone ?? "UTC";
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((x) => x.type === "year")?.value ?? "1970";
  const m = parts.find((x) => x.type === "month")?.value ?? "01";
  const d = parts.find((x) => x.type === "day")?.value ?? "01";
  const dayStart = new Date(`${y}-${m}-${d}T00:00:00.000Z`);
  // Keep the legacy local-day-to-UTC boundary calculation unchanged.
  const tzOffsetMs = (() => {
    const utc = new Date(`${y}-${m}-${d}T12:00:00.000Z`);
    const local = new Date(utc.toLocaleString("en-US", { timeZone: tz }));
    return utc.getTime() - local.getTime();
  })();
  const start = new Date(dayStart.getTime() + tzOffsetMs);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const notes = await db.note.findMany({
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
  let wordsToday = 0;
  for (const note of notes) wordsToday += countWords(parseJsonBlocks(note.blocks));
  return { wordsToday, notesTouchedToday: notes.length, date: `${y}-${m}-${d}` };
}
