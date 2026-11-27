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
  | "synced"
  // Module 3 — File & Document Management.
  | "file";

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
  /** Module 3 : id du GaiaFile référencé (bloc `file`). */
  fileId?: string;
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
  /** Module 2 (K13) : propriétés personnalisées. */
  properties: GaiaNoteProperty[];
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
  /** Module 2 (K13) : propriétés personnalisées. */
  properties: GaiaNoteProperty[];
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
  /** Module 2 (K05) : dossier parent, null = racine. */
  parentId: string | null;
  createdAt: string;
  noteCount: number;
}

export interface GaiaTag {
  id: string;
  name: string;
  /** Module 2 (K07) : tag parent, null = racine. */
  parentId: string | null;
  /** Module 2 (K07) : ids des tags liés (synonymes, tags associés). */
  relatedIds: string[];
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
  | "graph"
  | "knowledge"
  | "canvas"
  | "inbox"
  | "files";

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
  /** Module 2 (K06) : filtrer par une collection dynamique. */
  collectionId?: string;
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
  // Module 2 (K06) — collection dynamique.
  if (params.collectionId) q.set("collectionId", params.collectionId);
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
  /** Module 2 (K15) : aucune arête ne touche cette note. */
  orphan: boolean;
}

export interface GaiaMemoryGraphEdge {
  from: string;
  to: string;
  kind: "ref" | "tag" | "relation";
  tagName?: string;
  /** Module 2 (K08) : libellé de la relation. */
  label?: string;
}

