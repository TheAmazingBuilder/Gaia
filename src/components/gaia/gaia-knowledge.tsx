"use client";

/**
 * Gaïa — Module 2: Knowledge tab.
 *
 * K17 relations explorer (neighborhood graph around a note) ·
 * K06 smart collections (dynamic, criteria-based) ·
 * K15 orphan notes · K16 knowledge timeline.
 */
import * as React from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  CalendarDays,
  ChevronDown,
  Compass,
  FolderSearch,
  Link2,
  Plus,
  Search,
  Trash2,
  Waypoints,
  X,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  GaiaEmptyState,
  MASTERY_META,
  MasteryBadge,
  gaiaErrorMessage,
  useCreateGaiaCollection,
  useDeleteGaiaCollection,
  useGaiaCollections,
  useGaiaFolders,
  useGaiaKnowledgeTimeline,
  useGaiaMemoryGraph,
  useGaiaOrphans,
  useGaiaRefs,
  useGaiaTags,
  useUpdateGaiaCollection,
  type GaiaCollectionCriteria,
  type GaiaSmartCollection,
  type GaiaT,
} from "./gaia-shared";
import { buildTree, type KnowledgeTreeNode } from "@/lib/gaia/knowledge";
import { layoutGraph } from "@/lib/gaia/graph-layout";
import { MASTERY_LEVELS, type MasteryLevel } from "@/lib/gaia/spaced-repetition";

const MASTERY_HEX: Record<MasteryLevel, string> = {
  forgotten: "#6B7280",
  fragile: "#67E8F9",
  medium: "#22D3EE",
  mastered: "#FF6B5B",
};

type ExplorerNodeData = {
  title: string;
  mastery: MasteryLevel;
  center: boolean;
};

type ExplorerNodeType = Node<ExplorerNodeData, "explorer">;

