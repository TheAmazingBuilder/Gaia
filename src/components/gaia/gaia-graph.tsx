"use client";

/**
 * Gaïa — Phase 2 "Graph" tab.
 *
 * (a) Knowledge graph (React Flow): nodes are notes, colored by mastery
 *     (dot + text label, never color alone); solid edges are note→note
 *     references, dashed edges are shared tags (opt-in). Layout is a
 *     hand-made radial BFS (src/lib/gaia/graph-layout.ts) — no extra
 *     layout dependency. Click a node to open the note.
 * (b) Memory timeline: notes grouped by creation month, newest first.
 * (c) Daily journal: today + this week, computed on the fly.
 *
 * Accessibility (ui-ux-pro-max): filter chips are real buttons with
 * aria-pressed, icon-only controls have aria-labels, the graph has a
 * text summary (node/edge counts) and the timeline is a plain list —
 * nothing is conveyed by color alone. Reduced motion is already handled
 * globally in globals.css (React Flow animations stay minimal).
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
  Network,
  Search,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GaiaEmptyState,
  gaiaErrorMessage,
  MASTERY_META,
  MasteryBadge,
  useGaiaMemoryGraph,
  useGaiaMemoryStats,
  type GaiaMemoryGraphEdge,
  type GaiaMemoryGraphNode,
} from "./gaia-shared";
import { layoutGraph } from "@/lib/gaia/graph-layout";
import {
  MASTERY_LEVELS,
  type MasteryLevel,
} from "@/lib/gaia/spaced-repetition";

/** Hex twins of the Phase 1 mastery dots (for MiniMap + edge colors). */
const MASTERY_HEX: Record<MasteryLevel, string> = {
  forgotten: "#6B7280",
  fragile: "#67E8F9",
  medium: "#22D3EE",
  mastered: "#FF6B5B",
};

type MemoryNodeData = {
  title: string;
  mastery: MasteryLevel;
};

type MemoryNodeType = Node<MemoryNodeData, "memory">;

// ── Theme (React Flow needs an explicit light/dark mode) ────────────────────
// The app theme lives on <html class="dark|light"> (see theme-provider).
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

// ── Custom node (module scope: React Flow remounts nodes otherwise) ────────

