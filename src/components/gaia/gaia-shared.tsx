"use client";

/**
 * Gaïa — shared types, visuals and data layer.
 *
 * Replica of Euforia's Nofy shared module, renamed for Promethe: every
 * user-facing string goes through gaia.* i18n keys, hues are the Gaïa
 * brand accents (never Euforia's cobalt), and the API base is /api/v1/gaia.
 */
import * as React from "react";
import {
  CandlestickChart,
  FlaskConical,
  Globe2,
  GraduationCap,
  NotebookText,
  ScrollText,
  Swords,
  type LucideIcon,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { parseInlineSegments } from "@/lib/gaia/inline";
import { parseHash, routeToPath } from "@/lib/routes";
import {
  type MasteryLevel,
  type ReviewQuality,
  type TimePeriod,
} from "@/lib/gaia/spaced-repetition";

// ── Block model (mirrors the backend contract) ─────────────────────────────

export type GaiaBlockType =
  | "paragraph"
  | "h1"
  | "h2"
  | "h3"
  | "bullet"
  | "numbered"
  | "todo"
  | "quote"
  | "callout"
  | "divider"
  | "code"
  | "table"
  | "image"
  | "ref"
  // Module 1 — Advanced Editor.
  | "toggle"
  | "columns"
  | "equation"
  | "drawing"
  | "mermaid"
  | "embed"
  | "toc"
  | "synced";

export type GaiaTableColType = "text" | "number" | "date" | "checkbox";

export interface GaiaTableMeta {
  sortBy?: number;
  sortDir?: "asc" | "desc";
  colTypes?: GaiaTableColType[];
}

export interface GaiaBlockComment {
  id: string;
  author: string;
  text: string;
  /** Optionnels côté serveur (schéma Zod) : aligné avec content.ts. */
  createdAt?: string;
  resolved?: boolean;
}

export type GaiaCalloutTone = "info" | "tip" | "warn" | "risk";

export type GaiaRefKind =
  | "TRADE"
  | "STRATEGY"
  | "SETUP"
  | "RULE"
  | "LESSON"
  | "EVENT"
  | "SYMBOL"
  | "NOTE";

export interface GaiaBlockRef {
  kind: GaiaRefKind;
  id: string;
  label?: string;
  meta?: string | null;
  href?: string | null;
}

export interface GaiaBlock {
  id: string;
  type: GaiaBlockType;
  text: string;
  checked?: boolean;
  tone?: GaiaCalloutTone;
  src?: string;
  alt?: string;
  caption?: string;
  rows?: string[][];
  ref?: GaiaBlockRef;
  /** Module 1 : enfants imbriqués (toggle, listes hiérarchiques). */
  children?: GaiaBlock[];
  /** Module 1 : colonnes (2–3 listes de blocs). */
  columns?: GaiaBlock[][];
  /** Module 1 : toggle replié. */
  collapsed?: boolean;
  /** Module 1 : groupe de blocs synchronisés. */
  syncId?: string;
  /** Module 1 : commentaires du bloc. */
  comments?: GaiaBlockComment[];
  /** Module 1 : tri + types de colonnes du tableau. */
  tableMeta?: GaiaTableMeta;
}

/** Module 1 — couverture de note : image (URL ou data URL) ou dégradé. */
export type GaiaCover = { kind: "image" | "gradient"; value: string };

export function parseGaiaCover(stored: string | null | undefined): GaiaCover | null {
  if (!stored) return null;
  try {
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== "object" || parsed === null) return null;
    const c = parsed as Record<string, unknown>;
    if ((c.kind === "image" || c.kind === "gradient") && typeof c.value === "string") {
      return { kind: c.kind, value: c.value };
    }
    return null;
  } catch {
    return null;
  }
}

