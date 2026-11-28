import { db } from "@/shared/database/client";
import { isMasteryLevel, MASTERY_VALUE } from "@/lib/gaia/spaced-repetition";
import type {
  GaiaMemoryHeatmapDay,
  GaiaMemoryJournal,
  GaiaMemoryStatsResponse,
  GaiaMemoryTimelineMonth,
  GaiaMemoryTimelineNote,
} from "@/modules/knowledge/types";
import type { MasteryLevel } from "@/lib/gaia/spaced-repetition";

/**
 * Memory Score:
 * round(100 × (0.55 × avgMastery + 0.25 × dueClearance + 0.20 × streakFactor)).
 *
 * Review history is not persisted yet. Heatmap and journal review counts are
 * therefore derived from lastReviewedAt and represent each note's latest review.
 */
export async function getMemoryStatsQuery(
  userId: string,
): Promise<GaiaMemoryStatsResponse> {
  const notes = await db.note.findMany({
    where: { userId, deletedAt: null },
    select: {
      id: true,
      title: true,
      mastery: true,
      lastReviewedAt: true,
      nextReviewAt: true,
      createdAt: true,
    },
  });
  const now = new Date();
  const totalNotes = notes.length;

  const countsByMastery: Record<MasteryLevel, number> = {
    forgotten: 0,
    fragile: 0,
    medium: 0,
    mastered: 0,
  };
  let masterySum = 0;
  let dueCount = 0;
  for (const note of notes) {
    const level: MasteryLevel = isMasteryLevel(note.mastery) ? note.mastery : "fragile";
    countsByMastery[level] += 1;
    masterySum += MASTERY_VALUE[level];
    if (note.nextReviewAt === null || note.nextReviewAt.getTime() <= now.getTime()) {
      dueCount += 1;
    }
  }

  const dayKey = (date: Date): string => date.toISOString().slice(0, 10);
  const todayKey = dayKey(now);
  const heatmap: GaiaMemoryHeatmapDay[] = [];
  const byDay = new Map<string, GaiaMemoryHeatmapDay>();
  for (let i = 181; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 86_400_000);
    const day = { date: dayKey(date), reviews: 0, created: 0 };
    heatmap.push(day);
    byDay.set(day.date, day);
  }
  for (const note of notes) {
    const created = byDay.get(dayKey(note.createdAt));
    if (created) created.created += 1;
    if (note.lastReviewedAt !== null) {
      const reviewed = byDay.get(dayKey(note.lastReviewedAt));
      if (reviewed) reviewed.reviews += 1;
    }
  }

  const reviewDays = new Set(
    notes
      .filter((note) => note.lastReviewedAt !== null)
      .map((note) => dayKey(note.lastReviewedAt as Date)),
  );
  let streakDays = 0;
  let cursor = reviewDays.has(todayKey) ? 0 : 1;
  while (reviewDays.has(dayKey(new Date(now.getTime() - cursor * 86_400_000)))) {
    streakDays += 1;
    cursor += 1;
  }

  const timelineByMonth = new Map<string, GaiaMemoryTimelineNote[]>();
  const countByMonth = new Map<string, number>();
  for (const note of [...notes].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  )) {
    const month = note.createdAt.toISOString().slice(0, 7);
    countByMonth.set(month, (countByMonth.get(month) ?? 0) + 1);
    const list = timelineByMonth.get(month) ?? [];
    if (list.length < 20) {
      list.push({
        id: note.id,
        title: note.title,
        mastery: isMasteryLevel(note.mastery) ? note.mastery : "fragile",
        createdAt: note.createdAt.toISOString(),
      });
    }
    timelineByMonth.set(month, list);
  }
  const timeline: GaiaMemoryTimelineMonth[] = [...timelineByMonth.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 12)
    .map(([month, monthNotes]) => ({
      month,
      count: countByMonth.get(month) ?? monthNotes.length,
      notes: monthNotes,
    }));

  const startOfTodayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const journal: GaiaMemoryJournal = {
    today: {
      created: notes.filter((note) => note.createdAt >= startOfTodayUtc).length,
      reviewed: notes.filter(
        (note) => note.lastReviewedAt !== null && note.lastReviewedAt >= startOfTodayUtc,
      ).length,
      dueRemaining: dueCount,
      newlyMastered: notes.filter(
        (note) =>
          note.mastery === "mastered" &&
          note.lastReviewedAt !== null &&
          note.lastReviewedAt >= startOfTodayUtc,
      ).length,
    },
    week: {
      created: notes.filter((note) => note.createdAt >= weekAgo).length,
      reviewed: notes.filter(
        (note) => note.lastReviewedAt !== null && note.lastReviewedAt >= weekAgo,
      ).length,
    },
  };

  if (totalNotes === 0) {
    return {
      totalNotes: 0,
      dueCount: 0,
      countsByMastery,
      score: null,
      scoreParts: { avgMastery: 0, dueClearance: 0, streakFactor: 0 },
      streakDays,
      heatmap,
      timeline,
      journal,
    };
  }

  const avgMastery = masterySum / totalNotes;
  const dueClearance = 1 - dueCount / Math.max(1, totalNotes);
  const streakFactor = Math.min(7, streakDays) / 7;
  const score = Math.round(
    100 * (0.55 * avgMastery + 0.25 * dueClearance + 0.2 * streakFactor),
  );
  return {
    totalNotes,
    dueCount,
    countsByMastery,
    score,
    scoreParts: { avgMastery, dueClearance, streakFactor },
    streakDays,
    heatmap,
    timeline,
    journal,
  };
}
