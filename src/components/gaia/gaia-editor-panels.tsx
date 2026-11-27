"use client";

/**
 * Gaïa — Module 1 : panneaux de l'éditeur avancé.
 *
 * Barre de formatage, sommaire, statistiques + objectifs, couverture,
 * barre de sélection multiple, déplacement vers une note, commandes slash
 * personnalisées. Tous pilotés par l'éditeur (gaia-editor.tsx).
 */
import * as React from "react";
import {
  Bold,
  Code2,
  CopyPlus,
  Copy,
  Eraser,
  Highlighter,
  ImagePlus,
  Italic,
  ListTree,
  MoveRight,
  PaintBucket,
  Strikethrough,
  Trash2,
  Underline,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  GAIA_COVER_GRADIENTS,
  parseGaiaCover,
  useGaiaNotes,
  GAIA_DEFAULT_PARAMS,
  type GaiaBlockType,
  type GaiaCover,
  type GaiaT,
} from "./gaia-shared";
import type { GaiaCustomSlashCommand } from "./gaia-blocks";

// ── Barre de formatage (E01/E02) ────────────────────────────────────────────

export type FormatKind =
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "highlight"
  | "code"
  | "clear"
  | `color:${string}`;

export const FORMAT_COLORS = ["#FF6B5B", "#22D3EE", "#8B5CF6", "#F59E0B", "#84CC16"];

export function FormatToolbar({
  onFormat,
  disabled,
  t,
}: {
  onFormat: (kind: FormatKind) => void;
  disabled: boolean;
  t: GaiaT;
}) {
  const btn =
    "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40";
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();
  return (
    <div
      data-testid="gaia-format-toolbar"
      className="flex flex-wrap items-center gap-0.5 rounded-lg border bg-card px-1.5 py-1"
      aria-label={t("gaia.editor.formatToolbarLabel")}
    >
      <button type="button" disabled={disabled} onMouseDown={keepFocus} onClick={() => onFormat("bold")} aria-label={t("gaia.format.bold")} title={t("gaia.format.bold")} className={btn}>
        <Bold className="size-3.5" aria-hidden="true" />
      </button>
      <button type="button" disabled={disabled} onMouseDown={keepFocus} onClick={() => onFormat("italic")} aria-label={t("gaia.format.italic")} title={t("gaia.format.italic")} className={btn}>
        <Italic className="size-3.5" aria-hidden="true" />
      </button>
      <button type="button" disabled={disabled} onMouseDown={keepFocus} onClick={() => onFormat("underline")} aria-label={t("gaia.format.underline")} title={t("gaia.format.underline")} className={btn}>
        <Underline className="size-3.5" aria-hidden="true" />
      </button>
      <button type="button" disabled={disabled} onMouseDown={keepFocus} onClick={() => onFormat("strike")} aria-label={t("gaia.format.strike")} title={t("gaia.format.strike")} className={btn}>
        <Strikethrough className="size-3.5" aria-hidden="true" />
      </button>
      <button type="button" disabled={disabled} onMouseDown={keepFocus} onClick={() => onFormat("highlight")} aria-label={t("gaia.format.highlight")} title={t("gaia.format.highlight")} className={btn}>
        <Highlighter className="size-3.5" aria-hidden="true" />
      </button>
      <button type="button" disabled={disabled} onMouseDown={keepFocus} onClick={() => onFormat("code")} aria-label={t("gaia.format.code")} title={t("gaia.format.code")} className={btn}>
        <Code2 className="size-3.5" aria-hidden="true" />
      </button>
      <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
      {FORMAT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          disabled={disabled}
          onMouseDown={keepFocus}
          onClick={() => onFormat(`color:${c}`)}
          aria-label={`${t("gaia.format.color")} ${c}`}
          title={`${t("gaia.format.color")} ${c}`}
          className="size-6 rounded-full border disabled:opacity-40"
          style={{ background: c }}
        />
      ))}
      <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
      <button type="button" disabled={disabled} onMouseDown={keepFocus} onClick={() => onFormat("clear")} aria-label={t("gaia.format.clear")} title={t("gaia.format.clear")} className={btn}>
        <Eraser className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