/** Dégradés de couverture (palette Aurore, jamais d'image externe). */
export const GAIA_COVER_GRADIENTS: Array<{ id: string; css: string; label: string }> = [
  { id: "aurora", css: "linear-gradient(120deg, #FF6B5B 0%, #8B5CF6 55%, #22D3EE 100%)", label: "Aurora" },
  { id: "ember", css: "linear-gradient(120deg, #FF6B5B 0%, #F59E0B 100%)", label: "Ember" },
  { id: "lagoon", css: "linear-gradient(120deg, #0E7490 0%, #22D3EE 100%)", label: "Lagoon" },
  { id: "violet", css: "linear-gradient(120deg, #6D28D9 0%, #8B5CF6 60%, #EC4899 100%)", label: "Violet" },
  { id: "ink", css: "linear-gradient(120deg, #1F2937 0%, #0A0A12 100%)", label: "Ink" },
];

export interface GaiaLessonRef {
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
}

export interface GaiaNote {
  id: string;
  userId: string;
  title: string;
  icon: string | null;
  folderId: string | null;
  tagIds: string[];
  favorite: boolean;
  templateId: string | null;
  lessonRef: GaiaLessonRef | null;
  blocks: GaiaBlock[];
  /** Module 1 : couverture (JSON sérialisé, null = aucune). */
  cover: string | null;
  /** Module 1 : objectif d'écriture de la note (mots), null = aucun. */
  wordGoal: number | null;
  createdAt: string;
  updatedAt: string;
  lastViewedAt: string | null;
  deletedAt: string | null;
  // Phase 1 — Memory (Heat Memory System + spaced repetition).
  mastery: MasteryLevel;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  reviewCount: number;
  easeFactor: number;
  intervalDays: number;
}

export interface GaiaNoteRow {
  id: string;
  title: string;
  icon: string | null;
  folderId: string | null;
  folderName: string | null;
  tagIds: string[];
  tagNames: string[];
  favorite: boolean;
  templateId: string | null;
  lessonRef: GaiaLessonRef | null;
  excerpt: string;
  wordCount: number;
  blockCount: number;
  refCount: number;
  todoOpen: number;
  /** Module 1 : couverture (JSON sérialisé, null = aucune). */
  cover: string | null;
  /** Module 1 : objectif d'écriture de la note (mots), null = aucun. */
  wordGoal: number | null;
  createdAt: string;
  updatedAt: string;
  lastViewedAt: string | null;
  deletedAt: string | null;
  // Phase 1 — Memory (Heat Memory System + spaced repetition).
  mastery: MasteryLevel;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  reviewCount: number;
  easeFactor: number;
  intervalDays: number;
}

export interface GaiaFolder {
  id: string;
  name: string;
  createdAt: string;
  noteCount: number;
}

export interface GaiaTag {
  id: string;
  name: string;
  noteCount: number;
}

export interface GaiaTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  blocks: GaiaBlock[];
  builtIn: boolean;
  createdAt: string;
}

export interface GaiaActivityWeek {
  weekStart: string;
  created: number;
  edited: number;
}

export interface GaiaOverview {
  totals: {
    notes: number;
    createdThisWeek: number;
    favorites: number;
    folders: number;
    tags: number;
    trashed: number;
  };
  recentEdited: GaiaNoteRow[];
  recentViewed: GaiaNoteRow[];
  favorites: GaiaNoteRow[];
  folders: GaiaFolder[];
  topTags: GaiaTag[];
  activity: GaiaActivityWeek[];
  templates: GaiaTemplate[];
}

export interface GaiaVersion {
  id: string;
  title: string;
  savedAt: string;
  wordCount: number;
}

export interface GaiaRefHit {
  kind: GaiaRefKind;
  id: string;
  label: string;
  meta: string | null;
  href: string | null;
}

export type GaiaNotesView = "all" | "favorites" | "trash" | "folder" | "tag";

export type GaiaTab =
  | "overview"
  | "notes"
  | "folders"
  | "favorites"
  | "templates"
  | "trash"
  | "memory"
  | "graph";

export interface GaiaNotesParams {
  view: GaiaNotesView;
  folderId: string;
  tagId: string;
  q: string;
  sort: string;
  /** Rows per page (server default 50, max 100). */
  pageSize?: number;
  /** Phase 1 — Memory: filter by mastery level. */
  mastery?: string;
  /** Phase 1 — Memory: only notes due for review. */
  due?: boolean;
  /** Phase 2 — Temporal Kanban: filter by time bucket. */
  period?: TimePeriod;
}

