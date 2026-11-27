"use client";

/**
 * Gaïa — block editor.
 *
 * Local draft is the source of truth; the server is synced by a 900 ms
 * debounced autosave (single PATCH with the whole draft). Save status is
 * always visible. Slash commands, Markdown shortcuts, drag-and-drop reorder,
 * Ctrl+S / Ctrl+B / Ctrl+I, Markdown + PDF export, version history and the
 * emoji icon picker all live here.
 */
import * as React from "react";
import {
  Download,
  FileDown,
  History,
  Link2,
  ListTree,
  Maximize2,
  Minimize2,
  Star,
  Tag,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { navigate } from "@/lib/router";
import {
  gaiaErrorMessage,
  gaiaRelativeTime,
  newBlockId,
  useCreateGaiaTag,
  useCreateGaiaTemplate,
  useDuplicateGaiaNote,
  useGaiaFolders,
  useGaiaNote,
  useGaiaSettings,
  useGaiaTags,
  useGaiaTodayWords,
  useRestoreGaiaVersion,
  useTrashGaiaNote,
  useUpdateGaiaNote,
  useUpdateGaiaSettings,
  type GaiaBlock,
  type GaiaCover,
  type GaiaNoteProperty,
  type GaiaRefHit,
  type GaiaRefKind,
  type GaiaT,
} from "./gaia-shared";
import {
  BlockList,
  GaiaSlashMenu,
  slashItemsFor,
  TEXT_BLOCK_TYPES,
  type BlockRowContext,
  type DragState,
  type GaiaBlockOps,
  type GaiaCustomSlashCommand,
  type GaiaSlashItem,
} from "./gaia-blocks";
import {
  CoverBar,
  CustomSlashDialog,
  FormatToolbar,
  loadCustomSlashCommands,
  MoveToNoteDialog,
  MultiSelectBar,
  OutlinePanel,
  saveCustomSlashCommands,
  StatsPopover,
  type EditorStats,
  type FormatKind,
} from "./gaia-editor-panels";
import { stripInlineMarkers } from "@/lib/gaia/inline";
import { LinksPanel } from "./gaia-links-panel";
import { PropertiesPanel } from "./gaia-properties";
import {
  childrenListId,
  countBlocksDeep,
  extractHeadings,
  findBlock,
  findBlockLocation,
  flattenBlocks,
  getList,
  insertIntoList,
  moveBlockDeep,
  removeBlockDeep,
  ROOT_LIST_ID,
  syncTextAcross,
  updateBlockDeep,
  updateList,
  visibleFlatBlocks,
  type BlockListId,
} from "@/lib/gaia/tree";
import { IconPicker, RefPickerDialog, VersionsDialog } from "./gaia-editor-dialogs";
import { NotePrintDialog } from "./gaia-print";

export type SaveStatus = "saved" | "dirty" | "saving" | "error";

interface DraftState {
  title: string;
  icon: string | null;
  folderId: string | null;
  tagIds: string[];
  favorite: boolean;
  blocks: GaiaBlock[];
  /** Module 1 : couverture (JSON sérialisé, null = aucune). */
  cover: string | null;
  /** Module 1 : objectif d'écriture de la note (mots), null = aucun. */
  wordGoal: number | null;
  /** Module 2 (K13) : propriétés personnalisées. */
  properties: GaiaNoteProperty[];
}

function emptyDraft(): DraftState {
  return {
    title: "",
    icon: null,
    folderId: null,
    tagIds: [],
    favorite: false,
    blocks: [{ id: newBlockId(), type: "paragraph", text: "" }],
    cover: null,
    wordGoal: null,
    properties: [],
  };
}

/** Clone profond avec nouveaux ids (la copie synchronisée garde son syncId). */
function cloneBlockDeep(block: GaiaBlock): GaiaBlock {
  const next: GaiaBlock = { ...structuredClone(block), id: newBlockId() };
  if (block.children) next.children = block.children.map(cloneBlockDeep);
  if (block.columns) next.columns = block.columns.map((col) => col.map(cloneBlockDeep));
  return next;
}

function newSyncId(): string {
  return `sy-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

/** Statistiques avancées (E11) : mots visibles (marqueurs exclus), caractères, etc. */
function editorStats(blocks: GaiaBlock[]): EditorStats {
  const flat = flattenBlocks(blocks);
  let words = 0;
  let chars = 0;
  for (const block of flat) {
    const text = stripInlineMarkers(block.text);
    if (text.trim() !== "") words += text.trim().split(/\s+/).length;
    chars += text.replace(/\s+/g, "").length;
    if (block.type === "table" && block.rows) {
      for (const row of block.rows) {
        for (const cell of row) {
          if (cell.trim() !== "") words += cell.trim().split(/\s+/).length;
          chars += cell.replace(/\s+/g, "").length;
        }
      }
    }
  }
  const paragraphs = flat.filter((b) =>
    ["paragraph", "bullet", "numbered", "todo", "quote", "callout", "toggle", "synced"].includes(
      b.type,
    ),
  ).length;
  const todos = flat.filter((b) => b.type === "todo");
  return {
    words,
    chars,
    paragraphs,
    headings: extractHeadings(blocks).length,
    todosOpen: todos.filter((b) => !b.checked).length,
    todosTotal: todos.length,
    readingMinutes: Math.max(1, Math.ceil(words / 200)),
  };
}

/** Lignes Markdown d'une liste de blocs (récursif : enfants + colonnes). */
export function blocksToMarkdownLines(blocks: GaiaBlock[], t: GaiaT): string[] {
  const lines: string[] = [];
  const refLabel = (kind: GaiaRefKind) => t(`gaia.refKinds.${kind.toLowerCase()}`);
  const pushChildren = (block: GaiaBlock, depth: number) => {
    if (block.type !== "toggle" && block.type !== "columns" && block.children) {
      lines.push(...blocksToMarkdownLinesDepth(block.children, t, depth + 1));
    }
  };
  const walk = (list: GaiaBlock[], depth: number) => {
    const indent = "  ".repeat(depth);
    for (const block of list) {
      switch (block.type) {
        case "h1":
          lines.push(`${indent}# ${block.text}`, "");
          break;
        case "h2":
          lines.push(`${indent}## ${block.text}`, "");
          break;
        case "h3":
          lines.push(`${indent}### ${block.text}`, "");
          break;
        case "bullet":
          lines.push(`${indent}- ${block.text}`);
          break;
        case "numbered":
          lines.push(`${indent}1. ${block.text}`);
          break;
        case "todo":
          lines.push(`${indent}- [${block.checked ? "x" : " "}] ${block.text}`);
          break;
        case "quote":
          lines.push(`${indent}> ${block.text}`, "");
          break;
        case "callout":
          lines.push(`${indent}> **${(block.tone ?? "info").toUpperCase()}** — ${block.text}`, "");
          break;
        case "code":
          lines.push(`${indent}\`\`\``, block.text, "```", "");
          break;
        case "divider":
          lines.push(`${indent}---`, "");
          break;
        case "image": {
          if (block.src) lines.push(`${indent}![${block.alt ?? block.caption ?? "image"}](${block.src})`);
          if (block.caption) lines.push(`${indent}*${block.caption}*`);
          lines.push("");
          break;
        }
        case "table": {
          const rows = block.rows ?? [];
          if (rows.length > 0) {
            lines.push(`${indent}| ${rows[0]!.join(" | ")} |`);
            lines.push(`${indent}| ${rows[0]!.map(() => "---").join(" | ")} |`);
            for (const row of rows.slice(1)) lines.push(`${indent}| ${row.join(" | ")} |`);
            lines.push("");
          }
          break;
        }
        case "ref": {
          if (block.ref) {
            const kindLabel = refLabel(block.ref.kind);
            const label = block.ref.label ?? kindLabel;
            lines.push(
              `${indent}> **${kindLabel}** — ${label}${block.ref.href ? ` (${block.ref.href})` : ""}`,
              "",
            );
          }
          break;
        }
        case "toggle":
          lines.push(`${indent}**${block.text}**`, "");
          if (block.children) lines.push(...blocksToMarkdownLinesDepth(block.children, t, depth + 1));
          break;
        case "columns":
          for (const col of block.columns ?? []) {
            lines.push(...blocksToMarkdownLinesDepth(col, t, depth));
            lines.push("");
          }
          break;
        case "equation":
          lines.push(`${indent}$$${block.text}$$`, "");
          break;
        case "drawing":
          if (block.src) lines.push(`${indent}![drawing](${block.src})`, "");
          break;
        case "mermaid":
          lines.push(`${indent}\`\`\`mermaid`, block.text, "```", "");
          break;
        case "embed":
          if (block.text.trim() !== "") lines.push(`${indent}[${block.text}](${block.text})`, "");
          break;
        case "toc":
          lines.push(`${indent}<!-- table of contents -->`, "");
          break;
        case "synced":
          lines.push(`${indent}${block.text}`, "");
          break;
        default:
          lines.push(`${indent}${block.text}`, "");
      }
      pushChildren(block, depth);
    }
  };
  walk(blocks, 0);
  return lines;
}

