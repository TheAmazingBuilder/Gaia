"use client";

/**
 * Gaïa — Phase 1 "Memory" tab.
 *
 * Heat Memory System + Kanban by mastery + spaced repetition + GitHub-style
 * activity heatmap + Memory Score. No AI, no new dependencies: native HTML5
 * drag & drop for the board, with a "Move to…" menu on every card as the
 * keyboard / touch alternative (WCAG 2.2 dragging movements).
 *
 * Mastery is never conveyed by color alone: every dot is paired with a
 * text label (MasteryBadge), the heatmap has a text summary + legend.
 */
import * as React from "react";
import { Brain, Flame, MoreVertical } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  GAIA_DEFAULT_PARAMS,
  GaiaEmptyState,
  gaiaErrorMessage,
  MASTERY_META,
  MasteryBadge,
  useGaiaMemoryStats,
  useGaiaNotes,
  useMoveGaiaNoteToMastery,
  useReviewGaiaNote,
  type GaiaNoteRow,
  type GaiaT,
} from "./gaia-shared";
import {
  MASTERY_LEVELS,
  type MasteryLevel,
  type ReviewQuality,
} from "@/lib/gaia/spaced-repetition";

const REVIEW_GRADES: Array<{ quality: ReviewQuality; key: string }> = [
  { quality: 0, key: "forgot" },
  { quality: 1, key: "hard" },
  { quality: 2, key: "good" },
  { quality: 3, key: "easy" },
];

function shortDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-CA");
}

function isDue(note: GaiaNoteRow): boolean {
  return note.nextReviewAt === null || new Date(note.nextReviewAt).getTime() <= Date.now();
}

// ── Score ring ──────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const t = useTranslations();
  const r = 40;
  const c = 2 * Math.PI * r;
  return (
    <div
      role="img"
      aria-label={t("gaia.memory.scoreLabel", { score })}
      className="relative size-24 shrink-0"
    >
      <svg viewBox="0 0 96 96" className="size-24 -rotate-90" aria-hidden="true">
        <circle cx="48" cy="48" r={r} fill="none" strokeWidth="8" className="stroke-muted" />
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          className="stroke-emerald-500"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-2xl font-bold tabular-nums">{score}</span>
        <span className="text-[10px] text-muted-foreground">/ 100</span>
      </span>
    </div>
  );
}

// ── Memory card ─────────────────────────────────────────────────────────────

