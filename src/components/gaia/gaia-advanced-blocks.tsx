"use client";

/**
 * Gaïa — Module 1 : blocs avancés (équation, dessin, Mermaid, embed,
 * table des matières, commentaires).
 *
 * Ces composants reçoivent les ops de l'éditeur (définies dans
 * gaia-blocks.tsx) en `import type` uniquement : pas d'import circulaire
 * à l'exécution.
 */
import * as React from "react";
import dynamic from "next/dynamic";
import {
  Check,
  Eraser,
  ExternalLink,
  Globe2,
  ListTree,
  MessageSquare,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  gaiaRelativeTime,
  type GaiaBlock,
  type GaiaT,
} from "./gaia-shared";
import type { GaiaBlockOps } from "./gaia-blocks";

const EquationView = dynamic(
  () => import("./gaia-equation-view").then((m) => m.EquationView),
  { ssr: false },
);
const MermaidView = dynamic(
  () => import("./gaia-mermaid-view").then((m) => m.MermaidView),
  { ssr: false },
);

// ── Équation (E14) ───────────────────────────────────────────────────────────

export function EquationBlock({
  block,
  ops,
  t,
}: {
  block: GaiaBlock;
  ops: GaiaBlockOps;
  t: GaiaT;
}) {
  const [editing, setEditing] = React.useState(block.text.trim() === "");
  return (
    <div data-testid="gaia-equation" className="rounded-md border bg-card px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {t("gaia.blockTypes.equation")}
        </span>
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          aria-label={t("gaia.blocks.editEquation")}
          title={t("gaia.blocks.editEquation")}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Pencil className="size-3.5" aria-hidden="true" />
        </button>
      </div>
      {editing ? (
        <textarea
          defaultValue={block.text}
          rows={2}
          onChange={(e) => ops.updateText(block.id, e.target.value)}
          placeholder={t("gaia.blocks.equationPlaceholder")}
          aria-label={t("gaia.blocks.equationLabel")}
          className="mt-1 w-full resize-y rounded-sm border border-transparent bg-muted/40 px-2 py-1.5 font-mono text-[13px] outline-none focus:border-border focus:bg-background"
        />
      ) : null}
      <EquationView latex={block.text} />
    </div>
  );
}

// ── Dessin (E16) ─────────────────────────────────────────────────────────────

const DRAW_COLORS = ["#0A0A12", "#FF6B5B", "#22D3EE", "#8B5CF6", "#F59E0B"];
const DRAW_SIZES = [2, 5, 10];

type Stroke = { color: string; size: number; points: Array<{ x: number; y: number }> };

function drawStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  base: HTMLImageElement | null,
) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (base) ctx.drawImage(base, 0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (const p of stroke.points.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
}

export function DrawingBlock({
  block,
  ops,
  t,
}: {
  block: GaiaBlock;
  ops: GaiaBlockOps;
  t: GaiaT;
}) {
  const [editing, setEditing] = React.useState(!block.src);
  const [color, setColor] = React.useState(DRAW_COLORS[1]);
  const [size, setSize] = React.useState(5);
  const [eraser, setEraser] = React.useState(false);
  const [strokes, setStrokes] = React.useState<Stroke[]>([]);
  const [tooBig, setTooBig] = React.useState(false);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const baseRef = React.useRef<HTMLImageElement | null>(null);
  const currentRef = React.useRef<Stroke | null>(null);

  React.useEffect(() => {
    if (!editing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (block.src && !baseRef.current) {
      const img = new Image();
      img.onload = () => {
        baseRef.current = img;
        drawStrokes(ctx, strokes, img);
      };
      img.src = block.src;
    } else {
      drawStrokes(ctx, strokes, baseRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, strokes]);

  const posOf = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    if (url.length > 2_000_000) {
      setTooBig(true);
      return;
    }
    setTooBig(false);
    ops.updateBlock(block.id, { src: url });
    setEditing(false);
  };

  if (!editing) {
    if (!block.src) {
      return (
        <div className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          <Pencil className="size-4" aria-hidden="true" />
          <span className="flex-1">{t("gaia.blocks.drawingEmpty")}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            {t("gaia.blocks.draw")}
          </Button>
        </div>
      );
    }
    return (
      <figure data-testid="gaia-drawing" className="overflow-hidden rounded-md border">
        <img src={block.src} alt={block.caption ?? t("gaia.blocks.drawingAlt")} className="w-full bg-white" />
        <figcaption className="flex items-center gap-2 border-t bg-card px-2 py-1.5">
          <Input
            defaultValue={block.caption ?? ""}
            onChange={(e) => ops.updateBlock(block.id, { caption: e.target.value })}
            placeholder={t("gaia.blocks.captionPlaceholder")}
            aria-label={t("gaia.blocks.captionLabel")}
            className="h-7 border-transparent bg-transparent text-xs"
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
            {t("gaia.blocks.editDrawing")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 hover:text-loss"
            aria-label={t("gaia.blocks.removeDrawing")}
            title={t("gaia.blocks.removeDrawing")}
            onClick={() => ops.updateBlock(block.id, { src: undefined, caption: undefined })}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </Button>
        </figcaption>
      </figure>
    );
  }

  return (
    <div data-testid="gaia-drawing-editor" className="rounded-md border bg-card p-2">
      <canvas
        ref={canvasRef}
        width={960}
        height={480}
        aria-label={t("gaia.blocks.drawingLabel")}
        className="w-full touch-none rounded-sm border bg-white"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          currentRef.current = {
            color: eraser ? "#FFFFFF" : color,
            size: eraser ? size * 3 : size,
            points: [posOf(e)],
          };
        }}
        onPointerMove={(e) => {
          const current = currentRef.current;
          if (!current) return;
          current.points.push(posOf(e));
          const ctx = canvasRef.current?.getContext("2d");
          if (ctx) drawStrokes(ctx, [...strokes, current], baseRef.current);
        }}
        onPointerUp={() => {
          const current = currentRef.current;
          currentRef.current = null;
          if (current && current.points.length > 0) {
            setStrokes((prev) => [...prev, current]);
          }
        }}
      />
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {DRAW_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`${t("gaia.blocks.drawColor")} ${c}`}
            onClick={() => {
              setColor(c);
              setEraser(false);
            }}
            className={`size-6 rounded-full border ${color === c && !eraser ? "ring-2 ring-brand-cyan ring-offset-1" : ""}`}
            style={{ background: c }}
          />
        ))}
        {DRAW_SIZES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSize(s)}
            className={`flex h-6 w-8 items-center justify-center rounded border text-xs ${size === s ? "border-brand-cyan bg-brand-cyan/10" : ""}`}
          >
            {s}px
          </button>
        ))}
        <button
          type="button"
          onClick={() => setEraser((v) => !v)}
          aria-label={t("gaia.blocks.eraser")}
          title={t("gaia.blocks.eraser")}
          className={`rounded border p-1.5 ${eraser ? "border-brand-cyan bg-brand-cyan/10" : ""}`}
        >
          <Eraser className="size-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          disabled={strokes.length === 0}
          onClick={() => setStrokes((prev) => prev.slice(0, -1))}
          className="rounded border px-2 py-1 text-xs disabled:opacity-40"
        >
          {t("gaia.blocks.undo")}
        </button>
        <button
          type="button"
          onClick={() => {
            setStrokes([]);
            baseRef.current = null;
          }}
          className="rounded border px-2 py-1 text-xs"
        >
          {t("gaia.blocks.clear")}
        </button>
        <span className="ml-auto flex gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(false);
              setStrokes([]);
            }}
          >
            {t("common.cancel")}
          </Button>
          <Button type="button" size="sm" onClick={save}>
            {t("gaia.blocks.saveDrawing")}
          </Button>
        </span>
      </div>
      {tooBig ? (
        <p className="mt-1 text-xs text-loss">{t("gaia.blocks.drawingTooBig")}</p>
      ) : null}
    </div>
  );
}

// ── Mermaid (E17) ────────────────────────────────────────────────────────────

export function MermaidBlock({
  block,
  ops,
  t,
}: {
  block: GaiaBlock;
  ops: GaiaBlockOps;
  t: GaiaT;
}) {
  const [editing, setEditing] = React.useState(block.text.trim() === "");
  return (
    <div data-testid="gaia-mermaid" className="rounded-md border bg-card px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {t("gaia.blockTypes.mermaid")}
        </span>
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          aria-label={t("gaia.blocks.editDiagram")}
          title={t("gaia.blocks.editDiagram")}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Pencil className="size-3.5" aria-hidden="true" />
        </button>
      </div>
      {editing ? (
        <textarea
          defaultValue={block.text}
          rows={4}
          onChange={(e) => ops.updateText(block.id, e.target.value)}
          placeholder={t("gaia.blocks.mermaidPlaceholder")}
          aria-label={t("gaia.blocks.mermaidLabel")}
          className="mt-1 w-full resize-y rounded-sm border border-transparent bg-muted/40 px-2 py-1.5 font-mono text-[13px] outline-none focus:border-border focus:bg-background"
        />
      ) : null}
      <MermaidView code={block.text} />
    </div>
  );
}

// ── Embed (E18) ──────────────────────────────────────────────────────────────

function youtubeId(url: string): string | null {
  const m = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/.exec(url);
  return m ? m[1] : null;
}

function vimeoId(url: string): string | null {
  const m = /vimeo\.com\/(\d+)/.exec(url);
  return m ? m[1] : null;
}