function blocksToMarkdownLinesDepth(blocks: GaiaBlock[], t: GaiaT, depth: number): string[] {
  const lines: string[] = [];
  const indent = "  ".repeat(depth);
  for (const block of blocks) {
    const sub = blocksToMarkdownLines([block], t).map((l) =>
      l === "" ? "" : `${indent}${l}`,
    );
    lines.push(...sub);
  }
  return lines;
}

export function blocksToMarkdown(
  title: string,
  blocks: GaiaBlock[],
  t: GaiaT,
): string {
  const lines: string[] = [`# ${title === "" ? t("gaia.shared.untitledNote") : title}`, ""];
  lines.push(...blocksToMarkdownLines(blocks, t));
  return lines.join("\n");
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug === "" ? "note" : slug;
}

export function GaiaEditor({
  noteId,
  onClose,
  onOpenNote,
  focusMode,
  onToggleFocusMode,
}: {
  noteId: string;
  onClose: () => void;
  onOpenNote: (noteId: string) => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
}) {
  const t = useTranslations();
  const tr = React.useCallback<GaiaT>((key) => t(key), [t]);
  const { toast } = useToast();
  const noteQuery = useGaiaNote(noteId);
  const foldersQuery = useGaiaFolders();
  const tagsQuery = useGaiaTags();
  const updateNote = useUpdateGaiaNote();
  const trashNote = useTrashGaiaNote();
  const duplicateNote = useDuplicateGaiaNote();
  const createTag = useCreateGaiaTag();
  const createTemplate = useCreateGaiaTemplate();
  const restoreVersion = useRestoreGaiaVersion();
  const queryClient = useQueryClient();
  const settingsQuery = useGaiaSettings();
  const todayQuery = useGaiaTodayWords();
  const updateSettings = useUpdateGaiaSettings();
  // Auteur des commentaires : nom d'affichage de la session.
  const meQuery = useQuery({
    queryKey: ["gaia", "me"],
    queryFn: () =>
      apiFetch<{ user: { displayName?: string }; profile?: { displayName?: string } }>(
        "/api/auth/me",
      ),
    staleTime: 60_000,
  });
  const authorName =
    meQuery.data?.profile?.displayName ?? meQuery.data?.user?.displayName ?? "";

  const [draft, setDraft] = React.useState<DraftState | null>(null);
  const [status, setStatus] = React.useState<SaveStatus>("saved");
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const [versionsOpen, setVersionsOpen] = React.useState(false);
  const [printOpen, setPrintOpen] = React.useState(false);
  const [refPicker, setRefPicker] = React.useState<{
    open: boolean;
    kind: GaiaRefKind | "";
    sourceBlockId: string | null;
  }>({ open: false, kind: "", sourceBlockId: null });
  const [slash, setSlash] = React.useState<{
    blockId: string;
    query: string;
    rect: { top: number; left: number };
  } | null>(null);
  const [slashActive, setSlashActive] = React.useState(0);
  const [dragState, setDragState] = React.useState<DragState>({
    dragId: null,
    overId: null,
    overListId: null,
    position: null,
  });
  const [newTagName, setNewTagName] = React.useState("");
  const [restoringId, setRestoringId] = React.useState<string | null>(null);
  // Module 1 — édition / sommaire / sélection / commentaires / dialogues.
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [outlineOpen, setOutlineOpen] = React.useState(false);
  // Module 2 (K02–K04, K08, K14) : panneau Liens (backlinks, mentions,
  // relations, suggestions). Exclusif avec le sommaire.
  const [linksOpen, setLinksOpen] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<ReadonlySet<string>>(new Set());
  const [openCommentsId, setOpenCommentsId] = React.useState<string | null>(null);
  const [moveDialog, setMoveDialog] = React.useState<{
    open: boolean;
    mode: "move" | "copySynced";
    blockIds: string[];
  }>({ open: false, mode: "move", blockIds: [] });
  const [customSlashOpen, setCustomSlashOpen] = React.useState(false);
  const [customCommands, setCustomCommands] = React.useState<GaiaCustomSlashCommand[]>(() =>
    typeof window === "undefined" ? [] : loadCustomSlashCommands(),
  );
  const dailyGoalTimerRef = React.useRef<number | null>(null);

  const draftRef = React.useRef<DraftState | null>(null);
  const dirtyRef = React.useRef(false);
  const saveTimerRef = React.useRef<number | null>(null);
  const textAreasRef = React.useRef(new Map<string, HTMLTextAreaElement>());
  const pendingFocusRef = React.useRef<{ id: string; at: "start" | "end" } | null>(null);
  const slashAnchorRef = React.useRef<HTMLElement | null>(null);
  const lastAdoptedUpdatedAtRef = React.useRef<string | null>(null);

  const serverNote = noteQuery.data?.note ?? null;

  const setDraftState = React.useCallback((next: DraftState) => {
    draftRef.current = next;
    setDraft(next);
  }, []);

  const flushSave = React.useCallback(async () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const current = draftRef.current;
    if (!current || !dirtyRef.current) return;
    setStatus("saving");
    try {
      const res = await updateNote.mutateAsync({
        noteId,
        patch: {
          title: current.title,
          icon: current.icon,
          folderId: current.folderId,
          tagIds: current.tagIds,
          favorite: current.favorite,
          blocks: current.blocks,
          cover: current.cover,
          wordGoal: current.wordGoal,
          properties: current.properties,
        },
      });
      dirtyRef.current = false;
      lastAdoptedUpdatedAtRef.current = res.note.updatedAt;
      setSavedAt(res.note.updatedAt);
      setStatus("saved");
    } catch (err) {
      dirtyRef.current = true;
      setStatus("error");
      toast({ variant: "destructive", title: gaiaErrorMessage(err) });
    }
  }, [noteId, toast, updateNote]);

  const flushSaveRef = React.useRef(flushSave);
  React.useEffect(() => {
    flushSaveRef.current = flushSave;
  });

  const scheduleSave = React.useCallback(() => {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => void flushSaveRef.current(), 900);
  }, []);

  const applyDraft = React.useCallback(
    (updater: (d: DraftState) => DraftState) => {
      const current = draftRef.current;
      if (!current) return;
      const next = updater(current);
      setDraftState(next);
      dirtyRef.current = true;
      setStatus((s) => (s === "saving" ? s : "dirty"));
      scheduleSave();
    },
    [scheduleSave, setDraftState],
  );

  // Adopt the server note into the local draft — never while edits are pending.
  React.useEffect(() => {
    if (!serverNote) return;
    if (dirtyRef.current) return;
    if (lastAdoptedUpdatedAtRef.current === serverNote.updatedAt && draftRef.current) return;
    lastAdoptedUpdatedAtRef.current = serverNote.updatedAt;
    const next: DraftState = {
      title: serverNote.title,
      icon: serverNote.icon,
      folderId: serverNote.folderId,
      tagIds: [...serverNote.tagIds],
      favorite: serverNote.favorite,
      blocks:
        serverNote.blocks.length > 0
          ? serverNote.blocks
          : [{ id: newBlockId(), type: "paragraph", text: "" }],
      cover: serverNote.cover ?? null,
      wordGoal: serverNote.wordGoal ?? null,
      properties: serverNote.properties ?? [],
    };
    setDraftState(next);
    setSavedAt(serverNote.updatedAt);
    setStatus("saved");
  }, [serverNote, setDraftState]);

  // Flush pending edits on unmount or when switching notes.
  React.useEffect(() => {
    return () => {
      void flushSaveRef.current();
    };
  }, [noteId]);

  // Pending focus (after split / insert / duplicate).
  React.useEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending) return;
    pendingFocusRef.current = null;
    const el = textAreasRef.current.get(pending.id);
    if (el) {
      el.focus();
      const pos = pending.at === "end" ? el.value.length : 0;
      el.setSelectionRange(pos, pos);
    }
  }, [draft]);

  // Focus the textarea when a block enters edit mode (preview → édition).
  React.useEffect(() => {
    if (!editingId) return;
    const el = textAreasRef.current.get(editingId);
    if (el) {
      el.focus();
      const pos = el.value.length;
      el.setSelectionRange(pos, pos);
    }
  }, [editingId]);

  // Reposition the slash menu on any scroll / resize (never close it).
  React.useEffect(() => {
    if (!slash) return;
    const reposition = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('[data-testid="gaia-slash-menu"]')) return;
      const anchor = slashAnchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      setSlash({ blockId: slash.blockId, query: slash.query, rect: { top: rect.bottom + 4, left: rect.left } });
    };
    document.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [slash]);

  const focusBlock = React.useCallback((id: string, at: "start" | "end") => {
    setEditingId(id);
    pendingFocusRef.current = { id, at };
    const el = textAreasRef.current.get(id);
    if (el) {
      el.focus();
      const pos = at === "end" ? el.value.length : 0;
      el.setSelectionRange(pos, pos);
      pendingFocusRef.current = null;
    }
  }, []);

  const ops: GaiaBlockOps = React.useMemo(
    () => ({
      updateText: (id, text) => {
        const d = draftRef.current;
        if (!d) return;
        const block = findBlock(d.blocks, id);
        if (!block) return;
        // E08 : éditer une copie synchronisée propage le texte aux autres copies.
        if (block.type === "synced" && block.syncId) {
          const syncId = block.syncId;
          applyDraft((prev) => ({
            ...prev,
            blocks: syncTextAcross(
              updateBlockDeep(prev.blocks, id, { text }),
              syncId,
              text,
            ),
          }));
        } else {
          applyDraft((prev) => ({
            ...prev,
            blocks: updateBlockDeep(prev.blocks, id, { text }),
          }));
        }
      },
      updateBlock: (id, patch) => {
        applyDraft((prev) => ({
          ...prev,
          blocks: updateBlockDeep(prev.blocks, id, patch),
        }));
      },
      splitBlock: (id, at) => {
        const d = draftRef.current;
        if (!d) return;
        const loc = findBlockLocation(d.blocks, id);
        if (!loc) return;
        const list = getList(d.blocks, loc.listId);
        if (!list) return;
        const block = list[loc.index];
        const before = block.text.slice(0, at);
        const after = block.text.slice(at);
        const keepType =
          block.type === "bullet" || block.type === "numbered" || block.type === "todo";
        const nextBlock: GaiaBlock = {
          id: newBlockId(),
          type: keepType ? block.type : "paragraph",
          text: after,
          checked: block.type === "todo" ? false : undefined,
        };
        pendingFocusRef.current = { id: nextBlock.id, at: "start" };
        applyDraft((prev) => {
          let blocks = updateBlockDeep(prev.blocks, id, { text: before });
          blocks = insertIntoList(blocks, loc.listId, loc.index + 1, nextBlock);
          return { ...prev, blocks };
        });
      },
      mergeBackward: (id) => {
        const d = draftRef.current;
        if (!d) return;
        const loc = findBlockLocation(d.blocks, id);
        if (!loc) return;
        const list = getList(d.blocks, loc.listId);
        if (!list) return;
        const block = list[loc.index];
        if (loc.index > 0) {
          const prev = list[loc.index - 1];
          if (TEXT_BLOCK_TYPES.includes(prev.type)) {
            const at = prev.text.length;
            const merged = prev.text + block.text;
            const el = textAreasRef.current.get(prev.id);
            if (el) {
              // Uncontrolled field: write the merged text in the DOM directly.
              el.value = merged;
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
              el.focus();
              el.setSelectionRange(at, at);
            } else {
              pendingFocusRef.current = { id: prev.id, at: "end" };
            }
            applyDraft((p) => {
              let blocks = updateBlockDeep(p.blocks, prev.id, { text: merged });
              blocks = removeBlockDeep(blocks, id).blocks;
              return { ...p, blocks };
            });
          } else if (block.text === "") {
            pendingFocusRef.current = { id: prev.id, at: "end" };
            applyDraft((p) => ({ ...p, blocks: removeBlockDeep(p.blocks, id).blocks }));
          }
          return;
        }
        // Premier de sa liste : remonter vers le parent.
        if (loc.parentId) {
          const parent = findBlock(d.blocks, loc.parentId);
          if (block.text === "") {
            pendingFocusRef.current = { id: loc.parentId, at: "end" };
            applyDraft((p) => ({ ...p, blocks: removeBlockDeep(p.blocks, id).blocks }));
          } else if (parent && TEXT_BLOCK_TYPES.includes(parent.type)) {
            const at = parent.text.length;
            const merged = parent.text + block.text;
            pendingFocusRef.current = { id: parent.id, at: "end" };
            applyDraft((p) => {
              let blocks = updateBlockDeep(p.blocks, parent.id, { text: merged });
              blocks = removeBlockDeep(blocks, id).blocks;
              return { ...p, blocks };
            });
          } else {
            // Parent non textuel : on sort le bloc après le parent.
            const parentLoc = findBlockLocation(d.blocks, loc.parentId);
            if (parentLoc) {
              applyDraft((p) => ({
                ...p,
                blocks: moveBlockDeep(p.blocks, id, parentLoc.listId, parentLoc.index + 1),
              }));
            }
          }
        } else if (block.text === "" && d.blocks.length > 1) {
          const blocks = d.blocks.slice(1);
          pendingFocusRef.current = { id: blocks[0].id, at: "start" };
          applyDraft((prev) => ({ ...prev, blocks }));
        }
      },
      deleteBlock: (id) => {
        const d = draftRef.current;
        if (!d) return;
        const visible = visibleFlatBlocks(d.blocks);
        const idx = visible.findIndex((b) => b.id === id);
        let blocks = removeBlockDeep(d.blocks, id).blocks;
        if (countBlocksDeep(blocks) === 0) {
          blocks = [{ id: newBlockId(), type: "paragraph", text: "" }];
        }
        const neighbor = visible[Math.min(Math.max(idx - 1, 0), visible.length - 1)];
        if (neighbor && neighbor.id !== id) {
          pendingFocusRef.current = { id: neighbor.id, at: "end" };
        }
        applyDraft((p) => ({ ...p, blocks }));
      },
      duplicateBlock: (id) => {
        const d = draftRef.current;
        if (!d) return;
        const loc = findBlockLocation(d.blocks, id);
        if (!loc) return;
        const block = findBlock(d.blocks, id);
        if (!block) return;
        const copy = cloneBlockDeep(block);
        pendingFocusRef.current = { id: copy.id, at: "end" };
        applyDraft((p) => ({
          ...p,
          blocks: insertIntoList(p.blocks, loc.listId, loc.index + 1, copy),
        }));
      },
      moveBlock: (id, dir) => {
        const d = draftRef.current;
        if (!d) return;
        const loc = findBlockLocation(d.blocks, id);
        if (!loc) return;
        const list = getList(d.blocks, loc.listId);
        if (!list) return;
        const swap = loc.index + dir;
        if (swap < 0 || swap >= list.length) return;
        applyDraft((p) => ({
          ...p,
          blocks: updateList(p.blocks, loc.listId, (l) => {
            const next = [...l];
            [next[loc.index], next[swap]] = [next[swap], next[loc.index]];
            return next;
          }),
        }));
      },
      reorder: (dragId, targetId, position) => {
        const d = draftRef.current;
        if (!d || dragId === targetId) return;
        const loc = findBlockLocation(d.blocks, targetId);
        if (!loc) return;
        applyDraft((p) => ({
          ...p,
          blocks: moveBlockDeep(
            p.blocks,
            dragId,
            loc.listId,
            loc.index + (position === "below" ? 1 : 0),
          ),
        }));
      },
      moveBlockToList: (dragId, targetListId, targetIndex) => {
        applyDraft((p) => ({
          ...p,
          blocks: moveBlockDeep(p.blocks, dragId, targetListId, targetIndex),
        }));
      },
      focusBlock,
      focusNeighbor: (id, dir) => {
        const d = draftRef.current;
        if (!d) return;
        const visible = visibleFlatBlocks(d.blocks);
        const idx = visible.findIndex((b) => b.id === id);
        for (let i = idx + dir; i >= 0 && i < visible.length; i += dir) {
          if (!TEXT_BLOCK_TYPES.includes(visible[i].type)) continue;
          const el = textAreasRef.current.get(visible[i].id);
          if (el) {
            el.focus();
            const pos = dir === 1 ? 0 : el.value.length;
            el.setSelectionRange(pos, pos);
          }
          return;
        }
      },
      registerTextArea: (id, el) => {
        if (el) textAreasRef.current.set(id, el);
        else textAreasRef.current.delete(id);
      },
      openRefPicker: (kind, sourceBlockId) => {
        setRefPicker({ open: true, kind, sourceBlockId });
        setSlash(null);
      },
      navigateToRef: (href) => {
        void flushSaveRef.current().then(() => {
          // Legacy "#/..." refs stored in old notes still navigate.
          if (href.startsWith("#/") || href.startsWith("/")) navigate(href);
          else window.location.href = href;
        });
      },
      openSlashMenu: (blockId, query, anchor) => {
        slashAnchorRef.current = anchor;
        const rect = anchor.getBoundingClientRect();
        setSlash({ blockId, query, rect: { top: rect.bottom + 4, left: rect.left } });
        setSlashActive(0);
      },
      closeSlashMenu: () => setSlash(null),
      clearEditing: () => setEditingId(null),
      indentBlock: (id) => {
        const d = draftRef.current;
        if (!d) return;
        const loc = findBlockLocation(d.blocks, id);
        if (!loc || loc.depth >= 3 || loc.index === 0) return;
        const list = getList(d.blocks, loc.listId);
        if (!list) return;
        const prev = list[loc.index - 1];
        const block = findBlock(d.blocks, id);
        if (!block || !prev) return;
        const without = removeBlockDeep(d.blocks, id).blocks;
        const targetListId = childrenListId(prev.id);
        const target = getList(without, targetListId) ?? [];
        applyDraft((p) => ({
          ...p,
          blocks: insertIntoList(without, targetListId, target.length, block),
        }));
      },
      outdentBlock: (id) => {
        const d = draftRef.current;
        if (!d) return;
        const loc = findBlockLocation(d.blocks, id);
        if (!loc || loc.depth === 0 || !loc.parentId) return;
        const parentLoc = findBlockLocation(d.blocks, loc.parentId);
        if (!parentLoc) return;
        const block = findBlock(d.blocks, id);
        if (!block) return;
        const without = removeBlockDeep(d.blocks, id).blocks;
        applyDraft((p) => ({
          ...p,
          blocks: insertIntoList(without, parentLoc.listId, parentLoc.index + 1, block),
        }));
      },
      toggleCollapse: (id) => {
        const d = draftRef.current;
        if (!d) return;
        const block = findBlock(d.blocks, id);
        if (!block) return;
        applyDraft((p) => ({
          ...p,
          blocks: updateBlockDeep(p.blocks, id, { collapsed: !(block.collapsed ?? false) }),
        }));
      },
      addColumn: (id) => {
        const d = draftRef.current;
        if (!d) return;
        const block = findBlock(d.blocks, id);
        if (!block) return;
        const newColumn: GaiaBlock[] = [{ id: newBlockId(), type: "paragraph", text: "" }];
        const columns: GaiaBlock[][] = [...(block.columns ?? [[], []]), newColumn];
        applyDraft((p) => ({ ...p, blocks: updateBlockDeep(p.blocks, id, { columns }) }));
      },
      removeColumn: (id, colIndex) => {
        const d = draftRef.current;
        if (!d) return;
        const block = findBlock(d.blocks, id);
        if (!block) return;
        const columns = [...(block.columns ?? [])];
        const removed = columns.splice(colIndex, 1)[0] ?? [];
        if (columns.length === 0) {
          // Dernière colonne : on déplie ses blocs dans la liste parente.
          const loc = findBlockLocation(d.blocks, id);
          if (!loc) return;
          const without = removeBlockDeep(d.blocks, id).blocks;
          let next = without;
          removed.forEach((b, i) => {
            next = insertIntoList(next, loc.listId, loc.index + i, b);
          });
          applyDraft((p) => ({ ...p, blocks: next }));
          return;
        }
        const target = colIndex > 0 ? colIndex - 1 : 0;
        columns[target] = [...columns[target], ...removed];
        applyDraft((p) => ({ ...p, blocks: updateBlockDeep(p.blocks, id, { columns }) }));
      },
      addBlockToList: (listId) => {
        const block: GaiaBlock = { id: newBlockId(), type: "paragraph", text: "" };
        pendingFocusRef.current = { id: block.id, at: "start" };
        applyDraft((p) => ({
          ...p,
          blocks: insertIntoList(
            p.blocks,
            listId,
            getList(p.blocks, listId)?.length ?? 0,
            block,
          ),
        }));
      },
      addComment: (blockId, text, author) => {
        const d = draftRef.current;
        if (!d) return;
        const block = findBlock(d.blocks, blockId);
        if (!block) return;
        const comment = {
          id: `cm-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`,
          author,
          text,
          createdAt: new Date().toISOString(),
          resolved: false,
        };
        applyDraft((p) => ({
          ...p,
          blocks: updateBlockDeep(p.blocks, blockId, {
            comments: [...(block.comments ?? []), comment],
          }),
        }));
      },
      toggleCommentResolved: (blockId, commentId) => {
        const d = draftRef.current;
        if (!d) return;
        const block = findBlock(d.blocks, blockId);
        if (!block) return;
        const comments = (block.comments ?? []).map((c) =>
          c.id === commentId ? { ...c, resolved: !c.resolved } : c,
        );
        applyDraft((p) => ({
          ...p,
          blocks: updateBlockDeep(p.blocks, blockId, { comments }),
        }));
      },
      deleteComment: (blockId, commentId) => {
        const d = draftRef.current;
        if (!d) return;
        const block = findBlock(d.blocks, blockId);
        if (!block) return;
        const comments = (block.comments ?? []).filter((c) => c.id !== commentId);
        applyDraft((p) => ({
          ...p,
          blocks: updateBlockDeep(p.blocks, blockId, {
            comments: comments.length > 0 ? comments : undefined,
          }),
        }));
      },
      navigateToBlock: (id) => {
        setEditingId(id);
        pendingFocusRef.current = { id, at: "start" };
        requestAnimationFrame(() => {
          document
            .querySelector(`[data-block-id="${id}"]`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
          const el = textAreasRef.current.get(id);
          if (el) {
            el.focus();
            el.setSelectionRange(0, 0);
          }
        });
      },
      openMoveToNote: (blockId) =>
        setMoveDialog({ open: true, mode: "move", blockIds: [blockId] }),
      openCopySynced: (blockId) => {
        const d = draftRef.current;
        const block = d ? findBlock(d.blocks, blockId) : null;
        if (block && block.type !== "synced") ops.makeSynced(blockId);
        setMoveDialog({ open: true, mode: "copySynced", blockIds: [blockId] });
      },
      makeSynced: (id) => {
        const d = draftRef.current;
        if (!d) return;
        const block = findBlock(d.blocks, id);
        if (!block || block.type === "synced") return;
        applyDraft((p) => ({
          ...p,
          blocks: updateBlockDeep(p.blocks, id, { type: "synced", syncId: newSyncId() }),
        }));
      },
    }),
    [applyDraft, focusBlock],
  );

  const applySlashItem = React.useCallback(
    (item: GaiaSlashItem) => {
      if (!slash) return;
      const sourceId = slash.blockId;
      if (item.type === "ref") {
        ops.updateText(sourceId, "");
        ops.openRefPicker(item.refKind ?? "", sourceId);
        return;
      }
      if (item.type === "divider") {
        ops.updateBlock(sourceId, { type: "divider", text: "" });
        const d = draftRef.current;
        if (d) {
          const loc = findBlockLocation(d.blocks, sourceId);
          if (loc) {
            const para: GaiaBlock = { id: newBlockId(), type: "paragraph", text: "" };
            pendingFocusRef.current = { id: para.id, at: "start" };
            applyDraft((p) => ({
              ...p,
              blocks: insertIntoList(p.blocks, loc.listId, loc.index + 1, para),
            }));
          }
        }
        setSlash(null);
        return;
      }
      if (item.type === "table") {
        ops.updateBlock(sourceId, {
          type: "table",
          text: "",
          rows: [
            [t("gaia.slash.seed.condition"), t("gaia.slash.seed.observation"), t("gaia.slash.seed.result")],
            ["", "", ""],
          ],
        });
      } else if (item.type === "callout") {
        ops.updateBlock(sourceId, { type: "callout", text: item.presetText ?? "", tone: "info" });
      } else if (item.type === "todo") {
        ops.updateBlock(sourceId, { type: "todo", text: item.presetText ?? "", checked: false });
      } else if (item.type === "toggle") {
        ops.updateBlock(sourceId, {
          type: "toggle",
          text: item.presetText ?? "",
          children: [{ id: newBlockId(), type: "paragraph", text: "" }],
          collapsed: false,
        });
      } else if (item.type === "columns") {
        ops.updateBlock(sourceId, {
          type: "columns",
          text: "",
          columns: [
            [{ id: newBlockId(), type: "paragraph", text: item.presetText ?? "" }],
            [{ id: newBlockId(), type: "paragraph", text: "" }],
          ],
        });
      } else if (item.type === "synced") {
        ops.updateBlock(sourceId, {
          type: "synced",
          text: item.presetText ?? "",
          syncId: newSyncId(),
        });
      } else {
        ops.updateBlock(sourceId, { type: item.type, text: item.presetText ?? "" });
      }
      setSlash(null);
      ops.focusBlock(sourceId, "end");
    },
    [slash, ops, applyDraft, t],
  );

  const handleRefPick = React.useCallback(
    (hit: GaiaRefHit) => {
      const sourceId = refPicker.sourceBlockId;
      const refBlock: GaiaBlock = {
        id: newBlockId(),
        type: "ref",
        text: "",
        ref: { kind: hit.kind, id: hit.id, label: hit.label, meta: hit.meta, href: hit.href },
      };
      const d = draftRef.current;
      if (!d) return;
      const loc = sourceId ? findBlockLocation(d.blocks, sourceId) : null;
      if (loc && sourceId) {
        const list = getList(d.blocks, loc.listId) ?? [];
        const source = list[loc.index];
        if (source.type === "paragraph" && source.text === "") {
          applyDraft((p) => ({
            ...p,
            blocks: updateBlockDeep(p.blocks, sourceId, {
              type: "ref",
              text: "",
              ref: refBlock.ref,
            }),
          }));
        } else {
          applyDraft((p) => ({
            ...p,
            blocks: insertIntoList(p.blocks, loc.listId, loc.index + 1, refBlock),
          }));
        }
      } else {
        applyDraft((p) => ({ ...p, blocks: [...p.blocks, refBlock] }));
      }
      setRefPicker((prev) => ({ ...prev, open: false }));
    },
    [applyDraft, refPicker.sourceBlockId],
  );

  const slashItems = React.useMemo(() => {
    if (!slash) return [];
    const all = slashItemsFor(tr, customCommands);
    const q = slash.query.toLowerCase();
    return all.filter(
      (item) =>
        item.cmd.includes(q) ||
        item.label.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q) ||
        (item.keywords ?? "").includes(q),
    );
  }, [slash, tr, customCommands]);

  // ── Module 1 : formatage riche (E01/E02) ───────────────────────────────
  const applyFormat = React.useCallback(
    (kind: FormatKind) => {
      const active = document.activeElement as HTMLTextAreaElement | null;
      let ta: HTMLTextAreaElement | null = null;
      if (active && active.tagName === "TEXTAREA") ta = active;
      else if (editingId) ta = textAreasRef.current.get(editingId) ?? null;
      if (!ta) return;
      const start = ta.selectionStart ?? 0;
      const end = ta.selectionEnd ?? 0;
      const value = ta.value;
      const selected = value.slice(start, end);
      const wrap = (before: string, after: string) => {
        const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          "value",
        )?.set;
        setter?.call(ta, next);
        const cursor =
          selected === "" ? start + before.length : end + before.length + after.length;
        ta.setSelectionRange(cursor, cursor);
        ta.dispatchEvent(new Event("input", { bubbles: true }));
      };
      switch (kind) {
        case "bold":
          wrap("**", "**");
          break;
        case "italic":
          wrap("*", "*");
          break;
        case "underline":
          wrap("__", "__");
          break;
        case "strike":
          wrap("~~", "~~");
          break;
        case "highlight":
          wrap("==", "==");
          break;
        case "code":
          wrap("`", "`");
          break;
        case "clear":
          if (selected !== "") {
            const clean = stripInlineMarkers(selected);
            const next = `${value.slice(0, start)}${clean}${value.slice(end)}`;
            const setter = Object.getOwnPropertyDescriptor(
              window.HTMLTextAreaElement.prototype,
              "value",
            )?.set;
            setter?.call(ta, next);
            ta.setSelectionRange(start + clean.length, start + clean.length);
            ta.dispatchEvent(new Event("input", { bubbles: true }));
          }
          break;
        default:
          if (kind.startsWith("color:")) wrap(`[${kind.slice(6)}]`, "[/]");
          break;
      }
    },
    [editingId],
  );

  // ── Module 1 : déplacement / copie vers une note (E04/E08) ─────────────
  const executeMoveDialog = React.useCallback(
    async (targetNoteId: string) => {
      const d = draftRef.current;
      if (!d || moveDialog.blockIds.length === 0) return;
      const mode = moveDialog.mode;
      const flat = flattenBlocks(d.blocks);
      const moving = moveDialog.blockIds
        .map((id) => flat.find((b) => b.id === id))
        .filter((b): b is GaiaBlock => !!b);
      if (moving.length === 0) return;
      try {
        const target = await apiFetch<{ note: { blocks: GaiaBlock[] } }>(
          `/api/v1/gaia/notes/${targetNoteId}`,
        );
        const targetBlocks = [...target.note.blocks, ...moving.map((b) => structuredClone(b))];
        await apiFetch(`/api/v1/gaia/notes/${targetNoteId}`, {
          method: "PATCH",
          body: JSON.stringify({ blocks: targetBlocks }),
        });
        if (mode === "move") {
          applyDraft((prev) => {
            let blocks = prev.blocks;
            for (const b of moving) blocks = removeBlockDeep(blocks, b.id).blocks;
            if (countBlocksDeep(blocks) === 0) {
              blocks = [{ id: newBlockId(), type: "paragraph", text: "" }];
            }
            return { ...prev, blocks };
          });
          setSelectedIds(new Set());
        }
        await queryClient.invalidateQueries({ queryKey: ["gaia"] });
        toast({
          title: t(mode === "move" ? "gaia.moveToNote.movedToast" : "gaia.moveToNote.copiedToast"),
        });
      } catch (err) {
        toast({ variant: "destructive", title: gaiaErrorMessage(err) });
      } finally {
        setMoveDialog({ open: false, mode: "move", blockIds: [] });
      }
    },
    [moveDialog, queryClient, toast, t],
  );

  // ── Module 1 : sélection multiple (E20) ────────────────────────────────
  const bulkDelete = React.useCallback(() => {
    applyDraft((prev) => {
      let blocks = prev.blocks;
      for (const id of selectedIds) blocks = removeBlockDeep(blocks, id).blocks;
      if (countBlocksDeep(blocks) === 0) {
        blocks = [{ id: newBlockId(), type: "paragraph", text: "" }];
      }
      return { ...prev, blocks };
    });
    setSelectedIds(new Set());
  }, [applyDraft, selectedIds]);

  const bulkDuplicate = React.useCallback(() => {
    applyDraft((prev) => {
      let blocks = prev.blocks;
      const ordered = flattenBlocks(prev.blocks).filter((b) => selectedIds.has(b.id));
      for (const b of ordered) {
        const loc = findBlockLocation(blocks, b.id);
        if (!loc) continue;
        blocks = insertIntoList(blocks, loc.listId, loc.index + 1, cloneBlockDeep(b));
      }
      return { ...prev, blocks };
    });
    setSelectedIds(new Set());
  }, [applyDraft, selectedIds]);

  const bulkTurnInto = React.useCallback(
    (type: GaiaBlock["type"]) => {
      applyDraft((prev) => {
        let blocks = prev.blocks;
        for (const id of selectedIds) {
          const block = findBlock(blocks, id);
          if (!block || !TEXT_BLOCK_TYPES.includes(block.type)) continue;
          blocks = updateBlockDeep(blocks, id, {
            type,
            checked: type === "todo" ? false : undefined,
          });
        }
        return { ...prev, blocks };
      });
      setSelectedIds(new Set());
    },
    [applyDraft, selectedIds],
  );

  const bulkCopy = React.useCallback(() => {
    const d = draftRef.current;
    if (!d) return;
    const ordered = flattenBlocks(d.blocks).filter((b) => selectedIds.has(b.id));
    const md = blocksToMarkdownLines(ordered, tr).join("\n");
    void navigator.clipboard
      .writeText(md)
      .then(() => toast({ title: t("gaia.multiselect.copiedToast") }));
  }, [selectedIds, tr, toast]);

  const bulkMoveToNote = React.useCallback(() => {
    const d = draftRef.current;
    if (!d) return;
    const ordered = flattenBlocks(d.blocks)
      .filter((b) => selectedIds.has(b.id))
      .map((b) => b.id);
    if (ordered.length > 0) setMoveDialog({ open: true, mode: "move", blockIds: ordered });
  }, [selectedIds]);

  const handleDailyGoalChange = React.useCallback(
    (goal: number) => {
      if (dailyGoalTimerRef.current !== null) {
        window.clearTimeout(dailyGoalTimerRef.current);
      }
      dailyGoalTimerRef.current = window.setTimeout(() => {
        void updateSettings.mutateAsync({ dailyWordGoal: goal });
      }, 800);
    },
    [updateSettings],
  );

  const saveCustomCommands = React.useCallback((commands: GaiaCustomSlashCommand[]) => {
    setCustomCommands(commands);
    saveCustomSlashCommands(commands);
  }, []);

  const folders = foldersQuery.data?.folders ?? [];
  const allTags = tagsQuery.data?.tags ?? [];
  const stats = React.useMemo(
    () =>
      draft
        ? editorStats(draft.blocks)
        : { words: 0, chars: 0, paragraphs: 0, headings: 0, todosOpen: 0, todosTotal: 0, readingMinutes: 1 },
    [draft],
  );
  const headings = React.useMemo(
    () => (draft ? extractHeadings(draft.blocks) : []),
    [draft],
  );
  const dailyGoal = settingsQuery.data?.dailyWordGoal ?? 0;
  const wordsToday = todayQuery.data?.wordsToday ?? 0;
  const canFormat = React.useMemo(() => {
    if (!draft || !editingId) return false;
    const block = findBlock(draft.blocks, editingId);
    return !!block && TEXT_BLOCK_TYPES.includes(block.type);
  }, [draft, editingId]);

  const rowCtx: BlockRowContext = React.useMemo(
    () => ({
      ops,
      t: tr,
      editingId,
      onEditStart: (id) => focusBlock(id, "end"),
      selectedIds,
      selectionMode: selectedIds.size > 0,
      onToggleSelect: (id) =>
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }),
      openCommentsId,
      onToggleComments: (id) => setOpenCommentsId((prev) => (prev === id ? null : id)),
      authorName,
      headings,
      dragState,
      onDragStart: (id) => setDragState({ dragId: id, overId: null, overListId: null, position: null }),
      onDragOver: (e, id, listId) => {
        e.preventDefault();
        if (id === "") {
          setDragState((prev) =>
            prev.overId === null && prev.overListId === listId
              ? prev
              : { ...prev, overId: null, overListId: listId, position: null },
          );
          return;
        }
        const rect = e.currentTarget.getBoundingClientRect();
        const position = e.clientY < rect.top + rect.height / 2 ? "above" : "below";
        setDragState((prev) =>
          prev.overId === id && prev.position === position && prev.overListId === listId
            ? prev
            : { ...prev, overId: id, overListId: listId, position },
        );
      },
      onDragEnd: () => setDragState({ dragId: null, overId: null, overListId: null, position: null }),
      onDrop: (id, listId) => {
        if (dragState.dragId) {
          const loc = findBlockLocation(draftRef.current?.blocks ?? [], id);
          if (loc) {
            ops.moveBlockToList(
              dragState.dragId,
              loc.listId,
              loc.index + (dragState.position === "below" ? 1 : 0),
            );
          }
        }
        setDragState({ dragId: null, overId: null, overListId: null, position: null });
      },
      onDropInto: (listId, index) => {
        if (dragState.dragId) ops.moveBlockToList(dragState.dragId, listId, index);
        setDragState({ dragId: null, overId: null, overListId: null, position: null });
      },
    }),
    [
      ops,
      tr,
      editingId,
      selectedIds,
      openCommentsId,
      authorName,
      headings,
      dragState,
      focusBlock,
    ],
  );

  const handleKeyDownCapture = (e: React.KeyboardEvent) => {
    if (slash) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setSlashActive((i) => Math.min(slashItems.length - 1, i + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setSlashActive((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "Enter" && slashItems[slashActive]) {
        e.preventDefault();
        e.stopPropagation();
        applySlashItem(slashItems[slashActive]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setSlash(null);
        return;
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      void flushSave();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && ["b", "i", "u"].includes(e.key.toLowerCase())) {
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === "TEXTAREA") {
        e.preventDefault();
        const kind = e.key.toLowerCase() === "b" ? "bold" : e.key.toLowerCase() === "i" ? "italic" : "underline";
        applyFormat(kind);
      }
      return;
    }
    if (e.key === "Escape") {
      if (selectedIds.size > 0) {
        e.preventDefault();
        setSelectedIds(new Set());
        return;
      }
      if (editingId) {
        (document.activeElement as HTMLElement | null)?.blur?.();
        setEditingId(null);
      }
    }
  };

  if (noteQuery.isLoading || !draft) {
    return (
      <div data-testid="gaia-editor-loading" className="w-full space-y-3">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    );
  }

  if (noteQuery.isError || !serverNote) {
    return (
      <div
        data-testid="gaia-editor-error"
        className="flex w-full flex-col items-center gap-3 rounded-xl border bg-card p-10 text-center"
      >
        <p className="text-sm font-semibold">{t("gaia.editor.loadError")}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void noteQuery.refetch()}>
            {t("common.retry")}
          </Button>
          <Button size="sm" onClick={onClose}>
            {t("gaia.editor.backToNotes")}
          </Button>
        </div>
      </div>
    );
  }

  const attachedTags = allTags.filter((tag) => draft.tagIds.includes(tag.id));
  const suggestions = allTags.filter((tag) => !draft.tagIds.includes(tag.id)).slice(0, 8);
  const statusDot =
    status === "saved"
      ? "bg-gain"
      : status === "dirty"
        ? "bg-amber-400"
        : status === "saving"
          ? "animate-pulse bg-brand-cyan"
          : "bg-loss";
  const statusLabel =
    status === "saved"
      ? `${t("gaia.time.savedPrefix")} ${savedAt ? gaiaRelativeTime(savedAt, tr) : ""}`.trim()
      : status === "dirty"
        ? t("gaia.editor.statusDirty")
        : status === "saving"
          ? t("gaia.editor.statusSaving")
          : t("gaia.editor.statusError");

  const addBlock = () => {
    const block: GaiaBlock = { id: newBlockId(), type: "paragraph", text: "" };
    pendingFocusRef.current = { id: block.id, at: "start" };
    applyDraft((d) => ({ ...d, blocks: [...d.blocks, block] }));
  };

  // Module 2 (K03/K14) : insère un bloc ref vers la note cible à la fin
  // de la note (transforme une mention non liée / une suggestion en lien).
  const insertRefBlock = React.useCallback(
    (targetNoteId: string) => {
      const block: GaiaBlock = {
        id: newBlockId(),
        type: "ref",
        text: "",
        ref: { kind: "NOTE", id: targetNoteId },
      };
      applyDraft((d) => ({ ...d, blocks: [...d.blocks, block] }));
      toast({ title: t("gaia.links.linkInserted") });
    },
    [applyDraft, toast, t],
  );

  return (
    <div
      data-testid="gaia-editor"
      onKeyDownCapture={handleKeyDownCapture}
      className="w-full"
    >
      <div className="flex items-start gap-4">
        {outlineOpen && !focusMode ? (
          <OutlinePanel headings={headings} onNavigate={ops.navigateToBlock} onClose={() => setOutlineOpen(false)} t={tr} />
        ) : null}
        {linksOpen && !focusMode ? (
          <LinksPanel
            noteId={noteId}
            onOpenNote={onOpenNote}
            onInsertRef={insertRefBlock}
            onClose={() => setLinksOpen(false)}
            t={tr}
          />
        ) : null}
        <div className="min-w-0 flex-1">
      <div className="overflow-hidden rounded-xl border bg-card">
        <CoverBar
          coverStored={draft.cover}
          onCoverChange={(cover: GaiaCover | null) =>
            applyDraft((d) => ({ ...d, cover: cover ? JSON.stringify(cover) : null }))
          }
          t={tr}
        />
        <div className="flex items-start gap-2 border-b px-4 pb-3 pt-4 sm:px-6">
          <IconPicker
            icon={draft.icon}
            onPick={(icon) => applyDraft((d) => ({ ...d, icon }))}
            t={tr}
          />
          <div className="min-w-0 flex-1">
            <input
              data-testid="gaia-title-input"
              value={draft.title}
              onChange={(e) => applyDraft((d) => ({ ...d, title: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const first = flattenBlocks(draft.blocks).find((b) =>
                    TEXT_BLOCK_TYPES.includes(b.type),
                  );
                  if (first) ops.focusBlock(first.id, "end");
                }
              }}
              placeholder={t("gaia.shared.untitledNote")}
              aria-label={t("gaia.editor.titleLabel")}
              className="w-full bg-transparent text-2xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/50"
            />
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span
                data-testid="gaia-save-status"
                data-status={status}
                className="inline-flex items-center gap-1.5"
              >
                <span className={`size-2 rounded-full ${statusDot}`} aria-hidden="true" />
                {statusLabel}
                {status === "error" ? (
                  <button
                    type="button"
                    onClick={() => void flushSave()}
                    className="font-medium text-foreground underline underline-offset-2"
                  >
                    {t("common.retry")}
                  </button>
                ) : null}
              </span>
              <span aria-hidden="true">·</span>
              <span data-testid="gaia-word-count">
                <StatsPopover
                  stats={stats}
                  wordGoal={draft.wordGoal}
                  onWordGoalChange={(goal) => applyDraft((d) => ({ ...d, wordGoal: goal }))}
                  dailyGoal={dailyGoal}
                  wordsToday={wordsToday}
                  onDailyGoalChange={handleDailyGoalChange}
                  t={tr}
                />
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {t("gaia.shared.edited")} {gaiaRelativeTime(serverNote.updatedAt, tr)}
              </span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              data-testid="gaia-outline-toggle"
              aria-label={t("gaia.outline.title")}
              title={t("gaia.outline.title")}
              onClick={() => {
                setOutlineOpen((v) => !v);
                setLinksOpen(false);
              }}
              className={`rounded-md p-2 hover:bg-muted ${outlineOpen ? "bg-muted text-foreground" : "text-muted-foreground"}`}
            >
              <ListTree className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              data-testid="gaia-links-toggle"
              aria-label={t("gaia.links.title")}
              title={t("gaia.links.title")}
              onClick={() => {
                setLinksOpen((v) => !v);
                setOutlineOpen(false);
              }}
              className={`rounded-md p-2 hover:bg-muted ${linksOpen ? "bg-muted text-foreground" : "text-muted-foreground"}`}
            >
              <Link2 className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              data-testid="gaia-favorite-toggle"
              aria-label={t("gaia.editor.favoriteTitle")}
              title={draft.favorite ? t("gaia.editor.favoritedTitle") : t("gaia.editor.favoriteTitle")}
              onClick={() => applyDraft((d) => ({ ...d, favorite: !d.favorite }))}
              className="rounded-md p-2 hover:bg-muted"
            >
              <Star
                className={`size-4 ${draft.favorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              data-testid="gaia-focus-toggle"
              aria-label={focusMode ? t("gaia.editor.focusExit") : t("gaia.editor.focusEnter")}
              title={focusMode ? t("gaia.editor.focusExitTitle") : t("gaia.editor.focusEnterTitle")}
              onClick={onToggleFocusMode}
              className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {focusMode ? (
                <Minimize2 className="size-4" aria-hidden="true" />
              ) : (
                <Maximize2 className="size-4" aria-hidden="true" />
              )}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-testid="gaia-note-menu"
                  aria-label={t("gaia.shared.noteActions")}
                >
                  {t("gaia.shared.noteActions")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={() => {
                    void duplicateNote.mutateAsync({ noteId }).then(
                      (res) => onOpenNote(res.note.id),
                      (err: unknown) => toast({ variant: "destructive", title: gaiaErrorMessage(err) }),
                    );
                  }}
                >
                  {t("gaia.editor.duplicateNote")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    void createTemplate
                      .mutateAsync({
                        name: draft.title === "" ? t("gaia.shared.untitledTemplate") : draft.title,
                        description: t("gaia.shared.savedFromNote"),
                        icon: draft.icon ?? "📄",
                        fromNoteId: noteId,
                      })
                      .then(
                        () => toast({ title: t("gaia.editor.templatesToast") }),
                        (err: unknown) => toast({ variant: "destructive", title: gaiaErrorMessage(err) }),
                      );
                  }}
                >
                  {t("gaia.editor.saveAsTemplate")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    void flushSave().then(() => setVersionsOpen(true));
                  }}
                >
                  <History className="size-3.5" aria-hidden="true" />
                  {t("gaia.dialogs.versionsTitle")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    downloadText(
                      `${slugify(draft.title)}.md`,
                      blocksToMarkdown(draft.title, draft.blocks, tr),
                    );
                    toast({ title: t("gaia.editor.markdownToast") });
                  }}
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  {t("gaia.editor.exportMarkdown")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  data-testid="gaia-export-pdf"
                  onClick={() => {
                    void flushSave().then(() => setPrintOpen(true));
                  }}
                >
                  <FileDown className="size-3.5" aria-hidden="true" />
                  {t("gaia.editor.exportPdf")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    void trashNote.mutateAsync(noteId).then(
                      () => {
                        toast({ title: t("gaia.editor.trashToast") });
                        onClose();
                      },
                      (err: unknown) => toast({ variant: "destructive", title: gaiaErrorMessage(err) }),
                    );
                  }}
                  className="text-loss focus:text-loss"
                >
                  {t("gaia.shared.moveToTrash")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              data-testid="gaia-editor-back"
              aria-label={t("gaia.editor.backToNotes")}
              onClick={onClose}
              className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5 sm:px-6">
          <Select
            value={draft.folderId ?? "none"}
            onValueChange={(v) =>
              applyDraft((d) => ({ ...d, folderId: v === "none" ? null : v }))
            }
          >
            <SelectTrigger
              data-testid="gaia-folder-select"
              aria-label={t("gaia.editor.folderLabel")}
              className="h-7 w-40 text-xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("gaia.shared.noFolder")}</SelectItem>
              {folders.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="gaia-tags-button"
                className="h-7 text-xs"
              >
                <Tag className="size-3.5" aria-hidden="true" />
                {draft.tagIds.length === 0
                  ? t("gaia.editor.addTags")
                  : `${draft.tagIds.length} ${draft.tagIds.length === 1 ? t("gaia.shared.tagOne") : t("gaia.shared.tagMany")}`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" data-testid="gaia-tags-popover" align="start">
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTagName.trim() !== "") {
                    e.preventDefault();
                    const name = newTagName.trim().replace(/^#/, "");
                    setNewTagName("");
                    void createTag.mutateAsync({ name }).then(
                      (tag) =>
                        applyDraft((d) => ({ ...d, tagIds: [...d.tagIds, tag.id] })),
                      (err: unknown) =>
                        toast({ variant: "destructive", title: gaiaErrorMessage(err) }),
                    );
                  }
                }}
                placeholder={t("gaia.editor.tagInputPlaceholder")}
                aria-label={t("gaia.editor.tagInputLabel")}
                className="h-8 text-xs"
              />
              {attachedTags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {attachedTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      title={t("gaia.shared.removeTag")}
                      onClick={() =>
                        applyDraft((d) => ({ ...d, tagIds: d.tagIds.filter((id) => id !== tag.id) }))
                      }
                      className="inline-flex items-center gap-1 rounded-sm border border-brand-coral/40 bg-brand-coral/10 px-1.5 py-0.5 text-[11px] text-brand-coral-deep dark:text-brand-coral"
                    >
                      #{tag.name}
                      <X className="size-3" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              ) : null}
              <p className="mb-1 mt-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {t("gaia.editor.suggestions")}
              </p>
              {suggestions.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("gaia.editor.noOtherTags")}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      title={t("gaia.shared.addTag")}
                      onClick={() =>
                        applyDraft((d) => ({ ...d, tagIds: [...d.tagIds, tag.id] }))
                      }
                      className="inline-flex items-center rounded-sm border border-border bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      #{tag.name}
                    </button>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>
          {serverNote.lessonRef ? (
            <span
              data-testid="gaia-lesson-origin"
              title={`${t("gaia.shared.createdFromLesson")} "${serverNote.lessonRef.lessonTitle}" (${serverNote.lessonRef.courseTitle})`}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
              style={{
                borderColor: "color-mix(in srgb, #FF6B5B 35%, transparent)",
                background: "color-mix(in srgb, #FF6B5B 10%, transparent)",
              }}
            >
              {serverNote.lessonRef.lessonTitle} · {serverNote.lessonRef.courseTitle}
            </span>
          ) : null}
          <span data-testid="gaia-editor-tags" className="ml-auto flex gap-1.5">
            {attachedTags.slice(0, 3).map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center rounded-sm border border-border bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
              >
                #{tag.name}
              </span>
            ))}
          </span>
        </div>

        <div className="border-b px-4 py-2 sm:px-6">
          <FormatToolbar onFormat={applyFormat} disabled={!canFormat} t={tr} />
        </div>

        <PropertiesPanel
          properties={draft.properties}
          onChange={(properties) => applyDraft((d) => ({ ...d, properties }))}
        />

        <div data-testid="gaia-blocks" className="max-w-prose space-y-1 px-4 py-4 sm:px-6">
          <BlockList
            listId={ROOT_LIST_ID}
            blocks={draft.blocks}
            depth={0}
            ctx={rowCtx}
          />
          <button
            type="button"
            onClick={addBlock}
            aria-label={t("gaia.editor.addBlockLabel")}
            className="h-10 w-full rounded-md pl-7 text-left text-sm text-muted-foreground hover:bg-muted/50"
          >
            {t("gaia.editor.addBlockHint")}
          </button>
        </div>
      </div>
        </div>
      </div>

      {selectedIds.size > 0 ? (
        <MultiSelectBar
          count={selectedIds.size}
          onDelete={bulkDelete}
          onDuplicate={bulkDuplicate}
          onTurnInto={bulkTurnInto}
          onMoveToNote={bulkMoveToNote}
          onCopy={bulkCopy}
          onClear={() => setSelectedIds(new Set())}
          t={tr}
        />
      ) : null}

      {slash ? (
        <GaiaSlashMenu
          rect={slash.rect}
          items={slashItems}
          activeIndex={slashActive}
          onActiveChange={setSlashActive}
          onSelect={applySlashItem}
          onClose={() => setSlash(null)}
          onManageCustom={() => {
            setSlash(null);
            setCustomSlashOpen(true);
          }}
          t={tr}
        />
      ) : null}

      <MoveToNoteDialog
        open={moveDialog.open}
        onOpenChange={(open) => setMoveDialog((prev) => ({ ...prev, open }))}
        excludeNoteId={noteId}
        onPick={executeMoveDialog}
        title={t(moveDialog.mode === "move" ? "gaia.moveToNote.title" : "gaia.moveToNote.copyTitle")}
        t={tr}
      />
      <CustomSlashDialog
        open={customSlashOpen}
        onOpenChange={setCustomSlashOpen}
        commands={customCommands}
        onSave={saveCustomCommands}
        t={tr}
      />

      <RefPickerDialog
        open={refPicker.open}
        onOpenChange={(open) => setRefPicker((prev) => ({ ...prev, open }))}
        kind={refPicker.kind}
        onPick={handleRefPick}
        t={tr}
      />
      <VersionsDialog
        open={versionsOpen}
        onOpenChange={setVersionsOpen}
        noteId={noteId}
        restoringId={restoringId}
        onRestore={(versionId) => {
          setRestoringId(versionId);
          void restoreVersion
            .mutateAsync({ noteId, versionId })
            .then(
              () => {
                dirtyRef.current = false;
                toast({ title: t("gaia.editor.versionRestoredToast") });
                setVersionsOpen(false);
              },
              (err: unknown) => toast({ variant: "destructive", title: gaiaErrorMessage(err) }),
            )
            .finally(() => setRestoringId(null));
        }}
        t={tr}
      />
      <NotePrintDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        note={serverNote}
        folderName={noteQuery.data?.folderName ?? null}
        tagNames={noteQuery.data?.tagNames ?? []}
        t={tr}
      />
    </div>
  );
}