function MemoryNode({ data, selected }: NodeProps<MemoryNodeType>) {
  const t = useTranslations();
  const meta = MASTERY_META[data.mastery];
  return (
    <div
      className={`flex max-w-56 items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-sm ${
        selected ? "ring-2 ring-brand-coral" : meta.chip
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

const nodeTypes = { memory: MemoryNode };

// ── Fit the view when the visible graph changes ─────────────────────────────

function FitViewOnDataChange({ signature }: { signature: string }) {
  const { fitView } = useReactFlow();
  React.useEffect(() => {
    fitView({ padding: 0.2, maxZoom: 1 });
  }, [fitView, signature]);
  return null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA");
}

function monthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

// ── Panel ───────────────────────────────────────────────────────────────────

export function GraphPanel({
  onOpenNote,
  onCreateNote,
}: {
  onOpenNote: (id: string) => void;
  onCreateNote: (folderId?: string | null) => void;
}) {
  const t = useTranslations();
  const isDark = useIsDark();
  const graphQuery = useGaiaMemoryGraph();
  const statsQuery = useGaiaMemoryStats();
  const [query, setQuery] = React.useState("");
  const [hiddenMastery, setHiddenMastery] = React.useState<Record<MasteryLevel, boolean>>({
    forgotten: false,
    fragile: false,
    medium: false,
    mastered: false,
  });
  const [showTagLinks, setShowTagLinks] = React.useState(true);
  const [openMonths, setOpenMonths] = React.useState<Record<string, boolean>>({});

  const graph = graphQuery.data;
  const stats = statsQuery.data;

  const nodesData = React.useMemo(() => {
    if (!graph) return { nodes: [] as GaiaMemoryGraphNode[], edges: [] as GaiaMemoryGraphEdge[] };
    const nodes = graph.nodes.filter((n) => !hiddenMastery[n.mastery]);
    const visibleIds = new Set(nodes.map((n) => n.id));
    const edges = graph.edges.filter(
      (e) =>
        visibleIds.has(e.from) &&
        visibleIds.has(e.to) &&
        (e.kind === "ref" || showTagLinks),
    );
    return { nodes, edges };
  }, [graph, hiddenMastery, showTagLinks]);

  const positions = React.useMemo(
    () => layoutGraph(nodesData.nodes, nodesData.edges),
    [nodesData],
  );

  const q = query.trim().toLowerCase();
  const flowNodes: Node<MemoryNodeData, "memory">[] = React.useMemo(
    () =>
      nodesData.nodes.map((n) => {
        const pos = positions.get(n.id) ?? { x: 0, y: 0 };
        const matches = q === "" || n.title.toLowerCase().includes(q);
        return {
          id: n.id,
          type: "memory",
          position: pos,
          data: { title: n.title, mastery: n.mastery },
          ariaLabel: `${n.title === "" ? t("gaia.shared.untitledNote") : n.title} — ${t(`gaia.memory.levels.${n.mastery}`)}`,
          selected: q !== "" && matches,
          style: q === "" || matches ? undefined : { opacity: 0.25 },
        };
      }),
    [nodesData, positions, q, t],
  );
  const flowEdges: Edge[] = React.useMemo(
    () =>
      nodesData.edges.map((e, i) => ({
        id: `e-${i}`,
        source: e.from,
        target: e.to,
        type: e.kind === "tag" ? "straight" : "default",
        style:
          e.kind === "tag"
            ? { stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "5 4" }
            : { stroke: "#22D3EE", strokeWidth: 1.5 },
        label: e.kind === "tag" ? e.tagName : undefined,
      })),
    [nodesData],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);
  React.useEffect(() => {
    setNodes(flowNodes);
  }, [flowNodes, setNodes]);
  React.useEffect(() => {
    setEdges(flowEdges);
  }, [flowEdges, setEdges]);

  const refEdgeCount = nodesData.edges.filter((e) => e.kind === "ref").length;
  const tagEdgeCount = nodesData.edges.filter((e) => e.kind === "tag").length;
  const matchCount = q === "" ? null : flowNodes.filter((n) => n.selected).length;
  // Refit when the visible graph changes structurally (not on search typing).
  const fitSignature = [
    nodesData.nodes.length,
    nodesData.edges.length,
    MASTERY_LEVELS.map((l) => (hiddenMastery[l] ? "0" : "1")).join(""),
    showTagLinks ? "1" : "0",
  ].join("|");

  if (graphQuery.isLoading || statsQuery.isLoading) {
    return (
      <div className="space-y-3" data-testid="gaia-graph-panel">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[480px] w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (graphQuery.isError || statsQuery.isError) {
    return (
      <div data-testid="gaia-graph-panel">
        <GaiaEmptyState
          icon={<Network className="size-8" aria-hidden="true" />}
          title={t("gaia.graph.errorTitle")}
          body={gaiaErrorMessage(graphQuery.error ?? statsQuery.error)}
        />
      </div>
    );
  }

  if (!stats || stats.totalNotes === 0) {
    return (
      <div data-testid="gaia-graph-panel">
        <GaiaEmptyState
          icon={<Network className="size-8" aria-hidden="true" />}
          title={t("gaia.graph.emptyTitle")}
          body={t("gaia.graph.emptyBody")}
          testid="gaia-graph-empty"
          action={
            <Button type="button" size="sm" onClick={() => onCreateNote(null)}>
              {t("gaia.overview.createFirstNote")}
            </Button>
          }
        />
      </div>
    );
  }

  const toggleMonth = (month: string) =>
    setOpenMonths((prev) => ({ ...prev, [month]: !(prev[month] ?? false) }));

  return (
    <div data-testid="gaia-graph-panel" className="space-y-4">
      {/* ── Knowledge graph ── */}
      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">{t("gaia.graph.title")}</h2>
        <p className="text-xs text-muted-foreground">
          {t("gaia.graph.summary", {
            notes: nodesData.nodes.length,
            links: nodesData.edges.length,
          })}
          {q !== "" && matchCount !== null
            ? ` · ${t("gaia.graph.matches", { count: matchCount })}`
            : ""}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("gaia.graph.searchPlaceholder")}
              aria-label={t("gaia.graph.searchLabel")}
              className="min-h-11 pl-9 pr-9"
            />
            {query !== "" ? (
              <button
                type="button"
                aria-label={t("gaia.graph.clearSearch")}
                onClick={() => setQuery("")}
                className="absolute right-1 top-1/2 flex min-h-9 min-w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-brand-cyan"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          {MASTERY_LEVELS.map((level) => {
            const visible = !hiddenMastery[level];
            return (
              <button
                key={level}
                type="button"
                aria-pressed={visible}
                onClick={() =>
                  setHiddenMastery((prev) => ({ ...prev, [level]: !prev[level] }))
                }
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-brand-cyan ${
                  visible
                    ? "border-border bg-muted"
                    : "border-border bg-transparent text-muted-foreground opacity-60"
                }`}
              >
                <span
                  className={`size-2 rounded-full ${MASTERY_META[level].dot}`}
                  aria-hidden="true"
                />
                {t(`gaia.memory.levels.${level}`)}
              </button>
            );
          })}
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={showTagLinks}
              onChange={(e) => setShowTagLinks(e.target.checked)}
              className="size-4 accent-brand-cyan"
            />
            {t("gaia.graph.showTagLinks")}
          </label>
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <svg width="20" height="6" aria-hidden="true">
              <line x1="0" y1="3" x2="20" y2="3" stroke="#22D3EE" strokeWidth="2" />
            </svg>
            {t("gaia.graph.refLinks", { count: refEdgeCount })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="20" height="6" aria-hidden="true">
              <line
                x1="0"
                y1="3"
                x2="20"
                y2="3"
                stroke="#94a3b8"
                strokeWidth="2"
                strokeDasharray="4 3"
              />
            </svg>
            {t("gaia.graph.tagLinks", { count: tagEdgeCount })}
          </span>
          <span>{t("gaia.graph.graphHint")}</span>
        </p>

        {nodesData.nodes.length < 2 ? (
          <div className="mt-3 rounded-lg border border-dashed px-4 py-10 text-center">
            <p className="text-sm font-semibold">{t("gaia.graph.tooFewTitle")}</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              {t("gaia.graph.tooFewBody")}
            </p>
          </div>
        ) : (
          <div className="mt-3 h-[480px] overflow-hidden rounded-lg border">
            <ReactFlowProvider>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={(_e, node) => onOpenNote(node.id)}
                nodeTypes={nodeTypes}
                // v13 renamed the prop: forceColorMode (the bundled CSS
                // also follows the document color-scheme, set by the
                // app theme provider — this just makes it explicit).
                forceColorMode={isDark ? "dark" : "light"}
                nodesDraggable
                nodesConnectable={false}
                proOptions={{ hideAttribution: false }}
                aria-label={t("gaia.graph.title")}
              >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
                <Controls showInteractive={false} />
                <MiniMap
                  pannable
                  zoomable
                  nodeColor={(node) =>
                    MASTERY_HEX[(node.data as MemoryNodeData | undefined)?.mastery ?? "fragile"]
                  }
                />
                <FitViewOnDataChange signature={fitSignature} />
              </ReactFlow>
            </ReactFlowProvider>
          </div>
        )}
      </section>

      {/* ── Timeline ── */}
      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">{t("gaia.graph.timelineTitle")}</h2>
        <p className="text-xs text-muted-foreground">{t("gaia.graph.timelineHint")}</p>
        {stats.timeline.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">{t("gaia.graph.timelineEmpty")}</p>
        ) : (
          <div className="mt-3 space-y-2">
            {stats.timeline.map((month, mi) => {
              const open = openMonths[month.month] ?? mi === 0;
              return (
                <div key={month.month} className="rounded-lg border">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => toggleMonth(month.month)}
                    className="flex min-h-11 w-full items-center gap-2 px-3 text-left focus-visible:outline-2 focus-visible:outline-brand-cyan"
                  >
                    <ChevronDown
                      className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
                      aria-hidden="true"
                    />
                    <span className="text-sm font-semibold">{monthLabel(month.month)}</span>
                    <span className="ml-auto font-mono text-xs text-muted-foreground tabular-nums">
                      {t("gaia.graph.monthCount", { count: month.count })}
                    </span>
                  </button>
                  {open ? (
                    <ul className="border-t px-2 py-1">
                      {month.notes.map((note) => (
                        <li key={note.id}>
                          <button
                            type="button"
                            onClick={() => onOpenNote(note.id)}
                            className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-brand-cyan"
                          >
                            <span
                              className={`size-2 shrink-0 rounded-full ${MASTERY_META[note.mastery].dot}`}
                              aria-hidden="true"
                            />
                            <span className="min-w-0 flex-1 truncate text-sm">
                              {note.title === ""
                                ? t("gaia.shared.untitledNote")
                                : note.title}
                            </span>
                            <MasteryBadge mastery={note.mastery} />
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {shortDate(note.createdAt)}
                            </span>
                          </button>
                        </li>
                      ))}
                      {month.count > month.notes.length ? (
                        <li className="px-2 py-1 text-xs text-muted-foreground">
                          {t("gaia.graph.moreNotes", {
                            count: month.count - month.notes.length,
                          })}
                        </li>
                      ) : null}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Daily journal ── */}
      <section className="rounded-xl border bg-card p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="size-4 text-brand-cyan-deep dark:text-brand-cyan" aria-hidden="true" />
          {t("gaia.graph.journalTitle")}
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border bg-muted/30 p-3">
            <dt className="text-xs text-muted-foreground">{t("gaia.graph.journalCreated")}</dt>
            <dd className="mt-1 font-mono text-2xl font-bold tabular-nums">
              {stats.journal.today.created}
            </dd>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <dt className="text-xs text-muted-foreground">{t("gaia.graph.journalReviewed")}</dt>
            <dd className="mt-1 font-mono text-2xl font-bold tabular-nums">
              {stats.journal.today.reviewed}
            </dd>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <dt className="text-xs text-muted-foreground">{t("gaia.graph.journalDue")}</dt>
            <dd className="mt-1 font-mono text-2xl font-bold tabular-nums">
              {stats.journal.today.dueRemaining}
            </dd>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <dt className="text-xs text-muted-foreground">{t("gaia.graph.journalMastered")}</dt>
            <dd className="mt-1 font-mono text-2xl font-bold tabular-nums">
              {stats.journal.today.newlyMastered}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          {t("gaia.graph.journalWeek", {
            created: stats.journal.week.created,
            reviewed: stats.journal.week.reviewed,
          })}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {t("gaia.graph.journalNote")}
        </p>
      </section>
    </div>
  );
}