export const GAIA_DEFAULT_PARAMS: GaiaNotesParams = {
  view: "all",
  folderId: "",
  tagId: "",
  q: "",
  sort: "updated",
  pageSize: 50,
};

export type GaiaT = (key: string) => string;

export function newBlockId(): string {
  return `nb-${Math.random().toString(36).slice(2, 10)}${Date.now()
    .toString(36)
    .slice(-4)}`;
}

export function gaiaErrorMessage(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return "Error";
}

// ── Ref kinds: icon + hue (Gaïa brand accents, never cobalt) ────

export const GAIA_REF_META: Record<
  GaiaRefKind,
  { labelKey: string; icon: LucideIcon; hue: string }
> = {
  TRADE: { labelKey: "gaia.refKinds.trade", icon: CandlestickChart, hue: "#FF6B5B" },
  STRATEGY: { labelKey: "gaia.refKinds.strategy", icon: Swords, hue: "#22D3EE" },
  SETUP: { labelKey: "gaia.refKinds.setup", icon: FlaskConical, hue: "#22D3EE" },
  RULE: { labelKey: "gaia.refKinds.rule", icon: ScrollText, hue: "#fb7185" },
  LESSON: { labelKey: "gaia.refKinds.lesson", icon: GraduationCap, hue: "#fbbf24" },
  EVENT: { labelKey: "gaia.refKinds.event", icon: Globe2, hue: "#f59e0b" },
  SYMBOL: { labelKey: "gaia.refKinds.symbol", icon: NotebookText, hue: "#22D3EE" },
  NOTE: { labelKey: "gaia.refKinds.note", icon: NotebookText, hue: "#22D3EE" },
};

export const GAIA_REF_KINDS: GaiaRefKind[] = [
  "TRADE",
  "STRATEGY",
  "SETUP",
  "RULE",
  "LESSON",
  "EVENT",
  "SYMBOL",
  "NOTE",
];

export function gaiaRefLabel(kind: GaiaRefKind, t: GaiaT): string {
  return t(GAIA_REF_META[kind].labelKey);
}

/** Only internal hrefs are ever linked (never raw HTML, XSS-safe by design).
 *  Legacy "#/..." hrefs stored in old notes are upgraded to clean URLs. */
export function safeGaiaHref(href: string | null | undefined): string | null {
  if (!href) return null;
  if (href.startsWith("#/")) return routeToPath(parseHash(href));
  if (href.startsWith("/")) return href;
  return null;
}

// ── Relative time ────────────────────────────────────────────────────────────

export function gaiaRelativeTime(
  iso: string | null | undefined,
  t: GaiaT,
): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 45) return t("gaia.time.justNow");
  const prefix = t("gaia.time.agoPrefix");
  const suffix = t("gaia.time.agoSuffix");
  const compose = (n: number, one: string, many: string) =>
    [prefix, String(n), n === 1 ? one : many, suffix]
      .filter((part) => part !== "")
      .join(" ");
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60)
    return compose(diffMin, t("gaia.time.minuteOne"), t("gaia.time.minuteMany"));
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24)
    return compose(diffHours, t("gaia.time.hourOne"), t("gaia.time.hourMany"));
  if (diffHours < 48) return t("gaia.time.yesterday");
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return compose(diffDays, t("gaia.time.days"), t("gaia.time.days"));
  return date.toLocaleDateString("en-CA");
}

// ── Small shared visuals ─────────────────────────────────────────────────────