export interface GaiaMemoryGraph {
  nodes: GaiaMemoryGraphNode[];
  edges: GaiaMemoryGraphEdge[];
  /** Module 2 (K08) : libellés de relations distincts. */
  relationTypes: string[];
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
  /** Module 2 (K13) : propriétés personnalisées (remplace la liste). */
  properties?: GaiaNoteProperty[];
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
    mutationFn: (input: { name: string; parentId?: string | null }) =>
      apiFetch<GaiaFolder>(`${GAIA_BASE}/folders`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateGaiaFolder() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: ({
      folderId,
      name,
      parentId,
    }: {
      folderId: string;
      name: string;
      parentId?: string | null;
    }) =>
      apiFetch<GaiaFolder>(`${GAIA_BASE}/folders/${folderId}`, {
        method: "PATCH",
        body: JSON.stringify(
          parentId === undefined ? { name } : { name, parentId },
        ),
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
    mutationFn: (input: { name: string; parentId?: string | null; relatedIds?: string[] }) =>
      apiFetch<GaiaTag>(`${GAIA_BASE}/tags`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateGaiaTag() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: ({
      tagId,
      name,
      parentId,
      relatedIds,
    }: {
      tagId: string;
      name?: string;
      parentId?: string | null;
      relatedIds?: string[];
    }) =>
      apiFetch<GaiaTag>(`${GAIA_BASE}/tags/${tagId}`, {
        method: "PATCH",
        body: JSON.stringify({ name, parentId, relatedIds }),
      }),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteGaiaTag() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: (tagId: string) =>
      apiFetch<{ ok: boolean }>(`${GAIA_BASE}/tags/${tagId}`, { method: "DELETE" }),
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

// ── Module 2 — Knowledge Management System (K01–K17) ────────────────────

export type GaiaNotePropertyType = "text" | "number" | "date" | "checkbox" | "select";

export interface GaiaNoteProperty {
  key: string;
  value: string;
  type: GaiaNotePropertyType;
  options?: string[];
}

export interface GaiaNoteRelation {
  id: string;
  fromNoteId: string;
  toNoteId: string;
  type: string;
  direction: "outgoing" | "incoming";
  otherNoteId: string;
  otherTitle: string;
  createdAt: string;
}

export interface GaiaNoteLinkItem {
  id: string;
  title: string;
  via: "ref" | "relation";
  relationType?: string;
}

export interface GaiaUnlinkedMention {
  id: string;
  title: string;
  snippet: string;
}

export interface GaiaNoteLinks {
  outgoing: GaiaNoteLinkItem[];
  backlinks: GaiaNoteRow[];
  unlinkedMentions: GaiaUnlinkedMention[];
  relations: GaiaNoteRelation[];
}

export interface GaiaLinkSuggestion {
  id: string;
  title: string;
  score: number;
  sharedWords: string[];
}

export interface GaiaCollectionCriteria {
  folderId?: string | null;
  tagIds?: string[];
  mastery?: string;
  favorite?: boolean;
  q?: string;
  properties?: Array<{ key: string; value: string }>;
}

export interface GaiaSmartCollection {
  id: string;
  name: string;
  icon: string;
  criteria: GaiaCollectionCriteria;
  noteCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GaiaCanvasItem {
  noteId: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
}

export interface GaiaCanvas {
  id: string;
  name: string;
  items: GaiaCanvasItem[];
  createdAt: string;
  updatedAt: string;
}

export interface GaiaInboxItem {
  id: string;
  text: string;
  doneAt: string | null;
  noteId: string | null;
  createdAt: string;
}

export interface GaiaKnowledgeTimelineMonth {
  month: string;
  created: number;
  edited: number;
  relations: number;
  notes: Array<{ id: string; title: string; mastery: MasteryLevel; createdAt: string }>;
}

export function useGaiaNoteLinks(noteId: string | null) {
  return useQuery({
    queryKey: ["gaia", "notes", noteId, "links"],
    queryFn: () =>
      apiFetch<GaiaNoteLinks>(`${GAIA_BASE}/notes/${noteId}/links`),
    enabled: noteId !== null && noteId !== "",
  });
}

export function useGaiaLinkSuggestions(noteId: string | null) {
  return useQuery({
    queryKey: ["gaia", "notes", noteId, "suggestions"],
    queryFn: () =>
      apiFetch<{ suggestions: GaiaLinkSuggestion[] }>(
        `${GAIA_BASE}/notes/${noteId}/suggestions`,
      ),
    enabled: noteId !== null && noteId !== "",
  });
}

export function useCreateGaiaRelation() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: ({ noteId, toNoteId, type }: { noteId: string; toNoteId: string; type: string }) =>
      apiFetch<{ relation: GaiaNoteRelation }>(`${GAIA_BASE}/notes/${noteId}/relations`, {
        method: "POST",
        body: JSON.stringify({ toNoteId, type }),
      }),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteGaiaRelation() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: ({ noteId, relationId }: { noteId: string; relationId: string }) =>
      apiFetch<{ ok: boolean }>(`${GAIA_BASE}/notes/${noteId}/relations/${relationId}`, {
        method: "DELETE",
      }),
    onSuccess: () => invalidate(),
  });
}

export function useGaiaOrphans() {
  return useQuery({
    queryKey: ["gaia", "knowledge", "orphans"],
    queryFn: () =>
      apiFetch<{ notes: GaiaNoteRow[]; total: number }>(
        `${GAIA_BASE}/knowledge/orphans`,
      ),
  });
}

export function useGaiaKnowledgeTimeline() {
  return useQuery({
    queryKey: ["gaia", "knowledge", "timeline"],
    queryFn: () =>
      apiFetch<{ months: GaiaKnowledgeTimelineMonth[] }>(
        `${GAIA_BASE}/knowledge/timeline`,
      ),
  });
}

export function useGaiaCollections() {
  return useQuery({
    queryKey: ["gaia", "collections"],
    queryFn: () =>
      apiFetch<{ collections: GaiaSmartCollection[] }>(`${GAIA_BASE}/collections`),
  });
}

export function useCreateGaiaCollection() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: (input: { name: string; icon?: string; criteria: GaiaCollectionCriteria }) =>
      apiFetch<{ collection: GaiaSmartCollection }>(`${GAIA_BASE}/collections`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateGaiaCollection() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: ({
      collectionId,
      name,
      icon,
      criteria,
    }: {
      collectionId: string;
      name: string;
      icon?: string;
      criteria: GaiaCollectionCriteria;
    }) =>
      apiFetch<{ collection: GaiaSmartCollection }>(
        `${GAIA_BASE}/collections/${collectionId}`,
        { method: "PATCH", body: JSON.stringify({ name, icon, criteria }) },
      ),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteGaiaCollection() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: (collectionId: string) =>
      apiFetch<{ ok: boolean }>(`${GAIA_BASE}/collections/${collectionId}`, {
        method: "DELETE",
      }),
    onSuccess: () => invalidate(),
  });
}

export function useGaiaCanvases() {
  return useQuery({
    queryKey: ["gaia", "canvases"],
    queryFn: () =>
      apiFetch<{ canvases: GaiaCanvas[] }>(`${GAIA_BASE}/canvases`),
  });
}

export function useGaiaCanvas(canvasId: string | null) {
  return useQuery({
    queryKey: ["gaia", "canvases", canvasId],
    queryFn: () =>
      apiFetch<{ canvas: GaiaCanvas }>(`${GAIA_BASE}/canvases/${canvasId}`),
    enabled: canvasId !== null && canvasId !== "",
  });
}

export function useCreateGaiaCanvas() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: (input: { name: string; items?: GaiaCanvasItem[] }) =>
      apiFetch<{ canvas: GaiaCanvas }>(`${GAIA_BASE}/canvases`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateGaiaCanvas() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: ({
      canvasId,
      name,
      items,
    }: {
      canvasId: string;
      name: string;
      items?: GaiaCanvasItem[];
    }) =>
      apiFetch<{ canvas: GaiaCanvas }>(`${GAIA_BASE}/canvases/${canvasId}`, {
        method: "PATCH",
        body: JSON.stringify(items === undefined ? { name } : { name, items }),
      }),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteGaiaCanvas() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: (canvasId: string) =>
      apiFetch<{ ok: boolean }>(`${GAIA_BASE}/canvases/${canvasId}`, {
        method: "DELETE",
      }),
    onSuccess: () => invalidate(),
  });
}