export function EmbedBlock({
  block,
  ops,
  t,
}: {
  block: GaiaBlock;
  ops: GaiaBlockOps;
  t: GaiaT;
}) {
  const [url, setUrl] = React.useState("");
  const src = block.text.trim();
  if (src === "") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed p-3">
        <Globe2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && url.trim() !== "") {
              e.preventDefault();
              ops.updateText(block.id, url.trim());
              setUrl("");
            }
          }}
          placeholder={t("gaia.blocks.embedPlaceholder")}
          aria-label={t("gaia.blocks.embedLabel")}
          className="h-8 text-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0"
          disabled={url.trim() === ""}
          onClick={() => {
            ops.updateText(block.id, url.trim());
            setUrl("");
          }}
        >
          {t("gaia.blocks.embedAdd")}
        </Button>
      </div>
    );
  }
  const yt = youtubeId(src);
  const vm = vimeoId(src);
  return (
    <div data-testid="gaia-embed" className="overflow-hidden rounded-md border">
      {yt ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${yt}`}
          title={src}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="aspect-video w-full"
        />
      ) : vm ? (
        <iframe
          src={`https://player.vimeo.com/video/${vm}`}
          title={src}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="aspect-video w-full"
        />
      ) : (
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2.5 p-3 hover:bg-muted/40"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
            <Globe2 className="size-4 text-muted-foreground" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {(() => {
                try {
                  return new URL(src).hostname;
                } catch {
                  return src;
                }
              })()}
            </span>
            <span className="block truncate text-xs text-muted-foreground">{src}</span>
          </span>
          <ExternalLink className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </a>
      )}
      <div className="flex items-center justify-end gap-1 border-t bg-card px-2 py-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => ops.updateText(block.id, "")}
        >
          {t("gaia.blocks.embedChange")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 hover:text-loss"
          aria-label={t("gaia.blocks.removeEmbed")}
          title={t("gaia.blocks.removeEmbed")}
          onClick={() => ops.deleteBlock(block.id)}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

// ── Table des matières (E13) ─────────────────────────────────────────────────

export function TocBlock({
  headings,
  onNavigate,
  t,
}: {
  headings: Array<{ id: string; level: 1 | 2 | 3; text: string }>;
  onNavigate: (blockId: string) => void;
  t: GaiaT;
}) {
  return (
    <div data-testid="gaia-toc" className="rounded-md border bg-card px-3 py-2">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <ListTree className="size-3.5" aria-hidden="true" />
        {t("gaia.blockTypes.toc")}
      </p>
      {headings.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">{t("gaia.blocks.tocEmpty")}</p>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {headings.map((h) => (
            <li key={h.id} style={{ paddingLeft: `${(h.level - 1) * 14}px` }}>
              <button
                type="button"
                onClick={() => onNavigate(h.id)}
                className={`block w-full truncate rounded-sm px-1.5 py-0.5 text-left text-[13px] hover:bg-muted hover:text-foreground ${
                  h.level === 1 ? "font-semibold" : "text-muted-foreground"
                }`}
              >
                {h.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Commentaires (E09) ───────────────────────────────────────────────────────

export function CommentsPanel({
  block,
  ops,
  authorName,
  t,
}: {
  block: GaiaBlock;
  ops: GaiaBlockOps;
  authorName: string;
  t: GaiaT;
}) {
  const [draft, setDraft] = React.useState("");
  const comments = block.comments ?? [];
  const openCount = comments.filter((c) => !c.resolved).length;
  const submit = () => {
    const text = draft.trim();
    if (text === "") return;
    ops.addComment(block.id, text, authorName);
    setDraft("");
  };
  return (
    <div data-testid="gaia-comments" className="mt-1.5 rounded-md border bg-muted/30 px-3 py-2">
      <p className="flex items-center gap-1.5 text-xs font-medium">
        <MessageSquare className="size-3.5 text-brand-cyan" aria-hidden="true" />
        {t("gaia.blocks.commentsTitle")}
        {openCount > 0 ? (
          <span className="rounded-full bg-brand-coral/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand-coral-deep dark:text-brand-coral">
            {openCount}
          </span>
        ) : null}
      </p>
      {comments.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {comments.map((c) => (
            <li key={c.id} className={c.resolved ? "opacity-55" : ""}>
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => ops.toggleCommentResolved(block.id, c.id)}
                  aria-label={t("gaia.blocks.resolveComment")}
                  title={t("gaia.blocks.resolveComment")}
                  className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border ${
                    c.resolved ? "border-brand-cyan bg-brand-cyan text-[#0A0A12]" : "border-border"
                  }`}
                >
                  {c.resolved ? <Check className="size-3" aria-hidden="true" /> : null}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-xs">
                    <span className="font-semibold">{c.author || t("gaia.blocks.commentAuthorFallback")}</span>
                    <span className="text-muted-foreground">
                      {" · "}
                      {c.createdAt ? gaiaRelativeTime(c.createdAt, t) : ""}
                      {c.resolved ? ` · ${t("gaia.blocks.commentResolved")}` : ""}
                    </span>
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px]">{c.text}</p>
                </div>
                <button
                  type="button"
                  onClick={() => ops.deleteComment(block.id, c.id)}
                  aria-label={t("gaia.blocks.deleteComment")}
                  title={t("gaia.blocks.deleteComment")}
                  className="rounded p-0.5 text-muted-foreground hover:text-loss"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-2 flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={t("gaia.blocks.commentPlaceholder")}
          aria-label={t("gaia.blocks.commentLabel")}
          className="h-8 text-xs"
        />
        <Button type="button" size="sm" className="h-8 shrink-0" disabled={draft.trim() === ""} onClick={submit}>
          {t("gaia.blocks.commentAdd")}
        </Button>
      </div>
    </div>
  );
}