export function TagChip({
  name,
  active,
  onClick,
  title,
}: {
  name: string;
  active?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  const cls = active
    ? "border-brand-coral/40 bg-brand-coral/10 text-brand-coral-deep dark:text-brand-coral"
    : "border-border bg-muted text-muted-foreground";
  const inner = (
    <span
      className={`inline-flex shrink-0 items-center rounded-sm border px-1.5 py-0.5 text-[11px] ${cls}`}
      title={title}
    >
      #{name}
    </span>
  );
  if (!onClick) return inner;
  return (
    <button type="button" onClick={onClick} className="shrink-0 transition-colors">
      {inner}
    </button>
  );
}

export function FolderChip({ name }: { name: string | null }) {
  if (!name) return null;
  return (
    <span className="inline-flex shrink-0 items-center rounded-sm border border-border bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
      {name}
    </span>
  );
}

// ── Phase 1 — Memory: mastery badge ────────────────────────────────────────
// Mastery scale, cold → warm on the monochrome base: grey (forgotten),
// cyan (fragile, medium), coral (mastered). The label is always text,
// never the color alone — a screen reader and a colorblind user get the
// same info.
export const MASTERY_META: Record<
  MasteryLevel,
  { dot: string; chip: string }
> = {
  forgotten: {
    dot: "bg-zinc-500",
    chip: "border-zinc-500/30 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  },
  fragile: {
    dot: "bg-brand-cyan/60",
    chip: "border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan-deep dark:text-brand-cyan/80",
  },
  medium: {
    dot: "bg-brand-cyan",
    chip: "border-brand-cyan/40 bg-brand-cyan/15 text-brand-cyan-deep dark:text-brand-cyan",
  },
  mastered: {
    dot: "bg-brand-coral",
    chip: "border-brand-coral/30 bg-brand-coral/10 text-brand-coral-deep dark:text-brand-coral",
  },
};

export function MasteryBadge({ mastery }: { mastery: MasteryLevel }) {
  const t = useTranslations();
  const meta = MASTERY_META[mastery];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] ${meta.chip}`}
    >
      <span className={`size-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
      {t(`gaia.memory.levels.${mastery}`)}
    </span>
  );
}

/**
 * Formatage riche inline — **gras**, *italique*, __souligné__, ~~barré~~,
 * ==surligné==, `code`, [#RRGGBB]couleur[/] — découpé en segments React,
 * jamais de HTML. (Module 1 : étendu depuis gras/italique/code.)
 */
export function InlineMarkdown({ text }: { text: string }) {
  const segments = parseInlineSegments(text);
  return (
    <>
      {segments.map((seg, i) => {
        let node: React.ReactNode = seg.text;
        if (seg.code) {
          node = (
            <code className="rounded-sm border bg-muted px-1 py-0.5 font-mono text-[0.85em]">
              {seg.text}
            </code>
          );
        } else {
          if (seg.bold) node = <strong className="font-semibold text-foreground">{node}</strong>;
          if (seg.italic) node = <em>{node}</em>;
          if (seg.underline) node = <u className="underline-offset-2">{node}</u>;
          if (seg.strike) node = <s className="opacity-80">{node}</s>;
          if (seg.highlight) {
            node = (
              <mark className="rounded-sm bg-amber-300/60 px-0.5 text-inherit dark:bg-amber-400/30">
                {node}
              </mark>
            );
          }
          if (seg.color) node = <span style={{ color: seg.color }}>{node}</span>;
        }
        return <React.Fragment key={i}>{node}</React.Fragment>;
      })}
    </>
  );
}

