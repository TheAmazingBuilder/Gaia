"use client";

/**
 * Gaïa — Module 2 (K09): Knowledge Canvas.
 *
 * A free-form board: note cards positioned by drag (pointer-based, saved
 * on drop). Cards show title + excerpt + mastery dot; click opens the note.
 * "Add note" drops a card from the note picker at a free spot.
 */
import * as React from "react";
import { LayoutGrid, Plus, Search, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  GaiaEmptyState,
  MASTERY_META,
  gaiaErrorMessage,
  useCreateGaiaCanvas,
  useDeleteGaiaCanvas,
  useGaiaCanvas,
  useGaiaCanvases,
  useGaiaNotes,
  useGaiaRefs,
  useUpdateGaiaCanvas,
  type GaiaCanvasItem,
  type GaiaT,
} from "./gaia-shared";

const CARD_W = 240;
const CARD_H = 110;
const BOARD_W = 1600;
const BOARD_H = 1000;

function CanvasBoard({
  canvasId,
  onOpenNote,
}: {
  canvasId: string;
  onOpenNote: (id: string) => void;
}) {
  const t = useTranslations();
  const canvasQuery = useGaiaCanvas(canvasId);
  const updateCanvas = useUpdateGaiaCanvas();
  const [items, setItems] = React.useState<GaiaCanvasItem[]>([]);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const boardRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<{
    noteId: string;
    startX: number;
    startY: number;
    pointerX: number;
    pointerY: number;
    moved: boolean;
  } | null>(null);
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const canvas = canvasQuery.data?.canvas;
  React.useEffect(() => {
    if (canvas) setItems(canvas.items);
  }, [canvas?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Notes for the cards on the board (one query, all notes, client filter).
  const notesQuery = useGaiaNotes({ view: "all", folderId: "", tagId: "", q: "", sort: "updated", pageSize: 100 });
  const notesById = React.useMemo(
    () => new Map((notesQuery.data?.notes ?? []).map((n) => [n.id, n])),
    [notesQuery.data],
  );

  const persist = React.useCallback(
    (next: GaiaCanvasItem[]) => {
      if (!canvas) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void updateCanvas.mutateAsync({ canvasId: canvas.id, name: canvas.name, items: next });
      }, 600);
    },
    [canvas, updateCanvas],
  );

  const onPointerDown = (e: React.PointerEvent, item: GaiaCanvasItem) => {
    if (e.button !== 0) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      noteId: item.noteId,
      startX: item.x,
      startY: item.y,
      pointerX: e.clientX,
      pointerY: e.clientY,
      moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.pointerX;
    const dy = e.clientY - drag.pointerY;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    const next = items.map((it) =>
      it.noteId === drag.noteId
        ? {
            ...it,
            x: Math.max(0, Math.min(BOARD_W - CARD_W, drag.startX + dx)),
            y: Math.max(0, Math.min(BOARD_H - CARD_H, drag.startY + dy)),
          }
        : it,
    );
    setItems(next);
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.moved) persist(items);
  };

  const removeCard = (noteId: string) => {
    const next = items.filter((it) => it.noteId !== noteId);
    setItems(next);
    persist(next);
  };

  const addNote = (noteId: string) => {
    if (items.some((it) => it.noteId === noteId)) {
      setPickerOpen(false);
      return;
    }
    // Free spot: cascade from the top-left.
    const used = new Set(items.map((it) => `${it.x},${it.y}`));
    let x = 24;
    let y = 24;
    while (used.has(`${x},${y}`) && y < BOARD_H - CARD_H) {
      x += 32;
      y += 32;
      if (x > BOARD_W - CARD_W) {
        x = 24;
        y += 96;
      }
    }
    const next = [...items, { noteId, x, y }];
    setItems(next);
    persist(next);
    setPickerOpen(false);
    setQuery("");
  };

  if (canvasQuery.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (!canvas) {
    return <p className="text-sm text-muted-foreground">{t("gaia.canvas.notFound")}</p>;
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={() => setPickerOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          {t("gaia.canvas.addNote")}
        </Button>
        <span className="text-xs text-muted-foreground">
          {t("gaia.canvas.hint", { count: items.length })}
        </span>
        {updateCanvas.isPending ? (
          <span className="text-xs text-muted-foreground">{t("gaia.editor.statusSaving")}</span>
        ) : null}
      </div>
      <div className="overflow-auto rounded-lg border bg-muted/20" style={{ maxHeight: 560 }}>
        <div
          ref={boardRef}
          data-testid="gaia-canvas-board"
          className="relative"
          style={{ width: BOARD_W, height: BOARD_H }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {/* Dotted grid backdrop */}
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              backgroundImage: "radial-gradient(circle, var(--muted-foreground) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
              opacity: 0.25,
            }}
            aria-hidden="true"
          />
          {items.map((item) => {
            const note = notesById.get(item.noteId);
            if (!note) return null;
            return (
              <div
                key={item.noteId}
                data-testid="gaia-canvas-card"
                role="button"
                tabIndex={0}
                onPointerDown={(e) => onPointerDown(e, item)}
                onClick={() => {
                  if (!dragRef.current?.moved) onOpenNote(item.noteId);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onOpenNote(item.noteId);
                }}
                className="group absolute cursor-grab touch-none rounded-lg border bg-card p-3 shadow-sm select-none hover:border-brand-cyan/40 active:cursor-grabbing"
                style={{ left: item.x, top: item.y, width: item.w ?? CARD_W, minHeight: item.h ?? CARD_H }}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-1 size-2 shrink-0 rounded-full ${MASTERY_META[note.mastery].dot}`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                    {note.title === "" ? t("gaia.shared.untitledNote") : note.title}
                  </span>
                  <button
                    type="button"
                    aria-label={t("gaia.canvas.removeCard")}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeCard(item.noteId);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="shrink-0 rounded-md p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-loss group-hover:opacity-100"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
                <p className="mt-1.5 line-clamp-3 text-[11px] text-muted-foreground">
                  {note.excerpt === "" ? t("gaia.notes.emptyNote") : note.excerpt}
                </p>
              </div>
            );
          })}
          {items.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="max-w-sm text-center text-sm text-muted-foreground">
                {t("gaia.canvas.empty")}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <AddNoteDialog
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setQuery("");
        }}
        query={query}
        onQueryChange={setQuery}
        onPick={addNote}
      />
    </div>
  );
}

function AddNoteDialog({
  open,
  onClose,
  query,
  onQueryChange,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (q: string) => void;
  onPick: (noteId: string) => void;
}) {
  const t = useTranslations();
  const refsQuery = useGaiaRefs(query, "NOTE", query.trim() !== "");
  const refs = refsQuery.data?.refs ?? [];
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("gaia.canvas.addNoteTitle")}</DialogTitle>
          <DialogDescription>{t("gaia.canvas.addNoteBody")}</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t("gaia.canvas.searchPlaceholder")}
            aria-label={t("gaia.canvas.searchLabel")}
            className="pl-9"
            autoFocus
          />
        </div>
        {query.trim() === "" ? (
          <p className="text-xs text-muted-foreground">{t("gaia.canvas.searchHint")}</p>
        ) : refs.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("gaia.canvas.noResults")}</p>
        ) : (
          <ul className="max-h-64 space-y-1 overflow-auto">
            {refs.slice(0, 10).map((ref) => (
              <li key={ref.id}>
                <button
                  type="button"
                  onClick={() => onPick(ref.id)}
                  className="w-full truncate rounded-md border px-2 py-1.5 text-left text-xs hover:bg-muted"
                >
                  {ref.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function CanvasPanel({ onOpenNote }: { onOpenNote: (id: string) => void }) {
  const t = useTranslations();
  const tr: GaiaT = (key) => t(key);
  const { toast } = useToast();
  const canvasesQuery = useGaiaCanvases();
  const createCanvas = useCreateGaiaCanvas();
  const updateCanvas = useUpdateGaiaCanvas();
  const deleteCanvas = useDeleteGaiaCanvas();
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [renameId, setRenameId] = React.useState<string | null>(null);
  const [renameName, setRenameName] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; name: string } | null>(null);

  const canvases = canvasesQuery.data?.canvases ?? [];
  const active = canvases.find((c) => c.id === activeId) ?? canvases[0] ?? null;

  const create = () => {
    const trimmed = name.trim();
    if (trimmed === "") return;
    void createCanvas.mutateAsync({ name: trimmed }).then(
      (res) => {
        setName("");
        setActiveId(res.canvas.id);
      },
      (err: unknown) => toast({ variant: "destructive", title: gaiaErrorMessage(err) }),
    );
  };

  return (
    <div data-testid="gaia-canvas-panel" className="space-y-4">
      <section className="rounded-xl border bg-card p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <LayoutGrid className="size-4 text-brand-cyan-deep dark:text-brand-cyan" aria-hidden="true" />
          {t("gaia.canvas.title")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("gaia.canvas.hint")}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") create();
            }}
            placeholder={t("gaia.canvas.namePlaceholder")}
            aria-label={t("gaia.canvas.nameLabel")}
            className="max-w-xs"
          />
          <Button type="button" disabled={name.trim() === "" || createCanvas.isPending} onClick={create}>
            <Plus className="size-4" aria-hidden="true" />
            {t("gaia.canvas.create")}
          </Button>
        </div>
        {canvasesQuery.isLoading ? (
          <Skeleton className="mt-3 h-10 w-full" />
        ) : canvases.length === 0 ? (
          <div className="mt-3">
            <GaiaEmptyState
              icon={<LayoutGrid className="size-8" aria-hidden="true" />}
              title={t("gaia.canvas.emptyTitle")}
              body={t("gaia.canvas.emptyBody")}
              testid="gaia-canvas-empty"
            />
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {canvases.map((canvas) => {
              const isActive = active?.id === canvas.id;
              return (
                <div
                  key={canvas.id}
                  className={`flex items-center gap-1 rounded-lg border ${isActive ? "border-brand-coral/40 bg-brand-coral/10" : "border-border"}`}
                >
                  {renameId === canvas.id ? (
                    <Input
                      value={renameName}
                      onChange={(e) => setRenameName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && renameName.trim() !== "") {
                          void updateCanvas
                            .mutateAsync({ canvasId: canvas.id, name: renameName.trim() })
                            .then(() => setRenameId(null));
                        }
                        if (e.key === "Escape") setRenameId(null);
                      }}
                      onBlur={() => setRenameId(null)}
                      className="h-8 w-40"
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveId(canvas.id)}
                      onDoubleClick={() => {
                        setRenameId(canvas.id);
                        setRenameName(canvas.name);
                      }}
                      className="px-3 py-1.5 text-xs font-medium"
                    >
                      {canvas.name}
                      <span className="ml-1.5 text-muted-foreground">({canvas.items.length})</span>
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={t("gaia.canvas.delete")}
                    onClick={() => setDeleteTarget({ id: canvas.id, name: canvas.name })}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-loss"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {active ? (
        <section className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold">{active.name}</h3>
          <div className="mt-2">
            <CanvasBoard canvasId={active.id} onOpenNote={onOpenNote} />
          </div>
        </section>
      ) : null}

      <Dialog open={deleteTarget !== null} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {t("gaia.canvas.deleteTitlePrefix")} “{deleteTarget?.name}”?
            </DialogTitle>
            <DialogDescription>{t("gaia.canvas.deleteBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (!deleteTarget) return;
                void deleteCanvas.mutateAsync(deleteTarget.id).then(
                  () => {
                    setDeleteTarget(null);
                    setActiveId(null);
                  },
                  (err: unknown) => toast({ variant: "destructive", title: gaiaErrorMessage(err) }),
                );
              }}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {t("gaia.canvas.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