// ── Sommaire (E10) ───────────────────────────────────────────────────────────

export function OutlinePanel({
  headings,
  onNavigate,
  onClose,
  t,
}: {
  headings: Array<{ id: string; level: 1 | 2 | 3; text: string }>;
  onNavigate: (blockId: string) => void;
  onClose: () => void;
  t: GaiaT;
}) {
  return (
    <aside
      data-testid="gaia-outline"
      className="sticky top-4 hidden w-56 shrink-0 self-start rounded-xl border bg-card p-3 lg:block"
      aria-label={t("gaia.outline.title")}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold">
          <ListTree className="size-3.5 text-brand-cyan" aria-hidden="true" />
          {t("gaia.outline.title")}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          className="rounded p-0.5 text-muted-foreground hover:bg-muted"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>
      {headings.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("gaia.outline.empty")}</p>
      ) : (
        <ul className="space-y-0.5">
          {headings.map((h) => (
            <li key={h.id} style={{ paddingLeft: `${(h.level - 1) * 12}px` }}>
              <button
                type="button"
                onClick={() => onNavigate(h.id)}
                className={`block w-full truncate rounded-sm px-1.5 py-1 text-left text-[13px] hover:bg-muted ${
                  h.level === 1 ? "font-semibold" : "text-muted-foreground"
                }`}
              >
                {h.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

// ── Statistiques + objectifs (E11/E12) ───────────────────────────────────────

export interface EditorStats {
  words: number;
  chars: number;
  paragraphs: number;
  headings: number;
  todosOpen: number;
  todosTotal: number;
  readingMinutes: number;
}

export function StatsPopover({
  stats,
  wordGoal,
  onWordGoalChange,
  dailyGoal,
  wordsToday,
  onDailyGoalChange,
  t,
}: {
  stats: EditorStats;
  wordGoal: number | null;
  onWordGoalChange: (goal: number | null) => void;
  dailyGoal: number;
  wordsToday: number;
  onDailyGoalChange: (goal: number) => void;
  t: GaiaT;
}) {
  const [noteGoalInput, setNoteGoalInput] = React.useState(
    wordGoal === null ? "" : String(wordGoal),
  );
  const [dailyInput, setDailyInput] = React.useState(dailyGoal === 0 ? "" : String(dailyGoal));
  React.useEffect(() => setNoteGoalInput(wordGoal === null ? "" : String(wordGoal)), [wordGoal]);
  React.useEffect(() => setDailyInput(dailyGoal === 0 ? "" : String(dailyGoal)), [dailyGoal]);

  const notePct =
    wordGoal !== null && wordGoal > 0 ? Math.min(100, Math.round((stats.words / wordGoal) * 100)) : null;
  const dailyPct =
    dailyGoal > 0 ? Math.min(100, Math.round((wordsToday / dailyGoal) * 100)) : null;

  const rows: Array<[string, string]> = [
    [t("gaia.stats.words"), String(stats.words)],
    [t("gaia.stats.chars"), String(stats.chars)],
    [t("gaia.stats.paragraphs"), String(stats.paragraphs)],
    [t("gaia.stats.headings"), String(stats.headings)],
    [t("gaia.stats.todos"), `${stats.todosOpen} / ${stats.todosTotal}`],
    [t("gaia.stats.readingTime"), `${stats.readingMinutes} ${t("gaia.stats.minutesShort")}`],
  ];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="gaia-stats-button"
          className="rounded-md px-1.5 py-0.5 font-mono tabular-nums hover:bg-muted"
          aria-label={t("gaia.stats.title")}
          title={t("gaia.stats.title")}
        >
          {stats.words} {stats.words === 1 ? t("gaia.shared.wordOne") : t("gaia.shared.wordMany")}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <p className="mb-2 text-xs font-semibold">{t("gaia.stats.title")}</p>
        <dl className="space-y-1">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between text-xs">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-mono tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 border-t pt-3">
          <label className="text-xs font-medium" htmlFor="gaia-note-goal">
            {t("gaia.goals.noteGoal")}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <Input
              id="gaia-note-goal"
              value={noteGoalInput}
              inputMode="numeric"
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, "");
                setNoteGoalInput(v);
                onWordGoalChange(v === "" ? null : Number(v));
              }}
              placeholder={t("gaia.goals.noteGoalPlaceholder")}
              className="h-8 text-xs"
            />
            <span className="shrink-0 text-xs text-muted-foreground">{t("gaia.stats.words")}</span>
          </div>
          {notePct !== null ? (
            <div className="mt-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-brand-cyan transition-all"
                  style={{ width: `${notePct}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {stats.words} / {wordGoal} ({notePct}%)
              </p>
            </div>
          ) : null}
        </div>
        <div className="mt-3 border-t pt-3">
          <label className="text-xs font-medium" htmlFor="gaia-daily-goal">
            {t("gaia.goals.dailyGoal")}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <Input
              id="gaia-daily-goal"
              value={dailyInput}
              inputMode="numeric"
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, "");
                setDailyInput(v);
                onDailyGoalChange(v === "" ? 0 : Number(v));
              }}
              placeholder={t("gaia.goals.dailyGoalPlaceholder")}
              className="h-8 text-xs"
            />
            <span className="shrink-0 text-xs text-muted-foreground">{t("gaia.stats.words")}</span>
          </div>
          {dailyPct !== null ? (
            <div className="mt-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-brand-coral transition-all"
                  style={{ width: `${dailyPct}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {wordsToday} / {dailyGoal} {t("gaia.goals.today")} ({dailyPct}%)
              </p>
            </div>
          ) : (
            <p className="mt-1 text-[11px] text-muted-foreground">{t("gaia.goals.todayHint")}</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Couverture (E19) ─────────────────────────────────────────────────────────

const MAX_COVER_BYTES = 2_000_000;

export function CoverBar({
  coverStored,
  onCoverChange,
  t,
}: {
  coverStored: string | null;
  onCoverChange: (cover: GaiaCover | null) => void;
  t: GaiaT;
}) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [url, setUrl] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);
  const cover = parseGaiaCover(coverStored);

  const setCover = (next: GaiaCover | null) => {
    onCoverChange(next);
    setPickerOpen(false);
  };

  const loadFile = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > MAX_COVER_BYTES) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCover({ kind: "image", value: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  if (!cover) {
    return (
      <div className="px-4 pt-4 sm:px-6">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setPickerOpen((v) => !v)}
        >
          <ImagePlus className="size-3.5" aria-hidden="true" />
          {t("gaia.cover.add")}
        </Button>
        {pickerOpen ? (
          <div className="mt-2 rounded-lg border p-3">
            <p className="mb-2 text-xs font-medium">{t("gaia.cover.gradient")}</p>
            <div className="flex gap-2">
              {GAIA_COVER_GRADIENTS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setCover({ kind: "gradient", value: g.id })}
                  aria-label={g.label}
                  title={g.label}
                  className="h-10 flex-1 rounded-md border hover:ring-2 hover:ring-brand-cyan"
                  style={{ background: g.css }}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && url.trim() !== "") {
                    e.preventDefault();
                    setCover({ kind: "image", value: url.trim() });
                    setUrl("");
                  }
                }}
                placeholder={t("gaia.cover.urlPlaceholder")}
                aria-label={t("gaia.cover.urlLabel")}
                className="h-8 text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0"
                onClick={() => fileRef.current?.click()}
              >
                {t("gaia.blocks.upload")}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  loadFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  const gradient = GAIA_COVER_GRADIENTS.find((g) => g.id === cover.value);
  return (
    <div className="relative h-36 overflow-hidden rounded-t-xl sm:h-44">
      {cover.kind === "image" ? (
        <img src={cover.value} alt="" className="h-full w-full object-cover" />
      ) : (
        <div
          className="h-full w-full"
          style={{ background: gradient?.css ?? GAIA_COVER_GRADIENTS[0].css }}
        />
      )}
      <div className="absolute right-2 top-2 flex gap-1.5">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setPickerOpen((v) => !v)}
        >
          {t("gaia.cover.change")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setCover(null)}
        >
          {t("gaia.cover.remove")}
        </Button>
      </div>
      {pickerOpen ? (
        <div className="absolute inset-x-2 bottom-2 rounded-lg border bg-card p-3 shadow-lg">
          <p className="mb-2 text-xs font-medium">{t("gaia.cover.gradient")}</p>
          <div className="flex gap-2">
            {GAIA_COVER_GRADIENTS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setCover({ kind: "gradient", value: g.id })}
                aria-label={g.label}
                title={g.label}
                className="h-10 flex-1 rounded-md border hover:ring-2 hover:ring-brand-cyan"
                style={{ background: g.css }}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Barre de sélection multiple (E20) ────────────────────────────────────────

export function MultiSelectBar({
  count,
  onDelete,
  onDuplicate,
  onTurnInto,
  onMoveToNote,
  onCopy,
  onClear,
  t,
}: {
  count: number;
  onDelete: () => void;
  onDuplicate: () => void;
  onTurnInto: (type: GaiaBlockType) => void;
  onMoveToNote: () => void;
  onCopy: () => void;
  onClear: () => void;
  t: GaiaT;
}) {
  const turnInto: GaiaBlockType[] = ["paragraph", "h1", "h2", "bullet", "todo", "callout"];
  return (
    <div
      data-testid="gaia-multiselect-bar"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-card px-2 py-1.5 shadow-lg"
    >
      <span className="px-2 text-xs font-semibold">
        {count} {t("gaia.multiselect.selected")}
      </span>
      <button
        type="button"
        onClick={onCopy}
        aria-label={t("gaia.multiselect.copy")}
        title={t("gaia.multiselect.copy")}
        className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Copy className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onDuplicate}
        aria-label={t("gaia.multiselect.duplicate")}
        title={t("gaia.multiselect.duplicate")}
        className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <CopyPlus className="size-4" aria-hidden="true" />
      </button>
      <select
        aria-label={t("gaia.blocks.turnInto")}
        onChange={(e) => {
          if (e.target.value !== "") onTurnInto(e.target.value as GaiaBlockType);
          e.target.value = "";
        }}
        className="h-7 rounded-full border bg-transparent px-2 text-xs outline-none"
        defaultValue=""
      >
        <option value="" disabled>
          {t("gaia.blocks.turnInto")}
        </option>
        {turnInto.map((type) => (
          <option key={type} value={type}>
            {t(`gaia.blockTypes.${type}`)}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onMoveToNote}
        aria-label={t("gaia.blocks.moveToNote")}
        title={t("gaia.blocks.moveToNote")}
        className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <MoveRight className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={t("gaia.multiselect.delete")}
        title={t("gaia.multiselect.delete")}
        className="rounded-full p-1.5 text-loss hover:bg-muted"
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onClear}
        aria-label={t("common.close")}
        className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

// ── Déplacer / copier vers une note (E04/E08) ────────────────────────────────

export function MoveToNoteDialog({
  open,
  onOpenChange,
  excludeNoteId,
  onPick,
  title,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excludeNoteId: string;
  onPick: (noteId: string) => void;
  title: string;
  t: GaiaT;
}) {
  const [q, setQ] = React.useState("");
  const notesQuery = useGaiaNotes({ ...GAIA_DEFAULT_PARAMS, q, pageSize: 20 });
  const notes = (notesQuery.data?.notes ?? []).filter((n) => n.id !== excludeNoteId);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t("gaia.moveToNote.body")}</DialogDescription>
        </DialogHeader>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("gaia.dialogs.searchPlaceholder")}
          aria-label={t("gaia.dialogs.searchLabel")}
          className="h-8 text-xs"
        />
        <div className="max-h-64 overflow-y-auto">
          {notes.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              {t("gaia.dialogs.noMatch")}
            </p>
          ) : (
            notes.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  onPick(n.id);
                  onOpenChange(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-muted"
              >
                <span className="text-base">{n.icon ?? "📄"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {n.title === "" ? t("gaia.shared.untitledNote") : n.title}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{n.excerpt}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Commandes slash personnalisées (E03) ─────────────────────────────────────

const CUSTOM_SLASH_KEY = "gaia-custom-slash-commands";

export function loadCustomSlashCommands(): GaiaCustomSlashCommand[] {
  try {
    const raw = localStorage.getItem(CUSTOM_SLASH_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is GaiaCustomSlashCommand =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as Record<string, unknown>).id === "string" &&
        typeof (c as Record<string, unknown>).cmd === "string" &&
        typeof (c as Record<string, unknown>).label === "string" &&
        typeof (c as Record<string, unknown>).type === "string",
    );
  } catch {
    return [];
  }
}

export function saveCustomSlashCommands(commands: GaiaCustomSlashCommand[]) {
  try {
    localStorage.setItem(CUSTOM_SLASH_KEY, JSON.stringify(commands));
  } catch {
    // Stockage indisponible : les commandes restent en mémoire pour la session.
  }
}

const CUSTOM_TYPES: GaiaBlockType[] = [
  "paragraph",
  "h1",
  "h2",
  "h3",
  "bullet",
  "numbered",
  "todo",
  "quote",
  "callout",
  "code",
  "toggle",
  "columns",
  "equation",
  "drawing",
  "mermaid",
  "embed",
  "file",
  "toc",
  "synced",
];

export function CustomSlashDialog({
  open,
  onOpenChange,
  commands,
  onSave,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: GaiaCustomSlashCommand[];
  onSave: (commands: GaiaCustomSlashCommand[]) => void;
  t: GaiaT;
}) {
  const [cmd, setCmd] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [type, setType] = React.useState<GaiaBlockType>("paragraph");
  const [presetText, setPresetText] = React.useState("");

  const add = () => {
    const cleanCmd = cmd.trim().replace(/^\//, "").replace(/[^a-z0-9-]/gi, "").toLowerCase();
    if (cleanCmd === "" || label.trim() === "") return;
    if (commands.some((c) => c.cmd === cleanCmd)) return;
    onSave([
      ...commands,
      {
        id: `custom-${Date.now().toString(36)}`,
        cmd: cleanCmd,
        label: label.trim(),
        type,
        presetText: presetText.trim() === "" ? undefined : presetText,
      },
    ]);
    setCmd("");
    setLabel("");
    setPresetText("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("gaia.slash.customTitle")}</DialogTitle>
          <DialogDescription>{t("gaia.slash.customBody")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={cmd}
              onChange={(e) => setCmd(e.target.value)}
              placeholder="/meeting"
              aria-label={t("gaia.slash.customCmdLabel")}
              className="h-8 text-xs"
            />
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("gaia.slash.customLabelPlaceholder")}
              aria-label={t("gaia.slash.customLabelLabel")}
              className="h-8 text-xs"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as GaiaBlockType)}
              aria-label={t("gaia.slash.customTypeLabel")}
              className="h-8 flex-1 rounded-md border bg-transparent px-2 text-xs outline-none"
            >
              {CUSTOM_TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {t(`gaia.blockTypes.${ty}`)}
                </option>
              ))}
            </select>
            <Input
              value={presetText}
              onChange={(e) => setPresetText(e.target.value)}
              placeholder={t("gaia.slash.customPresetPlaceholder")}
              aria-label={t("gaia.slash.customPresetLabel")}
              className="h-8 flex-1 text-xs"
            />
          </div>
          <Button type="button" size="sm" onClick={add} disabled={cmd.trim() === "" || label.trim() === ""}>
            {t("gaia.slash.customAdd")}
          </Button>
        </div>
        {commands.length > 0 ? (
          <ul className="max-h-48 space-y-1 overflow-y-auto">
            {commands.map((c) => (
              <li key={c.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm">
                <span className="font-mono text-xs text-muted-foreground">/{c.cmd}</span>
                <span className="min-w-0 flex-1 truncate">{c.label}</span>
                <span className="text-xs text-muted-foreground">{t(`gaia.blockTypes.${c.type}`)}</span>
                <button
                  type="button"
                  onClick={() => onSave(commands.filter((x) => x.id !== c.id))}
                  aria-label={`${t("gaia.blocks.deleteBlock")} ${c.label}`}
                  className="rounded p-0.5 text-muted-foreground hover:text-loss"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">{t("gaia.slash.customEmpty")}</p>
        )}
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <PaintBucket className="size-3" aria-hidden="true" />
          {t("gaia.slash.customStoredLocally")}
        </p>
      </DialogContent>
    </Dialog>
  );
}