export function GaiaEmptyState({
  icon,
  title,
  body,
  action,
  testid,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
  testid?: string;
}) {
  return (
    <div
      data-testid={testid}
      className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center"
    >
      <div className="text-muted-foreground">{icon}</div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{body}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

// ── API layer (/api/v1/gaia/*) ──────────────────────────────────────────────────

const GAIA_BASE = "/api/v1/gaia";

function gaiaNotesQuery(params: GaiaNotesParams): string {
  const q = new URLSearchParams();
  q.set("view", params.view);
  if (params.view === "folder" && params.folderId) q.set("folderId", params.folderId);
  if (params.view === "tag" && params.tagId) q.set("tagId", params.tagId);
  if (params.q) q.set("q", params.q);
  if (params.sort && params.sort !== "updated") q.set("sort", params.sort);
  if (params.pageSize && params.pageSize !== 50) {
    q.set("pageSize", String(params.pageSize));
  }
  // Phase 1 — Memory filters.
  if (params.mastery) q.set("mastery", params.mastery);
  if (params.due === true) q.set("due", "true");
  // Phase 2 — Temporal Kanban filter.
  if (params.period) q.set("period", params.period);
  return q.toString();
}

export function useGaiaOverview() {
  return useQuery({
    queryKey: ["gaia", "overview"],
    queryFn: () => apiFetch<GaiaOverview>(`${GAIA_BASE}/overview`),
  });
}

// ── Phase 1 — Memory ────────────────────────────────────────────────────────

export interface GaiaMemoryHeatmapDay {
  date: string;
  reviews: number;
  created: number;
}

// ── Phase 2 — Timeline + journal (from GET /api/v1/gaia/memory/stats) ────

export interface GaiaMemoryTimelineNote {
  id: string;
  title: string;
  mastery: MasteryLevel;
  createdAt: string;
}

export interface GaiaMemoryTimelineMonth {
  /** Month key, YYYY-MM (UTC). */
  month: string;
  /** Total notes created that month (notes list capped at 20). */
  count: number;
  /** Newest first, max 20. */
  notes: GaiaMemoryTimelineNote[];
}

export interface GaiaMemoryJournal {
  today: {
    created: number;
    reviewed: number;
    dueRemaining: number;
    newlyMastered: number;
  };
  week: {
    created: number;
    reviewed: number;
  };
}

export interface GaiaMemoryStats {
  totalNotes: number;
  dueCount: number;
  countsByMastery: Record<MasteryLevel, number>;
  score: number | null;
  scoreParts: {
    avgMastery: number;
    dueClearance: number;
    streakFactor: number;
  };
  streakDays: number;
  heatmap: GaiaMemoryHeatmapDay[];
  /** Phase 2 — Timeline: months newest first, max 12 months. */
  timeline: GaiaMemoryTimelineMonth[];
  /** Phase 2 — Daily journal, computed on the fly (no new table). */
  journal: GaiaMemoryJournal;
}

// ── Phase 2 — Knowledge graph (from GET /api/v1/gaia/memory/graph) ───────

export interface GaiaMemoryGraphNode {
  id: string;
  title: string;
  mastery: MasteryLevel;
  folderId: string | null;
}

export interface GaiaMemoryGraphEdge {
  from: string;
  to: string;
  kind: "ref" | "tag";
  tagName?: string;
}

export interface GaiaMemoryGraph {
  nodes: GaiaMemoryGraphNode[];
  edges: GaiaMemoryGraphEdge[];
}

export function useGaiaMemoryGraph() {
  return useQuery({
    queryKey: ["gaia", "memory", "graph"],
    queryFn: () => apiFetch<GaiaMemoryGraph>(`${GAIA_BASE}/memory/graph`),
  });
}

export function useGaiaMemoryStats() {
  return useQuery({
    queryKey: ["gaia", "memory", "stats"],
    queryFn: () => apiFetch<GaiaMemoryStats>(`${GAIA_BASE}/memory/stats`),
  });
}

export function useReviewGaiaNote() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: ({ noteId, quality }: { noteId: string; quality: ReviewQuality }) =>
      apiFetch<{ note: GaiaNote; folderName: string | null; tagNames: string[] }>(
        `${GAIA_BASE}/notes/${noteId}/review`,
        { method: "POST", body: JSON.stringify({ quality }) },
      ),
    onSuccess: () => invalidate(),
  });
}

export function useMoveGaiaNoteToMastery() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: ({ noteId, mastery }: { noteId: string; mastery: MasteryLevel }) =>
      apiFetch<{ note: GaiaNote; folderName: string | null; tagNames: string[] }>(
        `${GAIA_BASE}/notes/${noteId}/mastery`,
        { method: "POST", body: JSON.stringify({ mastery }) },
      ),
    onSuccess: () => invalidate(),
  });
}