function MemoryCard({
  note,
  onOpenNote,
}: {
  note: GaiaNoteRow;
  onOpenNote: (id: string) => void;
}) {
  const t = useTranslations();
  const tr: GaiaT = (key) => t(key);
  const { toast } = useToast();
  const [reviewing, setReviewing] = React.useState(false);
  const reviewNote = useReviewGaiaNote();
  const moveNote = useMoveGaiaNoteToMastery();
  const due = isDue(note);

  const handleReview = (quality: ReviewQuality) => {
    void reviewNote
      .mutateAsync({ noteId: note.id, quality })
      .then(
        (res) => {
          setReviewing(false);
          toast({
            title: t("gaia.memory.reviewedToast", {
              date: shortDate(res.note.nextReviewAt),
            }),
          });
        },
        (err: unknown) =>
          toast({ variant: "destructive", title: gaiaErrorMessage(err) }),
      );
  };

  const handleMove = (mastery: MasteryLevel) => {
    if (mastery === note.mastery) return;
    void moveNote.mutateAsync({ noteId: note.id, mastery }).catch((err: unknown) =>
      toast({ variant: "destructive", title: gaiaErrorMessage(err) }),
    );
  };

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      data-testid="gaia-memory-card"
      aria-label={`${t("gaia.shared.openNote")} ${note.title === "" ? t("gaia.shared.untitledNote") : note.title}`}
      onClick={() => onOpenNote(note.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpenNote(note.id);
      }}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", note.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="group cursor-grab rounded-lg border bg-card p-3 hover:border-emerald-500/40 hover:bg-muted/30 active:cursor-grabbing"
    >
      <div className="flex items-start gap-2">
        <span className="text-base leading-none" aria-hidden="true">
          {note.icon ?? "📝"}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          {note.title === "" ? t("gaia.shared.untitledNote") : note.title}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t("gaia.memory.moveTo")}
              onClick={(e) => e.stopPropagation()}
              className="min-h-11 min-w-11 shrink-0 rounded-md p-2 text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-emerald-500"
            >
              <MoreVertical className="size-4" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
            {MASTERY_LEVELS.map((level) => (
              <DropdownMenuItem
                key={level}
                disabled={level === note.mastery || moveNote.isPending}
                onClick={() => handleMove(level)}
              >
                <span
                  className={`size-2 rounded-full ${MASTERY_META[level].dot}`}
                  aria-hidden="true"
                />
                {t(`gaia.memory.levels.${level}`)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {note.excerpt ? (
        <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{note.excerpt}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <MasteryBadge mastery={note.mastery} />
        {note.reviewCount > 0 ? (
          <span className="text-[11px] text-muted-foreground">
            {t("gaia.memory.reviewsCount", { count: note.reviewCount })}
          </span>
        ) : null}
        <span
          className={`ml-auto text-[11px] ${due ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground"}`}
        >
          {due
            ? t("gaia.memory.dueNow")
            : t("gaia.memory.nextReview", { date: shortDate(note.nextReviewAt) })}
        </span>
      </div>
      <div className="mt-2" onClick={(e) => e.stopPropagation()}>
        {reviewing ? (
          <div className="grid grid-cols-4 gap-1" role="group" aria-label={t("gaia.memory.review")}>
            {REVIEW_GRADES.map((grade) => (
              <button
                key={grade.quality}
                type="button"
                disabled={reviewNote.isPending}
                onClick={() => handleReview(grade.quality)}
                className="min-h-11 rounded-md border bg-muted/50 px-1 text-xs font-medium hover:bg-emerald-500/15 hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-500 disabled:opacity-50 dark:hover:text-emerald-400"
              >
                {t(`gaia.memory.qualities.${grade.key}`)}
              </button>
            ))}
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 w-full"
            disabled={reviewNote.isPending || moveNote.isPending}
            onClick={() => setReviewing(true)}
          >
            {t("gaia.memory.review")}
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Kanban column ───────────────────────────────────────────────────────────

function MemoryColumn({
  mastery,
  dueOnly,
  onOpenNote,
}: {
  mastery: MasteryLevel;
  dueOnly: boolean;
  onOpenNote: (id: string) => void;
}) {
  const t = useTranslations();
  const { toast } = useToast();
  const [dragOver, setDragOver] = React.useState(false);
  const moveNote = useMoveGaiaNoteToMastery();
  const notesQuery = useGaiaNotes({
    ...GAIA_DEFAULT_PARAMS,
    mastery,
    due: dueOnly,
    pageSize: 50,
    sort: "updated",
  });
  const notes = notesQuery.data?.notes ?? [];
  const total = notesQuery.data?.total ?? 0;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const noteId = e.dataTransfer.getData("text/plain");
    if (!noteId) return;
    const dragged = notes.find((n) => n.id === noteId);
    if (dragged) return; // dropped back in its own column
    void moveNote.mutateAsync({ noteId, mastery }).catch((err: unknown) =>
      toast({ variant: "destructive", title: gaiaErrorMessage(err) }),
    );
  };

  return (
    <section
      aria-label={t(`gaia.memory.levels.${mastery}`)}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`flex w-[280px] shrink-0 snap-start flex-col rounded-xl border bg-muted/30 p-3 sm:min-w-0 sm:flex-1 ${
        dragOver ? "border-emerald-500/60 ring-2 ring-emerald-500/30" : ""
      }`}
    >
      <header className="flex items-center gap-2 px-1 pb-2">
        <span className={`size-2.5 rounded-full ${MASTERY_META[mastery].dot}`} aria-hidden="true" />
        <h3 className="text-sm font-semibold">{t(`gaia.memory.levels.${mastery}`)}</h3>
        <span className="ml-auto font-mono text-xs text-muted-foreground tabular-nums">
          {total}
        </span>
      </header>
      {notesQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
          {t("gaia.memory.columnEmpty")}
        </p>
      ) : (
        <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-0.5">
          {notes.map((note) => (
            <MemoryCard key={note.id} note={note} onOpenNote={onOpenNote} />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Heatmap ─────────────────────────────────────────────────────────────────

function heatLevel(total: number): number {
  if (total <= 0) return 0;
  if (total === 1) return 1;
  if (total <= 3) return 2;
  if (total <= 6) return 3;
  return 4;
}

const HEAT_CLASSES = [
  "bg-muted",
  "bg-emerald-500/25",
  "bg-emerald-500/50",
  "bg-emerald-500/75",
  "bg-emerald-500",
];

function MemoryHeatmap({
  heatmap,
}: {
  heatmap: Array<{ date: string; reviews: number; created: number }>;
}) {
  const t = useTranslations();
  const totalReviews = heatmap.reduce((sum, d) => sum + d.reviews, 0);
  const totalCreated = heatmap.reduce((sum, d) => sum + d.created, 0);
  const summary = t("gaia.memory.heatmapSummary", {
    reviews: totalReviews,
    created: totalCreated,
  });
  const weeks: Array<typeof heatmap> = [];
  for (let i = 0; i < heatmap.length; i += 7) weeks.push(heatmap.slice(i, i + 7));

  return (
    <section
      data-testid="gaia-memory-heatmap"
      className="rounded-xl border bg-card p-4"
    >
      <h2 className="text-sm font-semibold">{t("gaia.memory.heatmapTitle")}</h2>
      <p className="text-xs text-muted-foreground">{t("gaia.memory.heatmapHint")}</p>
      <p className="mt-1 text-xs text-muted-foreground">{summary}</p>
      <div className="mt-3 overflow-x-auto pb-1">
        <div role="img" aria-label={summary} className="flex w-fit gap-[3px]">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]" aria-hidden="true">
              {week.map((day) => (
                <span
                  key={day.date}
                  title={`${day.date}: ${day.reviews} ${t("gaia.memory.heatmapReviews")}, ${day.created} ${t("gaia.memory.heatmapCreated")}`}
                  className={`size-2.5 rounded-[2px] sm:size-3 ${HEAT_CLASSES[heatLevel(day.reviews + day.created)]}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <span>{t("gaia.memory.heatmapLess")}</span>
        {HEAT_CLASSES.map((cls, i) => (
          <span key={i} className={`size-2.5 rounded-[2px] ${cls}`} aria-hidden="true" />
        ))}
        <span>{t("gaia.memory.heatmapMore")}</span>
      </div>
    </section>
  );
}

// ── Panel ───────────────────────────────────────────────────────────────────

export function MemoryPanel({
  onOpenNote,
  onCreateNote,
}: {
  onOpenNote: (id: string) => void;
  onCreateNote: (folderId?: string | null) => void;
}) {
  const t = useTranslations();
  const statsQuery = useGaiaMemoryStats();
  const [dueOnly, setDueOnly] = React.useState(false);
  const stats = statsQuery.data;

  if (statsQuery.isLoading) {
    return (
      <div className="space-y-3" data-testid="gaia-memory-panel">
        <Skeleton className="h-32 w-full" />
        <div className="flex gap-3 overflow-x-auto">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-[280px] shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats || stats.totalNotes === 0) {
    return (
      <div data-testid="gaia-memory-panel">
        <GaiaEmptyState
          icon={<Brain className="size-8" aria-hidden="true" />}
          title={t("gaia.memory.emptyTitle")}
          body={t("gaia.memory.emptyBody")}
          testid="gaia-memory-empty"
          action={
            <Button type="button" size="sm" onClick={() => onCreateNote(null)}>
              {t("gaia.overview.createFirstNote")}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div data-testid="gaia-memory-panel" className="space-y-4">
      {/* Score header */}
      <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
        {stats.score !== null ? <ScoreRing score={stats.score} /> : null}
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-sm font-semibold">{t("gaia.memory.scoreTitle")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("gaia.memory.dueCount", { count: stats.dueCount })}
            {" · "}
            <span className="inline-flex items-center gap-1">
              <Flame className="size-3.5 text-orange-400" aria-hidden="true" />
              {t("gaia.memory.streakDays", { count: stats.streakDays })}
            </span>
          </p>
          <dl className="grid gap-1 text-xs sm:grid-cols-3">
            <div className="flex items-baseline justify-between gap-2 sm:flex-col sm:justify-start">
              <dt className="text-muted-foreground">{t("gaia.memory.scoreMastery")}</dt>
              <dd className="font-mono font-semibold tabular-nums">
                {Math.round(stats.scoreParts.avgMastery * 100)}%
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-2 sm:flex-col sm:justify-start">
              <dt className="text-muted-foreground">{t("gaia.memory.scoreDue")}</dt>
              <dd className="font-mono font-semibold tabular-nums">
                {Math.round(stats.scoreParts.dueClearance * 100)}%
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-2 sm:flex-col sm:justify-start">
              <dt className="text-muted-foreground">{t("gaia.memory.scoreStreak")}</dt>
              <dd className="font-mono font-semibold tabular-nums">
                {Math.round(stats.scoreParts.streakFactor * 100)}%
              </dd>
            </div>
          </dl>
          <p className="text-[11px] text-muted-foreground">{t("gaia.memory.scoreFormula")}</p>
        </div>
        <Button
          type="button"
          variant={dueOnly ? "default" : "outline"}
          aria-pressed={dueOnly}
          onClick={() => setDueOnly((v) => !v)}
          className="min-h-11 shrink-0"
        >
          {dueOnly ? t("gaia.memory.showAll") : t("gaia.memory.dueOnly")}
        </Button>
      </section>

      {/* Kanban board */}
      <section aria-label={t("gaia.memory.boardTitle")}>
        <p className="mb-2 text-xs text-muted-foreground">{t("gaia.memory.boardHint")}</p>
        <div className="flex snap-x gap-3 overflow-x-auto pb-2 sm:snap-none">
          {MASTERY_LEVELS.map((level) => (
            <MemoryColumn
              key={level}
              mastery={level}
              dueOnly={dueOnly}
              onOpenNote={onOpenNote}
            />
          ))}
        </div>
      </section>

      <MemoryHeatmap heatmap={stats.heatmap} />
    </div>
  );
}
