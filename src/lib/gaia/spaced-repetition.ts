/**
 * Gaïa — Phase 1 "Memory": spaced repetition (simplified SM-2).
 *
 * Pure functions only — no DB, no I/O, no LLM. The UI grades a review as
 * Forgot / Hard / Good / Easy (quality 0..3); the grade maps to a classic
 * SM-2 quality (0, 3, 4, 5) and the interval / ease factor follow the
 * original SM-2 rules, simplified:
 *
 *  - quality < 3 (Forgot): the interval restarts at 1 day.
 *  - quality >= 3: first success → 1 day, second → 6 days, then
 *    round(previous interval × ease factor). The repetition count is not
 *    stored separately: the current interval is the state (0 → 1, 1 → 6).
 *  - ease factor: ease + 0.1 − (5−q) × (0.08 + (5−q) × 0.02), floored at 1.3.
 *  - mastery is derived from the new interval: 0 days → forgotten,
 *    1–2 → fragile, 3–13 → medium, 14+ → mastered.
 *
 * Dragging a card to a Kanban column (or "Move to…" in its menu) sets the
 * mastery directly instead of grading a review: the next review date and
 * the interval follow the column (forgotten → now / 0, fragile → +1 day / 1,
 * medium → +3 days / 3, mastered → +7 days / 7). The ease factor and the
 * review count are untouched — a manual move is a reclassification, not a
 * review.
 */

export type MasteryLevel = "forgotten" | "fragile" | "medium" | "mastered";

/** UI review grade: 0 = Forgot, 1 = Hard, 2 = Good, 3 = Easy. */
export type ReviewQuality = 0 | 1 | 2 | 3;

export const MASTERY_LEVELS: MasteryLevel[] = [
  "forgotten",
  "fragile",
  "medium",
  "mastered",
];

/** SM-2 quality behind each UI grade (Forgot/Hard/Good/Easy). */
const SM2_QUALITY: Record<ReviewQuality, number> = { 0: 0, 1: 3, 2: 4, 3: 5 };

/** Mastery weight used by the Memory Score (see getMemoryStats). */
export const MASTERY_VALUE: Record<MasteryLevel, number> = {
  forgotten: 0,
  fragile: 0.33,
  medium: 0.66,
  mastered: 1,
};

export function isMasteryLevel(value: unknown): value is MasteryLevel {
  return (
    typeof value === "string" &&
    (MASTERY_LEVELS as string[]).includes(value)
  );
}

export function isReviewQuality(value: unknown): value is ReviewQuality {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 3
  );
}

/** Mastery implied by a review interval (days). */
export function masteryFromInterval(intervalDays: number): MasteryLevel {
  if (intervalDays <= 0) return "forgotten";
  if (intervalDays <= 2) return "fragile";
  if (intervalDays <= 13) return "medium";
  return "mastered";
}

export interface ReviewState {
  easeFactor: number;
  intervalDays: number;
}

export interface ReviewResult {
  intervalDays: number;
  easeFactor: number;
  mastery: MasteryLevel;
  nextReviewAt: Date;
}

/**
 * Apply one graded review. `now` is injectable for tests / determinism.
 */
export function applyReview(
  current: ReviewState,
  quality: ReviewQuality,
  now: Date = new Date(),
): ReviewResult {
  const q = SM2_QUALITY[quality];
  const easeFactor = Math.round(
    Math.max(1.3, current.easeFactor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)) * 100,
  ) / 100;
  let intervalDays: number;
  if (q < 3) {
    intervalDays = 1;
  } else if (current.intervalDays <= 0) {
    intervalDays = 1;
  } else if (current.intervalDays === 1) {
    intervalDays = 6;
  } else {
    intervalDays = Math.round(current.intervalDays * easeFactor);
  }
  return {
    intervalDays,
    easeFactor,
    mastery: masteryFromInterval(intervalDays),
    nextReviewAt: new Date(now.getTime() + intervalDays * 86_400_000),
  };
}

export interface MoveToMasteryResult {
  mastery: MasteryLevel;
  intervalDays: number;
  nextReviewAt: Date;
}

/** Next review date + interval when a card is moved to a mastery column. */
export function moveToMastery(
  mastery: MasteryLevel,
  now: Date = new Date(),
): MoveToMasteryResult {
  const days: Record<MasteryLevel, number> = {
    forgotten: 0,
    fragile: 1,
    medium: 3,
    mastered: 7,
  };
  const intervalDays = days[mastery];
  return {
    mastery,
    intervalDays,
    nextReviewAt: new Date(now.getTime() + intervalDays * 86_400_000),
  };
}

/** A note is due when it was never reviewed or its review date has passed. */
export function isDue(nextReviewAt: Date | null, now: Date = new Date()): boolean {
  return nextReviewAt === null || nextReviewAt.getTime() <= now.getTime();
}

// ── Phase 2 — Temporal Kanban ────────────────────────────────────────────
// Columns are time buckets for the *next* review, not mastery levels.
// Moving a card here reschedules it only: mastery, ease and review count
// are untouched — a manual move is a reclassification, not a review.

export type TimePeriod = "today" | "week" | "month" | "later";

export const TIME_PERIODS: TimePeriod[] = ["today", "week", "month", "later"];

export function isTimePeriod(value: unknown): value is TimePeriod {
  return (
    typeof value === "string" &&
    (TIME_PERIODS as string[]).includes(value)
  );
}

/**
 * Time bucket of a next-review date: overdue or null → "today",
 * within 7 days → "week", within 30 days → "month", beyond → "later".
 */
export function periodOf(nextReviewAt: Date | null, now: Date = new Date()): TimePeriod {
  if (nextReviewAt === null || nextReviewAt.getTime() <= now.getTime()) {
    return "today";
  }
  const ms = nextReviewAt.getTime() - now.getTime();
  if (ms <= 7 * 86_400_000) return "week";
  if (ms <= 30 * 86_400_000) return "month";
  return "later";
}

export interface MoveToPeriodResult {
  intervalDays: number;
  nextReviewAt: Date;
}

/**
 * Next review date + interval when a card is moved to a time column.
 * Today means "due now" (interval 0); the other buckets are midpoints
 * (week → +4 days, month → +14 days, later → +30 days) so the card
 * lands inside its column instead of on its edge.
 */
export function moveToPeriod(
  period: TimePeriod,
  now: Date = new Date(),
): MoveToPeriodResult {
  const days: Record<TimePeriod, number> = {
    today: 0,
    week: 4,
    month: 14,
    later: 30,
  };
  const intervalDays = days[period];
  return {
    intervalDays,
    nextReviewAt: new Date(now.getTime() + intervalDays * 86_400_000),
  };
}