// ── Phase 2 — Temporal Kanban: reschedule a note into a time column.
//    Mastery, ease factor and review count are untouched.
export function useScheduleGaiaNote() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: ({ noteId, period }: { noteId: string; period: TimePeriod }) =>
      apiFetch<{ note: GaiaNote; folderName: string | null; tagNames: string[] }>(
        `${GAIA_BASE}/notes/${noteId}/schedule`,
        { method: "POST", body: JSON.stringify({ period }) },
      ),
    onSuccess: () => invalidate(),
  });
}

export function useGaiaNotes(params: GaiaNotesParams) {
  return useQuery({
    queryKey: ["gaia", "notes", params],
    queryFn: () =>
      apiFetch<{ notes: GaiaNoteRow[]; total: number }>(
        `${GAIA_BASE}/notes?${gaiaNotesQuery(params)}`,
      ),
  });
}

export function useGaiaNote(noteId: string | null) {
  return useQuery({
    queryKey: ["gaia", "note", noteId],
    queryFn: () =>
      apiFetch<{ note: GaiaNote; folderName: string | null; tagNames: string[] }>(
        `${GAIA_BASE}/notes/${noteId}`,
      ),
    enabled: noteId !== null && noteId !== "",
  });
}

export function useGaiaFolders() {
  return useQuery({
    queryKey: ["gaia", "folders"],
    queryFn: () => apiFetch<{ folders: GaiaFolder[] }>(`${GAIA_BASE}/folders`),
  });
}

export function useGaiaTags() {
  return useQuery({
    queryKey: ["gaia", "tags"],
    queryFn: () => apiFetch<{ tags: GaiaTag[] }>(`${GAIA_BASE}/tags`),
  });
}

export function useGaiaTemplates() {
  return useQuery({
    queryKey: ["gaia", "templates"],
    queryFn: () => apiFetch<{ templates: GaiaTemplate[] }>(`${GAIA_BASE}/templates`),
  });
}

export function useGaiaVersions(noteId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["gaia", "versions", noteId],
    queryFn: () =>
      apiFetch<{ versions: GaiaVersion[] }>(`${GAIA_BASE}/notes/${noteId}/versions`),
    enabled: enabled && noteId !== null && noteId !== "",
  });
}

export function useGaiaRefs(query: string, kind: GaiaRefKind | "", enabled = true) {
  return useQuery({
    queryKey: ["gaia", "refs", query, kind],
    enabled,
    queryFn: () => {
      const q = new URLSearchParams();
      if (query) q.set("q", query);
      if (kind) q.set("kind", kind);
      const suffix = q.toString();
      return apiFetch<{ refs: GaiaRefHit[] }>(
        `${GAIA_BASE}/refs${suffix ? `?${suffix}` : ""}`,
      );
    },
  });
}

export function useGaiaLinkedNotes(kind: GaiaRefKind, id: string) {
  return useQuery({
    queryKey: ["gaia", "notes", "linked", kind, id],
    queryFn: () =>
      apiFetch<{ notes: GaiaNoteRow[]; total: number }>(
        `${GAIA_BASE}/notes?refKind=${kind}&refId=${encodeURIComponent(id)}`,
      ),
    enabled: id !== "",
  });
}

function useGaiaInvalidate() {
  const qc = useQueryClient();
  return React.useCallback(
    () => qc.invalidateQueries({ queryKey: ["gaia"] }),
    [qc],
  );
}

export interface GaiaNoteCreateInput {
  title?: string;
  folderId?: string | null;
  templateId?: string;
  lessonRef?: GaiaLessonRef;
  blocks?: GaiaBlock[];
}

export interface GaiaNoteUpdateInput {
  title?: string;
  icon?: string | null;
  folderId?: string | null;
  tagIds?: string[];
  favorite?: boolean;
  blocks?: GaiaBlock[];
  /** Module 1 : couverture (JSON sérialisé, null = retirer). */
  cover?: string | null;
  /** Module 1 : objectif d'écriture (mots), null = retirer. */
  wordGoal?: number | null;
}

