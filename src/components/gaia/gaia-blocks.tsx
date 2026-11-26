"use client";

/**
 * Gaïa — block rendering and editing.
 *
 * One row per block: gutter (drag handle + block menu), then the body for the
 * block type. Text blocks show a formatted preview when not focused and an
 * uncontrolled textarea when editing (the cursor survives autosave
 * re-renders); external changes are synced when the field is not focused.
 * Slash commands, the "Turn into" menu, nested blocks, columns, toggles,
 * comments and multi-select live here too.
 *
 * Module 1 — Advanced Editor (26 Nov 2026) : preview/edit, rich inline
 * formatting (via InlineMarkdown), nested blocks, toggles, columns,
 * advanced tables, equation / drawing / Mermaid / embed / TOC / synced.
 */
import * as React from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Columns2,
  Copy,
  GripVertical,
  Info,
  Lightbulb,
  Link2,
  MessageSquare,
  MoreVertical,
  ShieldAlert,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  GAIA_REF_META,
  gaiaRefLabel,
  InlineMarkdown,
  newBlockId,
  safeGaiaHref,
  type GaiaBlock,
  type GaiaBlockType,
  type GaiaCalloutTone,
  type GaiaRefKind,
  type GaiaT,
} from "./gaia-shared";
import {
  CommentsPanel,
  DrawingBlock,
  EmbedBlock,
  EquationBlock,
  MermaidBlock,
  TocBlock,
} from "./gaia-advanced-blocks";
import type { BlockListId } from "@/lib/gaia/tree";
import { displayCellValue } from "@/lib/gaia/table";

// ── Block operations (implemented by the editor) ─────────────────────────────

export interface GaiaBlockOps {
  updateText: (id: string, text: string) => void;
  updateBlock: (id: string, patch: Partial<GaiaBlock>) => void;
  splitBlock: (id: string, at: number) => void;
  mergeBackward: (id: string) => void;
  deleteBlock: (id: string) => void;
  duplicateBlock: (id: string) => void;
  moveBlock: (id: string, dir: -1 | 1) => void;
  reorder: (dragId: string, targetId: string, position: "above" | "below") => void;
  moveBlockToList: (dragId: string, targetListId: BlockListId, targetIndex: number) => void;
  focusBlock: (id: string, at: "start" | "end") => void;
  focusNeighbor: (id: string, dir: -1 | 1) => void;
  /** Module 1 : quitter le mode édition d'un bloc (aperçu formaté). */
  clearEditing: () => void;
  registerTextArea: (id: string, el: HTMLTextAreaElement | null) => void;
  openRefPicker: (kind: GaiaRefKind | "", sourceBlockId: string | null) => void;
  navigateToRef: (href: string) => void;
  openSlashMenu: (blockId: string, query: string, anchor: HTMLElement) => void;
  closeSlashMenu: () => void;
  /** Module 1 — nesting. */
  indentBlock: (id: string) => void;
  outdentBlock: (id: string) => void;
  toggleCollapse: (id: string) => void;
  addColumn: (id: string) => void;
  removeColumn: (id: string, colIndex: number) => void;
  addBlockToList: (listId: BlockListId) => void;
  /** Module 1 — comments. */
  addComment: (blockId: string, text: string, author: string) => void;
  toggleCommentResolved: (blockId: string, commentId: string) => void;
  deleteComment: (blockId: string, commentId: string) => void;
  /** Module 1 — navigation / moves. */
  navigateToBlock: (id: string) => void;
  openMoveToNote: (blockId: string) => void;
  openCopySynced: (blockId: string) => void;
  makeSynced: (id: string) => void;
}

export const TEXT_BLOCK_TYPES: GaiaBlockType[] = [
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
  "synced",
];

export const TURN_INTO_TYPES: GaiaBlockType[] = [...TEXT_BLOCK_TYPES];

export function blockTypeLabel(type: GaiaBlockType, t: GaiaT): string {
  if (type === "ref") return t("gaia.refKinds.note");
  return t(`gaia.blockTypes.${type}`);
}

/** Number within the current consecutive run of numbered blocks (per-section). */
export function numberedIndexFor(blocks: GaiaBlock[], index: number): number {
  let n = 0;
  for (let i = index; i >= 0; i--) {
    if (blocks[i].type !== "numbered") break;
    n++;
  }
  return n;
}

// ── Slash commands ───────────────────────────────────────────────────────────

export type GaiaSlashGroup =
  | "Basic"
  | "Lists"
  | "Media"
  | "Layout"
  | "Advanced"
  | "Custom"
  | "Trading";

export interface GaiaSlashItem {
  cmd: string;
  group: GaiaSlashGroup;
  type: GaiaBlockType;
  refKind?: GaiaRefKind;
  label: string;
  desc: string;
  keywords?: string;
  /** Commande personnalisée : texte initial du bloc créé. */
  presetText?: string;
  customId?: string;
}

export interface GaiaCustomSlashCommand {
  id: string;
  cmd: string;
  label: string;
  type: GaiaBlockType;
  presetText?: string;
}