function ExplorerNode({ data, selected }: NodeProps<ExplorerNodeType>) {
  const t = useTranslations();
  const meta = MASTERY_META[data.mastery];
  return (
    <div
      className={`flex max-w-56 items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-sm ${
        data.center
          ? "border-brand-coral ring-2 ring-brand-coral"
          : selected
            ? "ring-2 ring-brand-coral"
            : meta.chip
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={false}
        style={{ background: "var(--muted-foreground)", width: 6, height: 6 }}
      />
      <span className={`size-2 shrink-0 rounded-full ${meta.dot}`} aria-hidden="true" />
      <span className="truncate text-xs font-medium">
        {data.title === "" ? t("gaia.shared.untitledNote") : data.title}
      </span>
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        style={{ background: "var(--muted-foreground)", width: 6, height: 6 }}
      />
    </div>
  );
}

const explorerNodeTypes = { explorer: ExplorerNode };

function FitExplorer({ signature }: { signature: string }) {
  const { fitView } = useReactFlow();
  React.useEffect(() => {
    fitView({ padding: 0.2, maxZoom: 1 });
  }, [fitView, signature]);
  return null;
}

function useIsDark(): boolean {
  const [isDark, setIsDark] = React.useState<boolean>(() =>
    typeof document === "undefined"
      ? true
      : document.documentElement.classList.contains("dark"),
  );
  React.useEffect(() => {
    const update = () =>
      setIsDark(document.documentElement.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

function monthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA");
}

// ── Collections: create / edit dialog ───────────────────────────────────────

function CollectionDialog({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial: GaiaSmartCollection | null;
}) {
  const t = useTranslations();
  const { toast } = useToast();
  const foldersQuery = useGaiaFolders();
  const tagsQuery = useGaiaTags();
  const createCollection = useCreateGaiaCollection();
  const updateCollection = useUpdateGaiaCollection();

  const [name, setName] = React.useState(initial?.name ?? "");
  const [folderId, setFolderId] = React.useState<string>(initial?.criteria.folderId ?? "");
  const [tagIds, setTagIds] = React.useState<string[]>(initial?.criteria.tagIds ?? []);
  const [mastery, setMastery] = React.useState<string>(initial?.criteria.mastery ?? "");
  const [favorite, setFavorite] = React.useState(initial?.criteria.favorite ?? false);
  const [q, setQ] = React.useState(initial?.criteria.q ?? "");

  React.useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setFolderId(initial?.criteria.folderId ?? "");
      setTagIds(initial?.criteria.tagIds ?? []);
      setMastery(initial?.criteria.mastery ?? "");
      setFavorite(initial?.criteria.favorite ?? false);
      setQ(initial?.criteria.q ?? "");
    }
  }, [open, initial]);

  const folders = foldersQuery.data?.folders ?? [];
  const tags = tagsQuery.data?.tags ?? [];
  const folderTree = React.useMemo(() => buildTree(folders), [folders]);
  const flatFolders: Array<{ id: string; name: string; depth: number }> = React.useMemo(() => {
    const out: Array<{ id: string; name: string; depth: number }> = [];
    const walk = (nodes: KnowledgeTreeNode<(typeof folders)[number]>[]) => {
      for (const n of nodes) {
        out.push({ id: n.id, name: n.name, depth: n.depth });
        walk(n.children);
      }
    };
    walk(folderTree);
    return out;
  }, [folderTree, folders]);

  const save = () => {
    const criteria: GaiaCollectionCriteria = {
      ...(folderId !== "" ? { folderId } : {}),
      ...(tagIds.length > 0 ? { tagIds } : {}),
      ...(mastery !== "" ? { mastery } : {}),
      ...(favorite ? { favorite: true } : {}),
      ...(q.trim() !== "" ? { q: q.trim() } : {}),
    };
    const run = initial
      ? updateCollection.mutateAsync({
          collectionId: initial.id,
          name: name.trim(),
          icon: initial.icon,
          criteria,
        })
      : createCollection.mutateAsync({ name: name.trim(), criteria });
    void run.then(
      () => onClose(),
      (err: unknown) => toast({ variant: "destructive", title: gaiaErrorMessage(err) }),
    );
  };

  const pending = createCollection.isPending || updateCollection.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initial ? t("gaia.collections.editTitle") : t("gaia.collections.createTitle")}
          </DialogTitle>
          <DialogDescription>{t("gaia.collections.dialogBody")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("gaia.collections.namePlaceholder")}
            aria-label={t("gaia.collections.nameLabel")}
            autoFocus
          />
          <div>
            <label className="mb-1 block text-xs font-medium">
              {t("gaia.collections.folderLabel")}
            </label>
            <Select value={folderId} onValueChange={setFolderId}>
              <SelectTrigger>
                <SelectValue placeholder={t("gaia.collections.anyFolder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t("gaia.collections.anyFolder")}</SelectItem>
                {flatFolders.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {"\u00A0".repeat(f.depth * 2)}
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("gaia.collections.folderHint")}
            </p>
          </div>
          <div>
            <span className="mb-1 block text-xs font-medium">{t("gaia.collections.tagsLabel")}</span>
            {tags.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("gaia.collections.noTags")}</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const active = tagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        setTagIds((prev) =>
                          active ? prev.filter((id) => id !== tag.id) : [...prev, tag.id],
                        )
                      }
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                        active
                          ? "border-brand-coral/40 bg-brand-coral/10 text-brand-coral-deep dark:text-brand-coral"
                          : "border-border bg-muted/40"
                      }`}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium">
                {t("gaia.collections.masteryLabel")}
              </label>
              <Select value={mastery} onValueChange={setMastery}>
                <SelectTrigger>
                  <SelectValue placeholder={t("gaia.collections.anyMastery")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t("gaia.collections.anyMastery")}</SelectItem>
                  {MASTERY_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {t(`gaia.memory.levels.${level}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex cursor-pointer items-end gap-2 pb-2 text-xs">
              <input
                type="checkbox"
                checked={favorite}
                onChange={(e) => setFavorite(e.target.checked)}
                className="size-4 accent-brand-cyan"
              />
              {t("gaia.collections.favoritesOnly")}
            </label>
          </div>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("gaia.collections.searchPlaceholder")}
            aria-label={t("gaia.collections.searchLabel")}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="button" disabled={name.trim() === "" || pending} onClick={save}>
            {initial ? t("gaia.collections.save") : t("gaia.collections.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Panel ───────────────────────────────────────────────────────────────────

export function KnowledgePanel({
  onOpenNote,
  onOpenCollection,
}: {
  onOpenNote: (id: string) => void;
  onOpenCollection: (collectionId: string) => void;
}) {
  const t = useTranslations();
  const tr: GaiaT = (key) => t(key);
  const isDark = useIsDark();
  const { toast } = useToast();

  const graphQuery = useGaiaMemoryGraph();
  const orphansQuery = useGaiaOrphans();
  const timelineQuery = useGaiaKnowledgeTimeline();
  const collectionsQuery = useGaiaCollections();
  const deleteCollection = useDeleteGaiaCollection();

  const [centerQuery, setCenterQuery] = React.useState("");
  const [centerId, setCenterId] = React.useState<string | null>(null);
  const [centerTitle, setCenterTitle] = React.useState("");
  const refsQuery = useGaiaRefs(centerQuery, "NOTE", centerQuery.trim() !== "");
  const [openMonths, setOpenMonths] = React.useState<Record<string, boolean>>({});
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<GaiaSmartCollection | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<GaiaSmartCollection | null>(null);

  const graph = graphQuery.data;
  const orphans = orphansQuery.data;
  const timeline = timelineQuery.data?.months ?? [];
  const collections = collectionsQuery.data?.collections ?? [];

  // ── Neighborhood (K17) ──
  const neighborhood = React.useMemo(() => {
    if (!graph || !centerId) return null;
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    if (!byId.has(centerId)) return null;
    const adjacency = new Map<string, Set<string>>();
    const addAdj = (a: string, b: string) => {
      if (!adjacency.has(a)) adjacency.set(a, new Set());
      adjacency.get(a)!.add(b);
    };
    for (const e of graph.edges) {
      addAdj(e.from, e.to);
      addAdj(e.to, e.from);
    }
    const hop1 = adjacency.get(centerId) ?? new Set<string>();
    const hop2 = new Set<string>();
    for (const id of hop1) {
      for (const next of adjacency.get(id) ?? []) {
        if (next !== centerId && !hop1.has(next)) hop2.add(next);
      }
    }
    const visibleIds = new Set([centerId, ...hop1, ...[...hop2].slice(0, 30)]);
    const nodes = graph.nodes.filter((n) => visibleIds.has(n.id));
    const edges = graph.edges.filter((e) => visibleIds.has(e.from) && visibleIds.has(e.to));
    return { nodes, edges, hop1: [...hop1], hop2: [...hop2] };
  }, [graph, centerId]);

  const positions = React.useMemo(
    () =>
      neighborhood
        ? layoutGraph(
            neighborhood.nodes.map((n) => ({ ...n, folderId: n.folderId })),
            neighborhood.edges,
          )
        : new Map<string, { x: number; y: number }>(),
    [neighborhood],
  );

  const flowNodes: Node<ExplorerNodeData, "explorer">[] = React.useMemo(
    () =>
      (neighborhood?.nodes ?? []).map((n) => {
        const pos = positions.get(n.id) ?? { x: 0, y: 0 };
        return {
          id: n.id,
          type: "explorer",
          position: pos,
          data: {
            title: n.title,
            mastery: n.mastery,
            center: n.id === centerId,
          },
          ariaLabel: `${n.title === "" ? t("gaia.shared.untitledNote") : n.title} — ${t(`gaia.memory.levels.${n.mastery}`)}`,
        };
      }),
    [neighborhood, positions, centerId, t],
  );
  const flowEdges: Edge[] = React.useMemo(
    () =>
      (neighborhood?.edges ?? []).map((e, i) => ({
        id: `e-${i}`,
        source: e.from,
        target: e.to,
        style:
          e.kind === "tag"
            ? { stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "5 4" }
            : e.kind === "relation"
              ? { stroke: "#FF6B5B", strokeWidth: 1.5 }
              : { stroke: "#22D3EE", strokeWidth: 1.5 },
        label: e.kind === "tag" ? e.tagName : e.kind === "relation" ? e.label : undefined,
      })),
    [neighborhood],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);
  React.useEffect(() => {
    setNodes(flowNodes);
  }, [flowNodes, setNodes]);
  React.useEffect(() => {
    setEdges(flowEdges);
  }, [flowEdges, setEdges]);

  const fitSignature = neighborhood
    ? [centerId, neighborhood.nodes.length, neighborhood.edges.length].join("|")
    : "";

  const pickCenter = (id: string, label: string) => {
    setCenterId(id);
    setCenterTitle(label);
    setCenterQuery("");
  };

  const isLoading =
    graphQuery.isLoading || orphansQuery.isLoading || timelineQuery.isLoading || collectionsQuery.isLoading;
  if (isLoading) {
    return (
      <div className="space-y-3" data-testid="gaia-knowledge-panel">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const totalNotes = graph?.nodes.length ?? 0;
  const orphanCount = orphans?.total ?? 0;
  const linkedCount = totalNotes - orphanCount;

  return (
    <div data-testid="gaia-knowledge-panel" className="space-y-4">
      {/* ── Relations explorer (K17) ── */}
      <section className="rounded-xl border bg-card p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Waypoints className="size-4 text-brand-cyan-deep dark:text-brand-cyan" aria-hidden="true" />
          {t("gaia.knowledge.explorerTitle")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("gaia.knowledge.explorerHint")}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("gaia.knowledge.coverage", { linked: linkedCount, total: totalNotes })}
        </p>

        <div className="relative mt-3 max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={centerQuery}
            onChange={(e) => setCenterQuery(e.target.value)}
            placeholder={t("gaia.knowledge.explorerSearchPlaceholder")}
            aria-label={t("gaia.knowledge.explorerSearchLabel")}
            className="pl-9 pr-9"
          />
          {centerQuery !== "" ? (
            <button
              type="button"
              aria-label={t("gaia.graph.clearSearch")}
              onClick={() => setCenterQuery("")}
              className="absolute right-1 top-1/2 flex min-h-9 min-w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
          {centerQuery.trim() !== "" && (refsQuery.data?.refs ?? []).length > 0 ? (
            <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-48 overflow-auto rounded-md border bg-popover p-1 shadow-md">
              {refsQuery.data!.refs.slice(0, 8).map((ref) => (
                <li key={ref.id}>
                  <button
                    type="button"
                    onClick={() => pickCenter(ref.id, ref.label)}
                    className="w-full truncate rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
                  >
                    {ref.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {centerId && neighborhood ? (
          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-coral/30 bg-brand-coral/10 px-2.5 py-1 text-xs font-medium text-brand-coral-deep dark:text-brand-coral">
                <Compass className="size-3.5" aria-hidden="true" />
                {centerTitle}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("gaia.knowledge.neighbors", {
                  hop1: neighborhood.hop1.length,
                  hop2: neighborhood.hop2.length,
                })}
              </span>
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenNote(centerId)}>
                {t("gaia.knowledge.openCenter")}
              </Button>
            </div>
            {neighborhood.nodes.length < 2 ? (
              <p className="mt-3 rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                {t("gaia.knowledge.noNeighbors")}
              </p>
            ) : (
              <div className="mt-3 h-[380px] overflow-hidden rounded-lg border">
                <ReactFlowProvider>
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onNodeClick={(_e, node) => pickCenter(node.id, node.data.title)}
                    nodeTypes={explorerNodeTypes}
                    forceColorMode={isDark ? "dark" : "light"}
                    nodesDraggable
                    nodesConnectable={false}
                    proOptions={{ hideAttribution: false }}
                    aria-label={t("gaia.knowledge.explorerTitle")}
                  >
                    <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
                    <Controls showInteractive={false} />
                    <MiniMap
                      pannable
                      zoomable
                      nodeColor={(node) =>
                        MASTERY_HEX[(node.data as ExplorerNodeData | undefined)?.mastery ?? "fragile"]
                      }
                    />
                    <FitExplorer signature={fitSignature} />
                  </ReactFlow>
                </ReactFlowProvider>
              </div>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">
              {t("gaia.knowledge.explorerClickHint")}
            </p>
          </div>
        ) : (
          <p className="mt-3 rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            {t("gaia.knowledge.explorerEmpty")}
          </p>
        )}
      </section>

      {/* ── Smart collections (K06) ── */}
      <section className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2">
          <FolderSearch className="size-4 text-brand-cyan-deep dark:text-brand-cyan" aria-hidden="true" />
          <h2 className="flex-1 text-sm font-semibold">{t("gaia.collections.title")}</h2>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            {t("gaia.collections.create")}
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t("gaia.collections.hint")}</p>
        {collections.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">{t("gaia.collections.empty")}</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {collections.map((collection) => (
              <li
                key={collection.id}
                className="flex items-center gap-2 rounded-lg border p-3 hover:border-brand-cyan/40"
              >
                <span className="text-lg leading-none" aria-hidden="true">
                  {collection.icon}
                </span>
                <button
                  type="button"
                  onClick={() => onOpenCollection(collection.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-sm font-semibold">{collection.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {collection.noteCount}{" "}
                    {collection.noteCount === 1
                      ? t("gaia.shared.noteOne")
                      : t("gaia.shared.noteMany")}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={t("gaia.collections.edit")}
                  onClick={() => {
                    setEditing(collection);
                    setDialogOpen(true);
                  }}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                >
                  <Link2 className="size-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={t("gaia.collections.delete")}
                  onClick={() => setDeleteTarget(collection)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-loss"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Orphan notes (K15) ── */}
      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">
          {t("gaia.knowledge.orphansTitle")} ({orphanCount})
        </h2>
        <p className="text-xs text-muted-foreground">{t("gaia.knowledge.orphansHint")}</p>
        {orphanCount === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">{t("gaia.knowledge.orphansEmpty")}</p>
        ) : (
          <ul className="mt-3 space-y-1">
            {(orphans?.notes ?? []).map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  onClick={() => onOpenNote(note.id)}
                  className="flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left hover:bg-muted/50"
                >
                  <span className="text-sm leading-none" aria-hidden="true">
                    {note.icon ?? "📝"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">
                    {note.title === "" ? t("gaia.shared.untitledNote") : note.title}
                  </span>
                  <MasteryBadge mastery={note.mastery} />
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {shortDate(note.updatedAt)}
                  </span>
                </button>
              </li>
            ))}
            {orphanCount > (orphans?.notes.length ?? 0) ? (
              <li className="px-2 py-1 text-xs text-muted-foreground">
                + {orphanCount - (orphans?.notes.length ?? 0)} {t("gaia.shared.noteMany")}
              </li>
            ) : null}
          </ul>
        )}
      </section>

      {/* ── Knowledge timeline (K16) ── */}
      <section className="rounded-xl border bg-card p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="size-4 text-brand-cyan-deep dark:text-brand-cyan" aria-hidden="true" />
          {t("gaia.knowledge.timelineTitle")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("gaia.knowledge.timelineHint")}</p>
        {timeline.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">{t("gaia.knowledge.timelineEmpty")}</p>
        ) : (
          <div className="mt-3 space-y-2">
            {timeline.map((month, mi) => {
              const open = openMonths[month.month] ?? mi === 0;
              return (
                <div key={month.month} className="rounded-lg border">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() =>
                      setOpenMonths((prev) => ({ ...prev, [month.month]: !(prev[month.month] ?? false) }))
                    }
                    className="flex min-h-11 w-full items-center gap-2 px-3 text-left"
                  >
                    <ChevronDown
                      className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
                      aria-hidden="true"
                    />
                    <span className="text-sm font-semibold">{monthLabel(month.month)}</span>
                    <span className="ml-auto font-mono text-xs text-muted-foreground tabular-nums">
                      {t("gaia.knowledge.monthStats", {
                        created: month.created,
                        edited: month.edited,
                        relations: month.relations,
                      })}
                    </span>
                  </button>
                  {open ? (
                    <ul className="border-t px-2 py-1">
                      {month.notes.map((note) => (
                        <li key={note.id}>
                          <button
                            type="button"
                            onClick={() => onOpenNote(note.id)}
                            className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-muted/50"
                          >
                            <span
                              className={`size-2 shrink-0 rounded-full ${MASTERY_META[note.mastery].dot}`}
                              aria-hidden="true"
                            />
                            <span className="min-w-0 flex-1 truncate text-sm">
                              {note.title === "" ? t("gaia.shared.untitledNote") : note.title}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {shortDate(note.createdAt)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <CollectionDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
        initial={editing}
      />

      <Dialog open={deleteTarget !== null} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {t("gaia.collections.deleteTitlePrefix")} “{deleteTarget?.name}”?
            </DialogTitle>
            <DialogDescription>{t("gaia.collections.deleteBody")}</DialogDescription>
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
                void deleteCollection.mutateAsync(deleteTarget.id).then(
                  () => setDeleteTarget(null),
                  (err: unknown) => toast({ variant: "destructive", title: gaiaErrorMessage(err) }),
                );
              }}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {t("gaia.collections.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
