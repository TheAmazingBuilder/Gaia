"use client";

/**
 * Gaïa — main view.
 *
 * One hash route (/gaia); all internal navigation goes through hash query
 * params (?tab=&note=&folder=&tag=&q=&sort=&view=). When ?note= is present
 * the whole content area is replaced by the editor. Focus mode hides the
 * chrome (state lives here, not in the editor).
 */
import * as React from "react";
import {
  ArrowLeft,
  Brain,
  Files,
  FileText,
  Folder,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  NotebookText,
  Share2,
  Star,
  Trash2,
  Waypoints,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/hooks/use-toast";
import { navigate, useRoute } from "@/lib/router";
import {
  GAIA_DEFAULT_PARAMS,
  gaiaErrorMessage,
  gaiaRelativeTime,
  newBlockId,
  useCreateGaiaNote,
  useGaiaNote,
  useGaiaOverview,
  type GaiaNotesParams,
  type GaiaNotesView,
  type GaiaTab,
  type GaiaT,
} from "./gaia-shared";
import { NotesBrowser } from "./gaia-notes";
import { GaiaMark, GaiaWordmark } from "./gaia-logo";
import { FoldersPanel, OverviewPanel, TagsPanel, TemplatesPanel, TrashPanel } from "./gaia-panels";
import { MemoryPanel } from "./gaia-memory";
import { GraphPanel } from "./gaia-graph";
import { KnowledgePanel } from "./gaia-knowledge";
import { CanvasPanel } from "./gaia-canvas";
import { InboxPanel } from "./gaia-inbox";
import { FilesPanel } from "./gaia-files";
import { GaiaEditor } from "./gaia-editor";

const TABS: Array<{ id: GaiaTab; icon: typeof LayoutDashboard }> = [
  { id: "overview", icon: LayoutDashboard },
  { id: "notes", icon: FileText },
  { id: "memory", icon: Brain },
  { id: "graph", icon: Share2 },
  { id: "knowledge", icon: Waypoints },
  { id: "canvas", icon: LayoutGrid },
  { id: "inbox", icon: Inbox },
  { id: "files", icon: Files },
  { id: "folders", icon: Folder },
  { id: "favorites", icon: Star },
  { id: "templates", icon: NotebookText },
  { id: "trash", icon: Trash2 },
];

const VALID_TABS: GaiaTab[] = ["overview", "notes", "memory", "graph", "knowledge", "canvas", "inbox", "files", "folders", "favorites", "templates", "trash"];
const VALID_VIEWS: GaiaNotesView[] = ["all", "favorites", "trash", "folder", "tag"];

export function GaiaView() {
  const t = useTranslations();
  const tr: GaiaT = (key) => t(key);
  const { toast } = useToast();
  const route = useRoute();
  const query = route.query ?? {};

  const rawTab = query.tab ?? "overview";
  const activeTab: GaiaTab = (VALID_TABS as string[]).includes(rawTab)
    ? (rawTab as GaiaTab)
    : "overview";
  const noteId = query.note && query.note !== "" ? query.note : null;

  const [focusMode, setFocusMode] = React.useState(false);
  const overviewQuery = useGaiaOverview();
  const noteQuery = useGaiaNote(noteId);
  const createNote = useCreateGaiaNote();

  const setParams = React.useCallback(
    (changes: Record<string, string | null>) => {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (v !== "") params.set(k, v);
      }
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      const qs = params.toString();
      navigate(`/gaia${qs === "" ? "" : `?${qs}`}`);
    },
    [query],
  );

  const setTab = React.useCallback(
    (tab: string) =>
      setParams({ tab, note: null, folder: null, tag: null, q: null, sort: null, view: null, collection: null }),
    [setParams],
  );

  const openNote = React.useCallback(
    (id: string) => setParams({ note: id }),
    [setParams],
  );
  const closeNote = React.useCallback(() => setParams({ note: null }), [setParams]);

  const handleCreateNote = React.useCallback(
    (folderId?: string | null) => {
      void createNote
        .mutateAsync({
          title: "",
          folderId: folderId ?? null,
          blocks: [{ id: newBlockId(), type: "paragraph", text: "" }],
        })
        .then(
          (res) => openNote(res.note.id),
          (err: unknown) => toast({ variant: "destructive", title: gaiaErrorMessage(err) }),
        );
    },
    [createNote, openNote, toast],
  );

  const notesParams: GaiaNotesParams = {
    view: (VALID_VIEWS as string[]).includes(query.view ?? "")
      ? (query.view as GaiaNotesView)
      : "all",
    folderId: query.folder ?? "",
    tagId: query.tag ?? "",
    q: query.q ?? "",
    sort: query.sort ?? "updated",
    collectionId: query.collection ?? "",
  };

  const onNotesParamsChange = React.useCallback(
    (changes: Partial<GaiaNotesParams>) => {
      const mapped: Record<string, string | null> = {};
      if (changes.view !== undefined) mapped.view = changes.view === "all" ? null : changes.view;
      if (changes.folderId !== undefined) mapped.folder = changes.folderId;
      if (changes.tagId !== undefined) mapped.tag = changes.tagId;
      if (changes.q !== undefined) mapped.q = changes.q;
      if (changes.sort !== undefined) mapped.sort = changes.sort === "updated" ? null : changes.sort;
      if (changes.collectionId !== undefined) mapped.collection = changes.collectionId;
      setParams(mapped);
    },
    [setParams],
  );

  const onGoTab = React.useCallback(
    (tab: GaiaTab, params?: Partial<GaiaNotesParams>) => {
      const mapped: Record<string, string | null> = {
        tab,
        note: null,
        folder: null,
        tag: null,
        q: null,
        sort: null,
        view: null,
        collection: null,
      };
      if (params?.view !== undefined) mapped.view = params.view === "all" ? null : params.view;
      if (params?.folderId !== undefined) mapped.folder = params.folderId;
      if (params?.tagId !== undefined) mapped.tag = params.tagId;
      if (params?.q !== undefined) mapped.q = params.q;
      if (params?.sort !== undefined) mapped.sort = params.sort === "updated" ? null : params.sort;
      if (params?.collectionId !== undefined) mapped.collection = params.collectionId;
      setParams(mapped);
    },
    [setParams],
  );

  // ── Editor mode (?note=) ──────────────────────────────────────────────────
  if (noteId) {
    const updatedAt = noteQuery.data?.note.updatedAt;
    return (
      <div data-testid="gaia-view" className="mx-auto w-full max-w-7xl space-y-4">
        {!focusMode ? (
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="gaia-back-to-notes"
              onClick={closeNote}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Gaïa
            </Button>
            {updatedAt ? (
              <span className="text-xs text-muted-foreground">
                {t("gaia.view.lastEdited")} {gaiaRelativeTime(updatedAt, tr)}
              </span>
            ) : null}
          </div>
        ) : null}
        <GaiaEditor
          noteId={noteId}
          onClose={closeNote}
          onOpenNote={openNote}
          focusMode={focusMode}
          onToggleFocusMode={() => setFocusMode((v) => !v)}
        />
        {focusMode ? (
          <p className="text-center text-xs text-muted-foreground">{t("gaia.view.focusHint")}</p>
        ) : null}
      </div>
    );
  }

  // ── Tabbed view ───────────────────────────────────────────────────────────
  return (
    <div data-testid="gaia-view" className="mx-auto w-full max-w-7xl space-y-4">
      <header
        data-testid="gaia-header"
        className="overflow-hidden rounded-xl border bg-card"
      >
        <div className="px-4 py-5 sm:px-6">
          <PageHeader
            title={
              <span className="inline-flex items-center gap-2">
                <GaiaMark className="h-6 w-auto sm:h-7" />
                <GaiaWordmark className="font-bold tracking-tight" />
              </span>
            }
            description={t("gaia.view.tagline")}
            descriptionClassName="max-w-2xl"
            className="flex-wrap sm:items-end"
            actions={
              <>
            {overviewQuery.data ? (
              <span
                data-testid="gaia-note-count"
                className="inline-flex items-center gap-1.5 rounded-md border border-brand-coral/30 bg-brand-coral/10 px-2.5 py-1 text-xs text-brand-coral-deep dark:text-brand-coral"
              >
                <span className="font-mono font-semibold tabular-nums">
                  {overviewQuery.data.totals.notes}
                </span>
                {t("gaia.shared.noteMany")}
              </span>
              ) : null}
              </>
            }
          />
        </div>
      </header>

      {overviewQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setTab}>
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1 sm:w-fit">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                data-testid={`gaia-tab-${tab.id}`}
                className="data-[state=active]:bg-brand-coral/15 data-[state=active]:text-brand-coral-deep dark:data-[state=active]:text-brand-coral"
              >
                <tab.icon className="size-4" aria-hidden="true" />
                {t(`gaia.view.tabs.${tab.id}`)}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="pt-4">
            {activeTab === "overview" ? (
              <OverviewPanel
                onGoTab={onGoTab}
                onOpenNote={openNote}
                onCreateNote={handleCreateNote}
              />
            ) : null}
            {activeTab === "notes" ? (
              <NotesBrowser
                params={notesParams}
                onParamsChange={onNotesParamsChange}
                onOpenNote={openNote}
                onCreateNote={handleCreateNote}
                emptyState={{
                  icon: <FileText className="size-8" aria-hidden="true" />,
                  title: t("gaia.overview.emptyTitle"),
                  body: t("gaia.overview.emptyBody"),
                }}
                testid="gaia-notes-panel"
              />
            ) : null}
            {activeTab === "memory" ? (
              <MemoryPanel onOpenNote={openNote} onCreateNote={handleCreateNote} />
            ) : null}
            {activeTab === "graph" ? (
              <GraphPanel onOpenNote={openNote} onCreateNote={handleCreateNote} />
            ) : null}
            {activeTab === "knowledge" ? (
              <KnowledgePanel
                onOpenNote={openNote}
                onOpenCollection={(collectionId) =>
                  onGoTab("notes", { view: "all", collectionId })
                }
              />
            ) : null}
            {activeTab === "canvas" ? <CanvasPanel onOpenNote={openNote} /> : null}
            {activeTab === "inbox" ? <InboxPanel onOpenNote={openNote} /> : null}
            {activeTab === "files" ? <FilesPanel onOpenNote={openNote} /> : null}
            {activeTab === "folders" ? (
              <div className="space-y-4">
                <FoldersPanel
                  onOpenFolder={(folderId) =>
                    onGoTab("notes", { view: "folder", folderId })
                  }
                  onCreateNoteInFolder={(folderId) => handleCreateNote(folderId)}
                />
                <TagsPanel
                  onOpenTag={(tagId) => onGoTab("notes", { view: "tag", tagId })}
                />
              </div>
            ) : null}
            {activeTab === "favorites" ? (
              <NotesBrowser
                params={{ ...GAIA_DEFAULT_PARAMS, view: "favorites" }}
                onParamsChange={onNotesParamsChange}
                onOpenNote={openNote}
                onCreateNote={handleCreateNote}
                emptyState={{
                  icon: <Star className="size-8" aria-hidden="true" />,
                  title: t("gaia.view.favoritesEmptyTitle"),
                  body: t("gaia.overview.favoritesEmpty"),
                }}
                testid="gaia-favorites-panel"
              />
            ) : null}
            {activeTab === "templates" ? (
              <TemplatesPanel onOpenNote={openNote} />
            ) : null}
            {activeTab === "trash" ? <TrashPanel /> : null}
          </div>
        </Tabs>
      )}
    </div>
  );
}