export function slashItemsFor(
  t: GaiaT,
  customCommands: GaiaCustomSlashCommand[] = [],
): GaiaSlashItem[] {
  const desc = (k: string) => t(`gaia.slash.desc.${k}`);
  const bt = (k: string) => t(`gaia.blockTypes.${k}`);
  const items: GaiaSlashItem[] = [
    { cmd: "text", group: "Basic", type: "paragraph", label: bt("paragraph"), desc: desc("text"), keywords: "paragraph plain" },
    { cmd: "heading", group: "Basic", type: "h1", label: bt("h1"), desc: desc("heading"), keywords: "title h1" },
    { cmd: "h2", group: "Basic", type: "h2", label: bt("h2"), desc: desc("h2"), keywords: "subtitle h2" },
    { cmd: "h3", group: "Basic", type: "h3", label: bt("h3"), desc: desc("h3"), keywords: "h3" },
    { cmd: "quote", group: "Basic", type: "quote", label: bt("quote"), desc: desc("quote"), keywords: "citation" },
    { cmd: "callout", group: "Basic", type: "callout", label: bt("callout"), desc: desc("callout"), keywords: "note alert info tip" },
    { cmd: "divider", group: "Basic", type: "divider", label: bt("divider"), desc: desc("divider"), keywords: "separator line hr" },
    { cmd: "bullet", group: "Lists", type: "bullet", label: bt("bullet"), desc: desc("bullet"), keywords: "ul list point" },
    { cmd: "numbered", group: "Lists", type: "numbered", label: bt("numbered"), desc: desc("numbered"), keywords: "ol list 1." },
    { cmd: "todo", group: "Lists", type: "todo", label: bt("todo"), desc: desc("todo"), keywords: "task checkbox check" },
    { cmd: "toggle", group: "Lists", type: "toggle", label: bt("toggle"), desc: desc("toggle"), keywords: "collapsible fold accordion nested" },
    { cmd: "image", group: "Media", type: "image", label: bt("image"), desc: desc("image"), keywords: "photo picture upload" },
    { cmd: "drawing", group: "Media", type: "drawing", label: bt("drawing"), desc: desc("drawing"), keywords: "sketch canvas draw pen" },
    { cmd: "embed", group: "Media", type: "embed", label: bt("embed"), desc: desc("embed"), keywords: "youtube vimeo video link" },
    { cmd: "columns", group: "Layout", type: "columns", label: bt("columns"), desc: desc("columns"), keywords: "side by side grid two three" },
    { cmd: "toc", group: "Layout", type: "toc", label: bt("toc"), desc: desc("toc"), keywords: "contents outline sommaire" },
    { cmd: "code", group: "Advanced", type: "code", label: bt("code"), desc: desc("code"), keywords: "snippet programming" },
    { cmd: "table", group: "Advanced", type: "table", label: bt("table"), desc: desc("table"), keywords: "spreadsheet grid sort filter" },
    { cmd: "equation", group: "Advanced", type: "equation", label: bt("equation"), desc: desc("equation"), keywords: "math latex formula katex" },
    { cmd: "mermaid", group: "Advanced", type: "mermaid", label: bt("mermaid"), desc: desc("mermaid"), keywords: "diagram flowchart chart" },
    { cmd: "synced", group: "Advanced", type: "synced", label: bt("synced"), desc: desc("synced"), keywords: "shared mirror duplicate live" },
    { cmd: "trade", group: "Trading", type: "ref", refKind: "TRADE", label: t("gaia.refKinds.trade"), desc: desc("trade") },
    { cmd: "strategy", group: "Trading", type: "ref", refKind: "STRATEGY", label: t("gaia.refKinds.strategy"), desc: desc("strategy") },
    { cmd: "setup", group: "Trading", type: "ref", refKind: "SETUP", label: t("gaia.refKinds.setup"), desc: desc("setup") },
    { cmd: "lesson", group: "Trading", type: "ref", refKind: "LESSON", label: t("gaia.refKinds.lesson"), desc: desc("lesson") },
    { cmd: "event", group: "Trading", type: "ref", refKind: "EVENT", label: t("gaia.refKinds.event"), desc: desc("event") },
    { cmd: "symbol", group: "Trading", type: "ref", refKind: "SYMBOL", label: t("gaia.refKinds.symbol"), desc: desc("symbol") },
    { cmd: "note", group: "Trading", type: "ref", refKind: "NOTE", label: t("gaia.refKinds.note"), desc: desc("note") },
  ];
  for (const c of customCommands) {
    items.push({
      cmd: c.cmd,
      group: "Custom",
      type: c.type,
      label: c.label,
      desc: t("gaia.slash.customDesc"),
      presetText: c.presetText,
      customId: c.id,
    });
  }
  return items;
}

/** "/xxx" at the start of a block opens the menu; following chars filter it. */
export function slashFilterOf(text: string): string | null {
  const m = /^\/([\w-]*)$/.exec(text);
  return m ? (m[1] ?? "") : null;
}

const SLASH_GROUPS: GaiaSlashGroup[] = [
  "Basic",
  "Lists",
  "Media",
  "Layout",
  "Advanced",
  "Custom",
  "Trading",
];

