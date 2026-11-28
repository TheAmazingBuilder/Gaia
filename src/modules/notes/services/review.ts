import { db } from "@/lib/db";
import type { GaiaNoteResponse } from "@/modules/notes/types";
import type { MasteryLevel, ReviewQuality, TimePeriod } from "@/lib/gaia/spaced-repetition";
import {
  applyReview,
  isMasteryLevel,
  isTimePeriod,
  moveToMastery,
  moveToPeriod,
} from "@/lib/gaia/spaced-repetition";
import type { Note } from "@prisma/client";
import { z } from "zod";
import { parseOrThrow } from "@/shared/validation/parse-or-throw";

type ReviewDependencies = {
  validationError: (message: string, issues?: { path: string; message: string }[]) => Error;
  noteNotFound: () => Error;
  noteResponse: (userId: string, note: Note) => Promise<GaiaNoteResponse>;
};


const reviewInputSchema = z.object({
  quality: z.number().int().min(0).max(3),
});

const masteryInputSchema = z.object({
  mastery: z.string().refine((value): value is MasteryLevel => isMasteryLevel(value), {
    message: "Invalid mastery level.",
  }),
});

const scheduleInputSchema = z.object({
  period: z.string().refine((value): value is TimePeriod => isTimePeriod(value), {
    message: "Invalid time period.",
  }),
});

/** A review updates spaced-repetition metadata only; note content is untouched. */
export async function reviewNoteCommand(
  userId: string,
  noteId: string,
  input: unknown,
  deps: ReviewDependencies,
): Promise<GaiaNoteResponse> {
  const parsed = parseOrThrow(reviewInputSchema, input, deps.validationError);
  const note = await db.note.findFirst({ where: { userId, id: noteId, deletedAt: null } });
  if (!note) throw deps.noteNotFound();

  const now = new Date();
  const result = applyReview(
    { easeFactor: note.easeFactor, intervalDays: note.intervalDays },
    parsed.quality as ReviewQuality,
    now,
  );
  const updated = await db.note.update({
    where: { id: note.id },
    data: {
      mastery: result.mastery,
      intervalDays: result.intervalDays,
      easeFactor: result.easeFactor,
      nextReviewAt: result.nextReviewAt,
      lastReviewedAt: now,
      reviewCount: note.reviewCount + 1,
      updatedAt: now,
    },
  });
  return deps.noteResponse(userId, updated);
}

/** Manual mastery moves are reclassification, not reviews. */
export async function moveNoteToMasteryCommand(
  userId: string,
  noteId: string,
  input: unknown,
  deps: ReviewDependencies,
): Promise<GaiaNoteResponse> {
  const parsed = parseOrThrow(masteryInputSchema, input, deps.validationError);
  const note = await db.note.findFirst({ where: { userId, id: noteId, deletedAt: null } });
  if (!note) throw deps.noteNotFound();

  const result = moveToMastery(parsed.mastery, new Date());
  const updated = await db.note.update({
    where: { id: note.id },
    data: {
      mastery: result.mastery,
      intervalDays: result.intervalDays,
      nextReviewAt: result.nextReviewAt,
      updatedAt: new Date(),
    },
  });
  return deps.noteResponse(userId, updated);
}

/** Temporal Kanban rescheduling changes the next review date, not mastery. */
export async function scheduleNoteCommand(
  userId: string,
  noteId: string,
  input: unknown,
  deps: ReviewDependencies,
): Promise<GaiaNoteResponse> {
  const parsed = parseOrThrow(scheduleInputSchema, input, deps.validationError);
  const note = await db.note.findFirst({ where: { userId, id: noteId, deletedAt: null } });
  if (!note) throw deps.noteNotFound();

  const result = moveToPeriod(parsed.period, new Date());
  const updated = await db.note.update({
    where: { id: note.id },
    data: {
      intervalDays: result.intervalDays,
      nextReviewAt: result.nextReviewAt,
      updatedAt: new Date(),
    },
  });
  return deps.noteResponse(userId, updated);
}