export function useCreateGaiaNote() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: (input: GaiaNoteCreateInput) =>
      apiFetch<{ note: GaiaNote }>(`${GAIA_BASE}/notes`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateGaiaNote() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: ({ noteId, patch }: { noteId: string; patch: GaiaNoteUpdateInput }) =>
      apiFetch<{ note: GaiaNote; folderName: string | null; tagNames: string[] }>(
        `${GAIA_BASE}/notes/${noteId}`,
        { method: "PATCH", body: JSON.stringify(patch) },
      ),
    onSuccess: () => invalidate(),
  });
}

export function useTrashGaiaNote() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: (noteId: string) =>
      apiFetch<{ ok: boolean }>(`${GAIA_BASE}/notes/${noteId}`, { method: "DELETE" }),
    onSuccess: () => invalidate(),
  });
}

export function useDuplicateGaiaNote() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: ({ noteId, title }: { noteId: string; title?: string }) =>
      apiFetch<{ note: GaiaNote }>(`${GAIA_BASE}/notes/${noteId}/duplicate`, {
        method: "POST",
        body: JSON.stringify(title ? { title } : {}),
      }),
    onSuccess: () => invalidate(),
  });
}

export function useRestoreGaiaNote() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: (noteId: string) =>
      apiFetch<{ ok: boolean }>(`${GAIA_BASE}/notes/${noteId}/restore`, {
        method: "POST",
      }),
    onSuccess: () => invalidate(),
  });
}

export function usePurgeGaiaNote() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: (noteId: string) =>
      apiFetch<{ ok: boolean }>(`${GAIA_BASE}/notes/${noteId}/permanent`, {
        method: "DELETE",
      }),
    onSuccess: () => invalidate(),
  });
}

export function useCreateGaiaFolder() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<GaiaFolder>(`${GAIA_BASE}/folders`, {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateGaiaFolder() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: ({ folderId, name }: { folderId: string; name: string }) =>
      apiFetch<GaiaFolder>(`${GAIA_BASE}/folders/${folderId}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteGaiaFolder() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: (folderId: string) =>
      apiFetch<{ ok: boolean }>(`${GAIA_BASE}/folders/${folderId}`, {
        method: "DELETE",
      }),
    onSuccess: () => invalidate(),
  });
}

export function useCreateGaiaTag() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<GaiaTag>(`${GAIA_BASE}/tags`, {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => invalidate(),
  });
}

export function useCreateGaiaTemplate() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: (input: {
      name: string;
      description: string;
      icon: string;
      fromNoteId?: string;
      blocks?: GaiaBlock[];
    }) =>
      apiFetch<GaiaTemplate>(`${GAIA_BASE}/templates`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidate(),
  });
}

export function useInstantiateGaiaTemplate() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: (input: { templateId: string; title?: string; folderId?: string | null }) =>
      apiFetch<{ note: GaiaNote }>(`${GAIA_BASE}/templates/instantiate`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidate(),
  });
}

export function useRestoreGaiaVersion() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: ({ noteId, versionId }: { noteId: string; versionId: string }) =>
      apiFetch<{ note: GaiaNote }>(
        `${GAIA_BASE}/notes/${noteId}/versions/${versionId}/restore`,
        { method: "POST" },
      ),
    onSuccess: () => invalidate(),
  });
}

// ── Module 1 — Objectifs d'écriture (E12) ───────────────────────────────────

export interface GaiaSettings {
  dailyWordGoal: number;
}

export interface GaiaTodayWords {
  wordsToday: number;
  notesTouchedToday: number;
  date: string;
}

export function useGaiaSettings() {
  return useQuery({
    queryKey: ["gaia", "settings"],
    queryFn: () => apiFetch<GaiaSettings>(`${GAIA_BASE}/settings`),
  });
}

export function useUpdateGaiaSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { dailyWordGoal: number }) =>
      apiFetch<GaiaSettings>(`${GAIA_BASE}/settings`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => qc.setQueryData(["gaia", "settings"], data),
  });
}

export function useGaiaTodayWords() {
  return useQuery({
    queryKey: ["gaia", "writing", "today"],
    queryFn: () => apiFetch<GaiaTodayWords>(`${GAIA_BASE}/writing/today`),
  });
}