export function useGaiaInbox() {
  return useQuery({
    queryKey: ["gaia", "inbox"],
    queryFn: () =>
      apiFetch<{ open: GaiaInboxItem[]; done: GaiaInboxItem[] }>(
        `${GAIA_BASE}/inbox`,
      ),
  });
}

export function useCreateGaiaInboxItem() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: (text: string) =>
      apiFetch<{ item: GaiaInboxItem }>(`${GAIA_BASE}/inbox`, {
        method: "POST",
        body: JSON.stringify({ text }),
      }),
    onSuccess: () => invalidate(),
  });
}

export function useToggleGaiaInboxItem() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: ({ itemId, done }: { itemId: string; done: boolean }) =>
      apiFetch<{ item: GaiaInboxItem }>(`${GAIA_BASE}/inbox/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ done }),
      }),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteGaiaInboxItem() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: (itemId: string) =>
      apiFetch<{ ok: boolean }>(`${GAIA_BASE}/inbox/${itemId}`, {
        method: "DELETE",
      }),
    onSuccess: () => invalidate(),
  });
}

export function useConvertGaiaInboxItem() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: (itemId: string) =>
      apiFetch<{ note: GaiaNote; item: GaiaInboxItem }>(
        `${GAIA_BASE}/inbox/${itemId}/convert`,
        { method: "POST" },
      ),
    onSuccess: () => invalidate(),
  });
}

export function useCreateGaiaDailyNote() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ note: GaiaNote }>(`${GAIA_BASE}/notes/daily`, {
        method: "POST",
      }),
    onSuccess: () => invalidate(),
  });
}

export function useCreateGaiaWeeklyNote() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ note: GaiaNote }>(`${GAIA_BASE}/notes/weekly`, {
        method: "POST",
      }),
    onSuccess: () => invalidate(),
  });
}

// ── Module 3 — File & Document Management (F01–F15) ─────────────────────

export type { GaiaFileKind } from "@/lib/gaia/files";

export interface GaiaFileDTO {
  id: string;
  name: string;
  mimeType: string;
  kind: import("@/lib/gaia/files").GaiaFileKind;
  size: number;
  folderId: string | null;
  folderName: string | null;
  hasText: boolean;
  versionCount: number;
  noteCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GaiaFileVersionDTO {
  version: number;
  size: number;
  createdAt: string;
  current: boolean;
}

export interface GaiaFileAnnotationDTO {
  id: string;
  fileId: string;
  page: number;
  x: number;
  y: number;
  width: number | null;
  height: number | null;
  type: string;
  text: string;
  color: string;
  createdAt: string;
}

export interface GaiaFileDetailDTO extends GaiaFileDTO {
  ocrText: string;
  versions: GaiaFileVersionDTO[];
  annotations: GaiaFileAnnotationDTO[];
  notes: Array<{ id: string; title: string; updatedAt: string }>;
}

export interface GaiaStorageUsageDTO {
  totalBytes: number;
  quotaBytes: number;
  fileCount: number;
  byKind: Array<{ kind: import("@/lib/gaia/files").GaiaFileKind; count: number; bytes: number }>;
  largest: Array<{ id: string; name: string; size: number; mimeType: string }>;
}

export interface GaiaFilesParams {
  q?: string;
  folderId?: string;
  kind?: import("@/lib/gaia/files").GaiaFileKind;
  sort?: "newest" | "name" | "size";
}

/** URL de téléchargement / aperçu d'un fichier (proxy API, session requise). */
export function gaiaFileDownloadUrl(fileId: string, download = false): string {
  return `${GAIA_BASE}/files/${fileId}/download${download ? "?download=1" : ""}`;
}

/** Upload multipart : apiFetch force le JSON, on passe par fetch directement. */
async function uploadForm<T>(url: string, form: FormData): Promise<T> {
  const res = await fetch(url, { method: "POST", body: form });
  if (res.status === 204) return undefined as T;
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const errBody =
      body && typeof body === "object" && "error" in body
        ? (body as { error: string; message: string })
        : { error: "NETWORK", message: "Invalid server response." };
    throw new ApiClientError(errBody, res.status);
  }
  return body as T;
}

export function useGaiaFiles(params: GaiaFilesParams = {}) {
  const key = ["gaia", "files", params.q ?? "", params.folderId ?? "", params.kind ?? "", params.sort ?? "newest"];
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.folderId) search.set("folderId", params.folderId);
  if (params.kind) search.set("kind", params.kind);
  if (params.sort) search.set("sort", params.sort);
  const qs = search.toString();
  return useQuery({
    queryKey: key,
    queryFn: () =>
      apiFetch<{ files: GaiaFileDTO[]; total: number }>(
        `${GAIA_BASE}/files${qs === "" ? "" : `?${qs}`}`,
      ),
  });
}

export function useGaiaFile(fileId: string | null) {
  return useQuery({
    queryKey: ["gaia", "files", fileId],
    queryFn: () => apiFetch<{ file: GaiaFileDetailDTO }>(`${GAIA_BASE}/files/${fileId}`),
    enabled: fileId !== null && fileId !== "",
  });
}

export function useGaiaStorageUsage() {
  return useQuery({
    queryKey: ["gaia", "files", "storage"],
    queryFn: () => apiFetch<{ usage: GaiaStorageUsageDTO }>(`${GAIA_BASE}/files/storage`),
  });
}

export function useUploadGaiaFile() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: ({ file, folderId }: { file: File; folderId?: string | null }) => {
      const form = new FormData();
      form.append("file", file);
      if (folderId) form.append("folderId", folderId);
      return uploadForm<{ file: GaiaFileDTO }>(`${GAIA_BASE}/files`, form);
    },
    onSuccess: () => invalidate(),
  });
}

export function useReplaceGaiaFile() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: ({ fileId, file }: { fileId: string; file: File }) => {
      const form = new FormData();
      form.append("file", file);
      return uploadForm<{ file: GaiaFileDTO }>(`${GAIA_BASE}/files/${fileId}/versions`, form);
    },
    onSuccess: () => invalidate(),
  });
}

export function useUpdateGaiaFile() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: ({ fileId, name, folderId }: { fileId: string; name?: string; folderId?: string | null }) =>
      apiFetch<{ file: GaiaFileDTO }>(`${GAIA_BASE}/files/${fileId}`, {
        method: "PATCH",
        body: JSON.stringify({ ...(name !== undefined ? { name } : {}), ...(folderId !== undefined ? { folderId } : {}) }),
      }),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteGaiaFile() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: (fileId: string) =>
      apiFetch<{ ok: boolean }>(`${GAIA_BASE}/files/${fileId}`, { method: "DELETE" }),
    onSuccess: () => invalidate(),
  });
}

export function useRestoreGaiaFileVersion() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: ({ fileId, version }: { fileId: string; version: number }) =>
      apiFetch<{ file: GaiaFileDTO }>(`${GAIA_BASE}/files/${fileId}/restore`, {
        method: "POST",
        body: JSON.stringify({ version }),
      }),
    onSuccess: () => invalidate(),
  });
}

export function useSaveGaiaFileText() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: ({ fileId, text, source }: { fileId: string; text: string; source: "pdf" | "ocr" }) =>
      apiFetch<{ file: GaiaFileDTO }>(`${GAIA_BASE}/files/${fileId}/text`, {
        method: "POST",
        body: JSON.stringify({ text, source }),
      }),
    onSuccess: () => invalidate(),
  });
}

export function useCreateGaiaFileAnnotation() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: ({
      fileId,
      page,
      x,
      y,
      width,
      height,
      type,
      text,
      color,
    }: {
      fileId: string;
      page: number;
      x: number;
      y: number;
      width?: number | null;
      height?: number | null;
      type: "note" | "highlight";
      text?: string;
      color?: string;
    }) =>
      apiFetch<{ annotation: GaiaFileAnnotationDTO }>(`${GAIA_BASE}/files/${fileId}/annotations`, {
        method: "POST",
        body: JSON.stringify({ page, x, y, width, height, type, text, color }),
      }),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteGaiaFileAnnotation() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: ({ fileId, annotationId }: { fileId: string; annotationId: string }) =>
      apiFetch<{ ok: boolean }>(`${GAIA_BASE}/files/${fileId}/annotations/${annotationId}`, {
        method: "DELETE",
      }),
    onSuccess: () => invalidate(),
  });
}

export function useGaiaNoteFiles(noteId: string | null) {
  return useQuery({
    queryKey: ["gaia", "notes", noteId, "files"],
    queryFn: () => apiFetch<{ files: GaiaFileDTO[] }>(`${GAIA_BASE}/notes/${noteId}/files`),
    enabled: noteId !== null && noteId !== "",
  });
}

export function useAttachGaiaFile() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: ({ noteId, fileId }: { noteId: string; fileId: string }) =>
      apiFetch<{ ok: boolean }>(`${GAIA_BASE}/notes/${noteId}/files`, {
        method: "POST",
        body: JSON.stringify({ fileId }),
      }),
    onSuccess: () => invalidate(),
  });
}

export function useDetachGaiaFile() {
  const invalidate = useGaiaInvalidate();
  return useMutation({
    mutationFn: ({ noteId, fileId }: { noteId: string; fileId: string }) =>
      apiFetch<{ ok: boolean }>(`${GAIA_BASE}/notes/${noteId}/files/${fileId}`, {
        method: "DELETE",
      }),
    onSuccess: () => invalidate(),
  });
}

export function useGaiaFileNotes(fileId: string | null) {
  return useQuery({
    queryKey: ["gaia", "files", fileId, "notes"],
    queryFn: () =>
      apiFetch<{ notes: Array<{ id: string; title: string; updatedAt: string }> }>(
        `${GAIA_BASE}/files/${fileId}/notes`,
      ),
    enabled: fileId !== null && fileId !== "",
  });
}
