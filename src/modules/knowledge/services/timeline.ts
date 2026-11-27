import { db } from "@/lib/db";
import { isMasteryLevel } from "@/lib/gaia/spaced-repetition";
import type { GaiaKnowledgeTimelineMonth } from "@/modules/knowledge/types";

export async function getKnowledgeTimelineQuery(
  userId: string,
): Promise<{ months: GaiaKnowledgeTimelineMonth[] }> {
  const [notes, relations] = await Promise.all([
    db.note.findMany({
      where: { userId, deletedAt: null },
      select: { id: true, title: true, mastery: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
    }),
    db.noteRelation.findMany({ where: { userId }, select: { createdAt: true } }),
  ]);

  const monthKey = (date: Date) =>
    `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  const byMonth = new Map<string, GaiaKnowledgeTimelineMonth>();
  const ensure = (key: string): GaiaKnowledgeTimelineMonth => {
    let month = byMonth.get(key);
    if (!month) {
      month = { month: key, created: 0, edited: 0, relations: 0, notes: [] };
      byMonth.set(key, month);
    }
    return month;
  };

  for (const note of notes) {
    const created = ensure(monthKey(note.createdAt));
    created.created += 1;
    if (created.notes.length < 10) {
      created.notes.push({
        id: note.id,
        title: note.title,
        mastery: isMasteryLevel(note.mastery) ? note.mastery : "fragile",
        createdAt: note.createdAt.toISOString(),
      });
    }

    const updatedKey = monthKey(note.updatedAt);
    if (updatedKey !== monthKey(note.createdAt)) {
      ensure(updatedKey).edited += 1;
    }
  }

  for (const relation of relations) {
    ensure(monthKey(relation.createdAt)).relations += 1;
  }

  const months = [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month));
  return { months: months.slice(0, 12) };
}