export function GaiaSlashMenu({
  rect,
  items,
  activeIndex,
  onActiveChange,
  onSelect,
  onClose,
  onManageCustom,
  t,
}: {
  rect: { top: number; left: number };
  items: GaiaSlashItem[];
  activeIndex: number;
  onActiveChange: (i: number) => void;
  onSelect: (item: GaiaSlashItem) => void;
  onClose: () => void;
  onManageCustom: () => void;
  t: GaiaT;
}) {
  const listRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>("[data-active='true']");
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);
  let flat = -1;
  return (
    <div
      data-testid="gaia-slash-menu"
      role="listbox"
      aria-label={t("gaia.editor.slashMenuLabel")}
      className="fixed z-50 w-72 overflow-hidden rounded-lg border bg-card shadow-lg"
      style={{
        top: Math.min(rect.top, window.innerHeight - 280),
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 296)),
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div ref={listRef} className="max-h-64 overflow-y-auto p-1">
        {items.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">
            {t("gaia.dialogs.noMatch")}
          </p>
        ) : (
          SLASH_GROUPS.map((group) => {
            const groupItems = items.filter((i) => i.group === group);
            if (groupItems.length === 0) return null;
            return (
              <div key={group}>
                <p className="px-2 pb-1 pt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t(`gaia.slash.groups.${group}`)}
                </p>
                {groupItems.map((item) => {
                  flat++;
                  const idx = flat;
                  const active = idx === activeIndex;
                  return (
                    <button
                      key={`${item.group}-${item.cmd}`}
                      type="button"
                      role="option"
                      aria-selected={active}
                      data-active={active}
                      data-testid="gaia-slash-item"
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left ${
                        active ? "bg-brand-coral/10" : ""
                      }`}
                      onMouseEnter={() => onActiveChange(idx)}
                      onClick={() => onSelect(item)}
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded border bg-muted font-mono text-[11px]">
                        /{item.cmd.slice(0, 2)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{item.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.desc}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[10px] uppercase text-muted-foreground">
                        {group}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
      <div className="flex items-center justify-between border-t px-2 py-1.5">
        <button
          type="button"
          onClick={onManageCustom}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {t("gaia.slash.manageCustom")}
        </button>
        <button type="button" className="hidden" onClick={onClose} aria-hidden="true" tabIndex={-1}>
          close
        </button>
      </div>
    </div>
  );
}

// ── Text blocks ──────────────────────────────────────────────────────────────

const MARKDOWN_TRANSFORMS: Array<{
  test: (v: string) => boolean;
  type: GaiaBlockType;
  checked?: boolean;
}> = [
  { test: (v) => v === "---", type: "divider" },
  { test: (v) => v === "```", type: "code" },
  { test: (v) => v.startsWith("### "), type: "h3" },
  { test: (v) => v.startsWith("## "), type: "h2" },
  { test: (v) => v.startsWith("# "), type: "h1" },
  { test: (v) => v.startsWith("- ") || v.startsWith("* "), type: "bullet" },
  { test: (v) => v.startsWith("1. "), type: "numbered" },
  { test: (v) => v.startsWith("[] ") || v.startsWith("[ ] "), type: "todo", checked: false },
  { test: (v) => v.startsWith("> "), type: "quote" },
];

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function placeholderFor(block: GaiaBlock, t: GaiaT): string {
  switch (block.type) {
    case "bullet":
    case "numbered":
      return t("gaia.placeholders.list");
    case "todo":
      return t("gaia.placeholders.todo");
    case "quote":
      return t("gaia.placeholders.quote");
    case "callout":
      return t("gaia.placeholders.callout");
    case "code":
      return t("gaia.placeholders.code");
    case "toggle":
      return t("gaia.placeholders.toggle");
    case "synced":
      return t("gaia.placeholders.synced");
    case "h1":
      return t("gaia.blockTypes.h1");
    case "h2":
      return t("gaia.blockTypes.h2");
    case "h3":
      return t("gaia.blockTypes.h3");
    default:
      return t("gaia.placeholders.paragraph");
  }
}

function sizeClsFor(type: GaiaBlockType): string {
  switch (type) {
    case "h1":
      return "text-2xl font-bold";
    case "h2":
      return "text-xl font-semibold";
    case "h3":
      return "text-lg font-semibold";
    case "code":
      return "font-mono text-[13px] leading-normal";
    default:
      return "text-[15px] leading-relaxed";
  }
}

export function TextBlockBody({
  block,
  ops,
  t,
  editing,
  onEditStart,
}: {
  block: GaiaBlock;
  ops: GaiaBlockOps;
  t: GaiaT;
  editing: boolean;
  onEditStart: () => void;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (el) autoResize(el);
  }, [block.type]);

  // External changes (merge, turn-into, restore) sync in when not focused.
  React.useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.value !== block.text) {
      el.value = block.text;
      autoResize(el);
    }
  }, [block.text]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target;
    autoResize(el);
    const value = el.value;
    if (block.type === "paragraph") {
      const hit = MARKDOWN_TRANSFORMS.find((tr) => tr.test(value));
      if (hit) {
        ops.updateBlock(block.id, {
          type: hit.type,
          text: "",
          checked: hit.checked,
        });
        // Uncontrolled field: clear the trigger text in the DOM directly.
        el.value = "";
        autoResize(el);
        ops.focusBlock(block.id, "end");
        ops.closeSlashMenu();
        return;
      }
    }
    const slash = slashFilterOf(value);
    if (slash !== null) {
      ops.openSlashMenu(block.id, slash, el);
    } else {
      ops.closeSlashMenu();
    }
    ops.updateText(block.id, value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    if (e.key === "Enter" && !e.shiftKey && block.type !== "code") {
      e.preventDefault();
      if (
        el.value === "" &&
        (block.type === "bullet" || block.type === "numbered" || block.type === "todo")
      ) {
        ops.updateBlock(block.id, { type: "paragraph", checked: undefined });
        ops.focusBlock(block.id, "start");
        return;
      }
      ops.splitBlock(block.id, el.selectionStart ?? el.value.length);
      return;
    }
    if (e.key === "Backspace" && el.selectionStart === 0 && el.selectionEnd === 0) {
      e.preventDefault();
      ops.mergeBackward(block.id);
      return;
    }
    if (e.key === "ArrowUp" && el.selectionStart === 0) {
      e.preventDefault();
      ops.focusNeighbor(block.id, -1);
      return;
    }
    if (e.key === "ArrowDown" && el.selectionStart === el.value.length) {
      e.preventDefault();
      ops.focusNeighbor(block.id, 1);
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) ops.outdentBlock(block.id);
      else ops.indentBlock(block.id);
    }
  };

  if (!editing) {
    // Aperçu formaté (E01/E02) : clic pour éditer.
    if (block.text === "") {
      return (
        <button
          type="button"
          onClick={onEditStart}
          className={`block w-full rounded-sm text-left text-muted-foreground/50 outline-none hover:bg-muted/30 ${sizeClsFor(block.type)}`}
        >
          {placeholderFor(block, t)}
        </button>
      );
    }
    if (block.type === "code") {
      return (
        <button
          type="button"
          onClick={onEditStart}
          className="block w-full overflow-x-auto rounded-sm text-left outline-none hover:bg-muted/30"
        >
          <pre className={`whitespace-pre-wrap break-words font-mono text-[13px] leading-normal`}>
            {block.text}
          </pre>
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={onEditStart}
        className={`block w-full rounded-sm text-left outline-none hover:bg-muted/30 ${sizeClsFor(block.type)}`}
      >
        <InlineMarkdown text={block.text} />
      </button>
    );
  }

  return (
    <textarea
      ref={(el) => {
        ref.current = el;
        ops.registerTextArea(block.id, el);
      }}
      defaultValue={block.text}
      rows={1}
      aria-label={`${blockTypeLabel(block.type, t)} ${t("gaia.blocks.blockAria")}`}
      placeholder={placeholderFor(block, t)}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={() => ops.clearEditing()}
      className={`w-full resize-none overflow-hidden rounded-sm border border-transparent bg-transparent outline-none placeholder:text-muted-foreground/50 focus:border-border focus:bg-background ${sizeClsFor(block.type)}`}
    />
  );
}

// ── Callout ──────────────────────────────────────────────────────────────────

const CALLOUT_TONES: Array<{
  tone: GaiaCalloutTone;
  icon: typeof Info;
  hue: string;
}> = [
  { tone: "info", icon: Info, hue: "#22D3EE" },
  { tone: "tip", icon: Lightbulb, hue: "#FF6B5B" },
  { tone: "warn", icon: AlertTriangle, hue: "#f59e0b" },
  { tone: "risk", icon: ShieldAlert, hue: "#fb7185" },
];

function CalloutBlock({
  block,
  ops,
  t,
  editing,
  onEditStart,
}: {
  block: GaiaBlock;
  ops: GaiaBlockOps;
  t: GaiaT;
  editing: boolean;
  onEditStart: () => void;
}) {
  const tone = block.tone ?? "info";
  const active = CALLOUT_TONES.find((c) => c.tone === tone) ?? CALLOUT_TONES[0];
  return (
    <div
      data-testid="gaia-callout"
      className="flex gap-2.5 rounded-md border p-3"
      style={{
        borderColor: `color-mix(in srgb, ${active.hue} 35%, transparent)`,
        background: `color-mix(in srgb, ${active.hue} 8%, transparent)`,
      }}
    >
      <div className="flex flex-col items-center gap-1 pt-0.5">
        <active.icon className="size-4 shrink-0" style={{ color: active.hue }} aria-hidden="true" />
        <div className="flex flex-col gap-0.5">
          {CALLOUT_TONES.map((c) => (
            <button
              key={c.tone}
              type="button"
              aria-label={`${t("gaia.blocks.calloutToneAria")} ${t(`gaia.blocks.tones.${c.tone}`)}`}
              title={t(`gaia.blocks.tones.${c.tone}`)}
              onClick={() => ops.updateBlock(block.id, { tone: c.tone })}
              className={`rounded-sm p-0.5 transition-opacity ${
                c.tone === tone ? "opacity-100" : "opacity-25 hover:opacity-70"
              }`}
            >
              <c.icon className="size-3" style={{ color: c.hue }} aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <TextBlockBody block={block} ops={ops} t={t} editing={editing} onEditStart={onEditStart} />
      </div>
    </div>
  );
}

// ── Image ────────────────────────────────────────────────────────────────────

const MAX_IMAGE_BYTES = 2_000_000;

function ImageBlock({
  block,
  ops,
  t,
}: {
  block: GaiaBlock;
  ops: GaiaBlockOps;
  t: GaiaT;
}) {
  const [url, setUrl] = React.useState("");
  const [dragOver, setDragOver] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const loadFile = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > MAX_IMAGE_BYTES) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        ops.updateBlock(block.id, { src: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  if (!block.src) {
    return (
      <div
        data-testid="gaia-image-empty"
        className={`rounded-md border border-dashed bg-muted/40 p-3 ${dragOver ? "border-brand-cyan/60" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          loadFile(e.dataTransfer.files?.[0]);
        }}
      >
        <div className="flex items-center gap-2">
          <Upload className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && url.trim() !== "") {
                e.preventDefault();
                ops.updateBlock(block.id, { src: url.trim() });
                setUrl("");
              }
            }}
            placeholder={t("gaia.blocks.imageUrlPlaceholder")}
            aria-label={t("gaia.blocks.imageUrlLabel")}
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
    );
  }

  return (
    <figure data-testid="gaia-image" className="overflow-hidden rounded-md border">
      <img
        src={block.src}
        alt={block.alt ?? block.caption ?? t("gaia.blocks.noteImageAlt")}
        className="max-h-96 w-full bg-muted/30 object-contain"
      />
      <figcaption className="flex items-center gap-2 border-t bg-card px-2 py-1.5">
        <Input
          defaultValue={block.caption ?? ""}
          onChange={(e) => ops.updateBlock(block.id, { caption: e.target.value })}
          placeholder={t("gaia.blocks.captionPlaceholder")}
          aria-label={t("gaia.blocks.captionLabel")}
          className="h-7 border-transparent bg-transparent text-xs"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 hover:text-loss"
          aria-label={t("gaia.blocks.removeImage")}
          title={t("gaia.blocks.removeImage")}
          onClick={() => ops.updateBlock(block.id, { src: undefined })}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
        </Button>
      </figcaption>
    </figure>
  );
}

// ── Table (E15 : tri, filtres, formules, types de colonnes) ─────────────────

const TABLE_COL_TYPE_LABELS: Record<string, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  checkbox: "Checkbox",
};

function TableBlock({
  block,
  ops,
  t,
}: {
  block: GaiaBlock;
  ops: GaiaBlockOps;
  t: GaiaT;
}) {
  const rows = block.rows ?? [
    ["", "", ""],
    ["", "", ""],
  ];
  const colCount = rows[0]?.length ?? 3;
  const meta = block.tableMeta ?? {};
  const colTypes = meta.colTypes ?? [];
  const [filter, setFilter] = React.useState("");
  const [focused, setFocused] = React.useState<{ r: number; c: number } | null>(null);

  const setRows = (next: string[][]) => ops.updateBlock(block.id, { rows: next });
  const setMeta = (next: NonNullable<GaiaBlock["tableMeta"]>) =>
    ops.updateBlock(block.id, { tableMeta: next });
  const setCell = (r: number, c: number, value: string) => {
    const next = rows.map((row, ri) =>
      ri === r ? row.map((cell, ci) => (ci === c ? value : cell)) : row,
    );
    setRows(next);
  };

  // Ordre d'affichage : filtre puis tri (on garde les index d'origine).
  const dataIndices = rows
    .map((_, i) => i)
    .slice(1)
    .filter((ri) => {
      if (filter.trim() === "") return true;
      const q = filter.toLowerCase();
      return rows[ri].some((cell) => cell.toLowerCase().includes(q));
    });
  const sortedIndices = React.useMemo(() => {
    if (meta.sortBy === undefined) return dataIndices;
    const dir = meta.sortDir === "desc" ? -1 : 1;
    const type = colTypes[meta.sortBy] ?? "text";
    const keyOf = (ri: number): number | string => {
      const raw = rows[ri]?.[meta.sortBy!] ?? "";
      const val = raw.trim().startsWith("=") ? displayCellValue(raw, rows) : raw;
      if (type === "number") {
        const n = Number(val);
        return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
      }
      if (type === "date") {
        const time = Date.parse(val);
        return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
      }
      return val.toLowerCase();
    };
    return [...dataIndices].sort((a, b) => {
      const ka = keyOf(a);
      const kb = keyOf(b);
      if (typeof ka === "number" && typeof kb === "number") return (ka - kb) * dir;
      return String(ka).localeCompare(String(kb)) * dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, meta.sortBy, meta.sortDir, colTypes, filter]);

  const setColType = (c: number, type: "text" | "number" | "date" | "checkbox") => {
    const next: Array<"text" | "number" | "date" | "checkbox"> = [...colTypes];
    while (next.length < colCount) next.push("text");
    next[c] = type;
    setMeta({ ...meta, colTypes: next });
  };

  const renderCellInput = (ri: number, ci: number) => {
    const raw = rows[ri][ci] ?? "";
    const type = colTypes[ci] ?? "text";
    const isFocused = focused?.r === ri && focused?.c === ci;
    if (type === "checkbox" && ri > 0) {
      return (
        <input
          type="checkbox"
          checked={raw === "true" || raw === "x"}
          onChange={(e) => setCell(ri, ci, e.target.checked ? "true" : "false")}
          aria-label={`${t("gaia.blocks.rowColumn")} ${ri} ${t("gaia.blocks.column")} ${ci + 1}`}
          className="ml-2 size-3.5 accent-brand-cyan"
        />
      );
    }
    return (
      <input
        value={isFocused || type === "date" ? raw : displayCellValue(raw, rows)}
        type={type === "date" ? "date" : "text"}
        inputMode={type === "number" ? "decimal" : undefined}
        onFocus={() => setFocused({ r: ri, c: ci })}
        onBlur={() => setFocused(null)}
        onChange={(e) => setCell(ri, ci, e.target.value)}
        aria-label={
          ri === 0
            ? `${t("gaia.blocks.headerColumn")} ${ci + 1}`
            : `${t("gaia.blocks.rowColumn")} ${ri} ${t("gaia.blocks.column")} ${ci + 1}`
        }
        placeholder={raw.trim().startsWith("=") ? "" : "…"}
        className={`w-full min-w-24 bg-transparent px-2 py-1.5 text-[13px] outline-none ${
          ri === 0 ? "font-semibold" : ""
        } ${type === "number" ? "text-right font-mono" : ""}`}
      />
    );
  };

  return (
    <div data-testid="gaia-table" className="overflow-hidden rounded-md border border-border">
      <div className="flex items-center gap-2 border-b bg-card px-2 py-1.5">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t("gaia.blocks.tableFilterPlaceholder")}
          aria-label={t("gaia.blocks.tableFilterLabel")}
          className="h-7 max-w-44 text-xs"
        />
        {meta.sortBy !== undefined ? (
          <button
            type="button"
            onClick={() => setMeta({ ...meta, sortBy: undefined, sortDir: undefined })}
            className="rounded-sm border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {t("gaia.blocks.tableSortedBy")} {meta.sortBy + 1} {meta.sortDir === "desc" ? "↓" : "↑"} ✕
          </button>
        ) : null}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {t("gaia.blocks.tableFormulaHint")}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {rows[0] ? (
              <tr className="bg-muted/60">
                {rows[0].map((cell, ci) => (
                  <td key={ci} className="border-b border-r border-border p-0 last:border-r-0">
                    <div className="flex items-center">
                      <input
                        value={cell}
                        onChange={(e) => setCell(0, ci, e.target.value)}
                        aria-label={`${t("gaia.blocks.headerColumn")} ${ci + 1}`}
                        placeholder="…"
                        className="w-full min-w-24 bg-transparent px-2 py-1.5 text-[13px] font-semibold outline-none"
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`${t("gaia.blocks.columnOptions")} ${ci + 1}`}
                            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted"
                          >
                            <ChevronDown className="size-3" aria-hidden="true" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuLabel>{t("gaia.blocks.columnOptions")}</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => setMeta({ ...meta, sortBy: ci, sortDir: "asc" })}
                          >
                            {t("gaia.blocks.sortAsc")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setMeta({ ...meta, sortBy: ci, sortDir: "desc" })}
                          >
                            {t("gaia.blocks.sortDesc")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {(["text", "number", "date", "checkbox"] as const).map((type) => (
                            <DropdownMenuItem key={type} onClick={() => setColType(ci, type)}>
                              {TABLE_COL_TYPE_LABELS[type]}
                              {(colTypes[ci] ?? "text") === type ? " ✓" : ""}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                ))}
                <td className="w-6 border-b border-border p-0" />
              </tr>
            ) : null}
            {sortedIndices.map((ri) => (
              <tr key={ri} className="group/row">
                {rows[ri].map((cell, ci) => (
                  <td key={ci} className="border-b border-r border-border p-0 last:border-r-0">
                    {renderCellInput(ri, ci)}
                  </td>
                ))}
                <td className="w-6 border-b border-border p-0">
                  <button
                    type="button"
                    disabled={rows.length <= 1}
                    onClick={() => setRows(rows.filter((_, i) => i !== ri))}
                    aria-label={t("gaia.blocks.deleteRow")}
                    title={t("gaia.blocks.deleteRow")}
                    className="hidden h-full w-6 items-center justify-center text-muted-foreground hover:text-loss disabled:opacity-30 group-hover/row:flex"
                  >
                    <Trash2 className="size-3" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-1 border-t bg-card px-2 py-1">
        <button
          type="button"
          onClick={() => setRows([...rows, Array(colCount).fill("")])}
          className="h-6 rounded px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {t("gaia.blocks.addRow")}
        </button>
        <button
          type="button"
          disabled={colCount >= 8}
          onClick={() => setRows(rows.map((row) => [...row, ""]))}
          className="h-6 rounded px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          {t("gaia.blocks.addColumn")}
        </button>
        <button
          type="button"
          disabled={colCount <= 1}
          onClick={() => setRows(rows.map((row) => row.slice(0, -1)))}
          className="h-6 rounded px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          {t("gaia.blocks.removeColumn")}
        </button>
      </div>
    </div>
  );
}

// ── Ref ──────────────────────────────────────────────────────────────────────

function RefBlock({
  block,
  ops,
  t,
}: {
  block: GaiaBlock;
  ops: GaiaBlockOps;
  t: GaiaT;
}) {
  if (!block.ref) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
        <Link2 className="size-4" aria-hidden="true" />
        <span className="flex-1">{t("gaia.blocks.missingRef")}</span>
        <Button type="button" variant="ghost" size="sm" onClick={() => ops.deleteBlock(block.id)}>
          {t("gaia.blocks.remove")}
        </Button>
      </div>
    );
  }
  const meta = GAIA_REF_META[block.ref.kind];
  const Icon = meta.icon;
  const href = safeGaiaHref(block.ref.href);
  return (
    <div
      data-testid="gaia-ref-block"
      data-ref-kind={block.ref.kind}
      className="flex items-center gap-2.5 rounded-md border p-3 hover:bg-muted/40"
      style={{ borderColor: `color-mix(in srgb, ${meta.hue} 30%, transparent)` }}
    >
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-md"
        style={{ background: `color-mix(in srgb, ${meta.hue} 14%, transparent)` }}
      >
        <Icon className="size-4" style={{ color: meta.hue }} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {block.ref.label ?? gaiaRefLabel(block.ref.kind, t)}
        </span>
        {block.ref.meta ? (
          <span className="block truncate text-xs text-muted-foreground">{block.ref.meta}</span>
        ) : null}
      </span>
      {href ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0"
          data-testid="gaia-ref-open"
          onClick={() => ops.navigateToRef(href)}
        >
          {t("gaia.blocks.open")}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 hover:text-loss"
        aria-label={t("gaia.blocks.removeRef")}
        title={t("gaia.blocks.removeRef")}
        onClick={() => ops.deleteBlock(block.id)}
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}

// ── Contexte partagé par les lignes d'une liste ──────────────────────────────

export interface DragState {
  dragId: string | null;
  overId: string | null;
  overListId: BlockListId | null;
  position: "above" | "below" | null;
}

export interface BlockRowContext {
  ops: GaiaBlockOps;
  t: GaiaT;
  editingId: string | null;
  onEditStart: (id: string) => void;
  selectedIds: ReadonlySet<string>;
  selectionMode: boolean;
  onToggleSelect: (id: string) => void;
  openCommentsId: string | null;
  onToggleComments: (id: string) => void;
  authorName: string;
  headings: Array<{ id: string; level: 1 | 2 | 3; text: string }>;
  dragState: DragState;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent, id: string, listId: BlockListId) => void;
  onDragEnd: () => void;
  onDrop: (id: string, listId: BlockListId) => void;
  onDropInto: (listId: BlockListId, index: number) => void;
}

export function BlockList({
  listId,
  blocks,
  depth,
  ctx,
  showAddButton,
}: {
  listId: BlockListId;
  blocks: GaiaBlock[];
  depth: number;
  ctx: BlockRowContext;
  showAddButton?: boolean;
}) {
  const dragging = ctx.dragState.dragId !== null;
  const dropActive =
    dragging &&
    ctx.dragState.overListId === listId &&
    ctx.dragState.overId === null;
  return (
    <div className="space-y-1">
      {blocks.map((block, i) => (
        <GaiaBlockRow
          key={block.id}
          block={block}
          listId={listId}
          index={i}
          total={blocks.length}
          siblingList={blocks}
          depth={depth}
          ctx={ctx}
        />
      ))}
      {dragging ? (
        <div
          data-testid="gaia-drop-zone"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            ctx.onDragOver(e, "", listId);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            ctx.onDropInto(listId, blocks.length);
          }}
          className={`flex h-6 items-center justify-center rounded-md border border-dashed text-[11px] transition-colors ${
            dropActive
              ? "border-brand-cyan bg-brand-cyan/10 text-brand-cyan-deep dark:text-brand-cyan"
              : "border-border/60 text-muted-foreground/60"
          }`}
        >
          {ctx.t("gaia.blocks.dropHere")}
        </div>
      ) : null}
      {showAddButton && !dragging ? (
        <button
          type="button"
          onClick={() => ctx.ops.addBlockToList(listId)}
          className="h-7 w-full rounded-md pl-7 text-left text-xs text-muted-foreground hover:bg-muted/50"
        >
          {ctx.t("gaia.editor.addBlockHint")}
        </button>
      ) : null}
    </div>
  );
}

// ── Toggle (E06) ─────────────────────────────────────────────────────────────

function ToggleBlock({
  block,
  ctx,
  listId,
}: {
  block: GaiaBlock;
  ctx: BlockRowContext;
  listId: BlockListId;
}) {
  const { ops, t } = ctx;
  const collapsed = block.collapsed ?? false;
  const editing = ctx.editingId === block.id;
  return (
    <div data-testid="gaia-toggle" className="rounded-md border border-border/70">
      <div className="flex items-start gap-1 px-2 py-1">
        <button
          type="button"
          onClick={() => ops.toggleCollapse(block.id)}
          aria-label={collapsed ? t("gaia.blocks.expandToggle") : t("gaia.blocks.collapseToggle")}
          title={collapsed ? t("gaia.blocks.expandToggle") : t("gaia.blocks.collapseToggle")}
          className="mt-1.5 shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted"
        >
          <ChevronRight
            className={`size-4 transition-transform ${collapsed ? "" : "rotate-90"}`}
            aria-hidden="true"
          />
        </button>
        <div className="min-w-0 flex-1">
          <TextBlockBody
            block={block}
            ops={ops}
            t={t}
            editing={editing}
            onEditStart={() => ctx.onEditStart(block.id)}
          />
        </div>
      </div>
      {!collapsed ? (
        <div className="ml-5 border-l border-border/70 pb-1 pl-3 pr-2">
          <BlockList
            listId={`children:${block.id}` as BlockListId}
            blocks={block.children ?? []}
            depth={1}
            ctx={ctx}
            showAddButton
          />
        </div>
      ) : null}
    </div>
  );
}

// ── Colonnes (E07) ───────────────────────────────────────────────────────────

function ColumnsBlock({
  block,
  ctx,
}: {
  block: GaiaBlock;
  ctx: BlockRowContext;
}) {
  const { ops, t } = ctx;
  const columns = block.columns ?? [[], []];
  return (
    <div data-testid="gaia-columns" className="rounded-md border border-border/70 p-2">
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        {columns.map((col, ci) => (
          <div key={ci} className="min-w-0 rounded-md bg-muted/25 p-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <Columns2 className="size-3" aria-hidden="true" />
                {t("gaia.blocks.column")} {ci + 1}
              </span>
              {columns.length > 1 ? (
                <button
                  type="button"
                  onClick={() => ops.removeColumn(block.id, ci)}
                  aria-label={`${t("gaia.blocks.removeColumn")} ${ci + 1}`}
                  title={`${t("gaia.blocks.removeColumn")} ${ci + 1}`}
                  className="rounded p-0.5 text-muted-foreground hover:text-loss"
                >
                  <Trash2 className="size-3" aria-hidden="true" />
                </button>
              ) : null}
            </div>
            <BlockList
              listId={`columns:${block.id}:${ci}` as BlockListId}
              blocks={col}
              depth={1}
              ctx={ctx}
              showAddButton
            />
          </div>
        ))}
      </div>
      {columns.length < 3 ? (
        <button
          type="button"
          onClick={() => ops.addColumn(block.id)}
          className="mt-2 h-7 w-full rounded-md text-xs text-muted-foreground hover:bg-muted/50"
        >
          {t("gaia.blocks.addColumnBlock")}
        </button>
      ) : null}
    </div>
  );
}

// ── One block row (gutter + body + drag and drop) ────────────────────────────

export function GaiaBlockRow({
  block,
  listId,
  index,
  total,
  siblingList,
  depth,
  ctx,
}: {
  block: GaiaBlock;
  listId: BlockListId;
  index: number;
  total: number;
  siblingList: GaiaBlock[];
  depth: number;
  ctx: BlockRowContext;
}) {
  const { ops, t, dragState } = ctx;
  const isDragging = dragState.dragId === block.id;
  const showAbove =
    dragState.overId === block.id &&
    dragState.overListId === listId &&
    dragState.position === "above";
  const showBelow =
    dragState.overId === block.id &&
    dragState.overListId === listId &&
    dragState.position === "below";
  const editing = ctx.editingId === block.id;
  const onEditStart = () => ctx.onEditStart(block.id);
  const selected = ctx.selectedIds.has(block.id);
  const openComments = ctx.openCommentsId === block.id;
  const commentCount = block.comments?.length ?? 0;
  const openCommentCount = block.comments?.filter((c) => !c.resolved).length ?? 0;

  let body: React.ReactNode;
  switch (block.type) {
    case "divider":
      body = (
        <div className="flex items-center gap-2 py-1">
          <hr className="h-px flex-1 border-0 bg-border" />
          <button
            type="button"
            aria-label={t("gaia.blocks.deleteDivider")}
            title={t("gaia.blocks.deleteDivider")}
            onClick={() => ops.deleteBlock(block.id)}
            className="text-muted-foreground opacity-0 hover:text-loss group-hover/row:opacity-100"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      );
      break;
    case "callout":
      body = <CalloutBlock block={block} ops={ops} t={t} editing={editing} onEditStart={onEditStart} />;
      break;
    case "code":
      body = (
        <div className="overflow-hidden rounded-md border border-border bg-muted/60">
          <TextBlockBody block={block} ops={ops} t={t} editing={editing} onEditStart={onEditStart} />
        </div>
      );
      break;
    case "quote":
      body = (
        <div className="border-l-2 border-border pl-3">
          <TextBlockBody block={block} ops={ops} t={t} editing={editing} onEditStart={onEditStart} />
        </div>
      );
      break;
    case "bullet":
      body = (
        <div className="flex gap-2">
          <span className="flex h-8 shrink-0 items-center text-muted-foreground" aria-hidden="true">
            •
          </span>
          <div className="min-w-0 flex-1">
            <TextBlockBody block={block} ops={ops} t={t} editing={editing} onEditStart={onEditStart} />
          </div>
        </div>
      );
      break;
    case "numbered":
      body = (
        <div className="flex gap-2">
          <span
            className="flex h-8 shrink-0 items-center font-mono text-xs text-muted-foreground"
            aria-hidden="true"
          >
            {numberedIndexFor(siblingList, index)}.
          </span>
          <div className="min-w-0 flex-1">
            <TextBlockBody block={block} ops={ops} t={t} editing={editing} onEditStart={onEditStart} />
          </div>
        </div>
      );
      break;
    case "todo":
      body = (
        <div className="flex gap-2">
          <input
            type="checkbox"
            checked={block.checked ?? false}
            onChange={(e) => ops.updateBlock(block.id, { checked: e.target.checked })}
            data-testid="gaia-todo-check"
            aria-label={t("gaia.blocks.toggleTodo")}
            className="mt-2.5 size-3.5 shrink-0 accent-brand-cyan"
          />
          <div className={`min-w-0 flex-1 ${block.checked ? "opacity-60" : ""}`}>
            <TextBlockBody block={block} ops={ops} t={t} editing={editing} onEditStart={onEditStart} />
          </div>
        </div>
      );
      break;
    case "toggle":
      body = <ToggleBlock block={block} ctx={ctx} listId={listId} />;
      break;
    case "columns":
      body = <ColumnsBlock block={block} ctx={ctx} />;
      break;
    case "equation":
      body = <EquationBlock block={block} ops={ops} t={t} />;
      break;
    case "drawing":
      body = <DrawingBlock block={block} ops={ops} t={t} />;
      break;
    case "mermaid":
      body = <MermaidBlock block={block} ops={ops} t={t} />;
      break;
    case "embed":
      body = <EmbedBlock block={block} ops={ops} t={t} />;
      break;
    case "toc":
      body = <TocBlock headings={ctx.headings} onNavigate={ops.navigateToBlock} t={t} />;
      break;
    case "synced":
      body = (
        <div>
          <div className="mb-0.5 flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-sm border border-brand-cyan/40 bg-brand-cyan/10 px-1.5 py-0.5 text-[10px] font-medium text-brand-cyan-deep dark:text-brand-cyan">
              <Link2 className="size-3" aria-hidden="true" />
              {t("gaia.blocks.syncedBadge")}
            </span>
          </div>
          <TextBlockBody block={block} ops={ops} t={t} editing={editing} onEditStart={onEditStart} />
        </div>
      );
      break;
    case "table":
      body = <TableBlock block={block} ops={ops} t={t} />;
      break;
    case "image":
      body = <ImageBlock block={block} ops={ops} t={t} />;
      break;
    case "ref":
      body = <RefBlock block={block} ops={ops} t={t} />;
      break;
    default:
      body = <TextBlockBody block={block} ops={ops} t={t} editing={editing} onEditStart={onEditStart} />;
  }

  const isTextual = TEXT_BLOCK_TYPES.includes(block.type);
  const canNest = depth < 3;

  return (
    <div
      data-testid="gaia-block"
      data-block-id={block.id}
      className={`group/row relative flex gap-1 ${isDragging ? "opacity-40" : ""} ${
        selected ? "rounded-md bg-brand-cyan/5 outline outline-1 outline-brand-cyan/40" : ""
      }`}
      onDragOver={(e) => {
        // Ne pas remonter vers la ligne parente (blocs imbriqués).
        e.stopPropagation();
        ctx.onDragOver(e, block.id, listId);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        ctx.onDrop(block.id, listId);
      }}
    >
      {showAbove ? (
        <span className="absolute inset-x-0 top-[-2px] z-10 h-0.5 bg-brand-cyan" aria-hidden="true" />
      ) : null}
      {showBelow ? (
        <span className="absolute inset-x-0 bottom-[-2px] z-10 h-0.5 bg-brand-cyan" aria-hidden="true" />
      ) : null}
      <div
        className={`flex w-6 shrink-0 flex-col items-center pt-1 transition-opacity ${
          ctx.selectionMode || selected
            ? "opacity-100"
            : "opacity-0 group-hover/row:opacity-100 focus-within:opacity-100"
        }`}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={() => ctx.onToggleSelect(block.id)}
          aria-label={t("gaia.blocks.selectBlock")}
          className="mb-0.5 size-3.5 shrink-0 accent-brand-cyan"
        />
        <span
          draggable
          role="button"
          tabIndex={0}
          aria-label={t("gaia.blocks.dragReorder")}
          title={t("gaia.blocks.dragReorderTitle")}
          className="cursor-grab rounded p-0.5 text-muted-foreground hover:bg-muted active:cursor-grabbing"
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            ctx.onDragStart(block.id);
          }}
          onDragEnd={ctx.onDragEnd}
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </span>
        <button
          type="button"
          aria-label={t("gaia.blocks.commentsTitle")}
          title={t("gaia.blocks.commentsTitle")}
          onClick={() => ctx.onToggleComments(block.id)}
          className={`relative rounded p-0.5 text-muted-foreground hover:bg-muted ${
            openComments ? "bg-muted text-foreground" : ""
          }`}
        >
          <MessageSquare className="size-4" aria-hidden="true" />
          {openCommentCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex size-3 items-center justify-center rounded-full bg-brand-coral text-[8px] font-bold text-white">
              {openCommentCount}
            </span>
          ) : null}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t("gaia.blocks.blockOptions")}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted"
            >
              <MoreVertical className="size-4" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {isTextual ? (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  {t("gaia.blocks.turnInto")}
                  <ChevronRight className="ml-auto size-3.5" aria-hidden="true" />
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {TURN_INTO_TYPES.map((type) => (
                    <DropdownMenuItem
                      key={type}
                      disabled={type === block.type}
                      onClick={() => {
                        const patch: Partial<GaiaBlock> = { type, text: block.text };
                        if (type === "todo") patch.checked = false;
                        else patch.checked = undefined;
                        if (type === "toggle") {
                          patch.children = [{ id: newBlockId(), type: "paragraph", text: "" }];
                          patch.collapsed = false;
                        } else {
                          patch.children = undefined;
                          patch.columns = undefined;
                          patch.collapsed = undefined;
                        }
                        if (type === "synced") {
                          patch.syncId = undefined; // makeSynced génère l'id
                          ops.updateBlock(block.id, patch);
                          ops.makeSynced(block.id);
                        } else {
                          patch.syncId = undefined;
                          ops.updateBlock(block.id, patch);
                        }
                        ops.focusBlock(block.id, "end");
                      }}
                    >
                      {t("gaia.blocks.turnInto")} {blockTypeLabel(type, t)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ) : null}
            <DropdownMenuItem onClick={() => ops.duplicateBlock(block.id)}>
              <Copy className="size-3.5" aria-hidden="true" />
              {t("gaia.shared.duplicate")}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={index === 0} onClick={() => ops.moveBlock(block.id, -1)}>
              <ArrowUp className="size-3.5" aria-hidden="true" />
              {t("gaia.blocks.moveUp")}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={index === total - 1}
              onClick={() => ops.moveBlock(block.id, 1)}
            >
              <ArrowDown className="size-3.5" aria-hidden="true" />
              {t("gaia.blocks.moveDown")}
            </DropdownMenuItem>
            {canNest ? (
              <DropdownMenuItem onClick={() => ops.indentBlock(block.id)}>
                {t("gaia.blocks.indent")}
              </DropdownMenuItem>
            ) : null}
            {depth > 0 ? (
              <DropdownMenuItem onClick={() => ops.outdentBlock(block.id)}>
                {t("gaia.blocks.outdent")}
              </DropdownMenuItem>
            ) : null}
            {block.type !== "synced" && isTextual ? (
              <DropdownMenuItem onClick={() => ops.makeSynced(block.id)}>
                <Link2 className="size-3.5" aria-hidden="true" />
                {t("gaia.blocks.makeSynced")}
              </DropdownMenuItem>
            ) : null}
            {block.type === "synced" ? (
              <DropdownMenuItem onClick={() => ops.openCopySynced(block.id)}>
                <Link2 className="size-3.5" aria-hidden="true" />
                {t("gaia.blocks.copySyncedToNote")}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={() => ops.openMoveToNote(block.id)}>
              {t("gaia.blocks.moveToNote")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => ctx.onToggleComments(block.id)}>
              <MessageSquare className="size-3.5" aria-hidden="true" />
              {t("gaia.blocks.addComment")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => ops.deleteBlock(block.id)}
              className="text-loss focus:text-loss"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              {t("gaia.blocks.deleteBlock")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="min-w-0 flex-1">
        {body}
        {openComments ? (
          <CommentsPanel block={block} ops={ops} authorName={ctx.authorName} t={t} />
        ) : null}
        {commentCount > 0 && !openComments ? (
          <button
            type="button"
            onClick={() => ctx.onToggleComments(block.id)}
            className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <MessageSquare className="size-3" aria-hidden="true" />
            {commentCount} {t("gaia.blocks.commentsTitle").toLowerCase()}
            {openCommentCount > 0 ? ` (${openCommentCount} ${t("gaia.blocks.commentsOpen")})` : ""}
          </button>
        ) : null}
      </div>
    </div>
  );
}
