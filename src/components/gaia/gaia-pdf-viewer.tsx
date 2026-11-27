"use client";

/**
 * Gaïa — visionneuse PDF (Module 3, F04/F05/F10).
 *
 * pdf.js rend la page courante sur un canvas ; les annotations (punaises
 * de note, surlignages) sont un calque positionné en coordonnées relatives
 * (0–1) pour survivre au zoom. Le calque texte du PDF est extrait
 * automatiquement (recherche F12) ; l'OCR (tesseract.js, eng+fra) couvre
 * les PDF scannés et les images, page par page (10 pages max).
 */
import * as React from "react";
import * as pdfjsLib from "pdfjs-dist";
import {
  ChevronLeft,
  ChevronRight,
  Highlighter,
  Loader2,
  MessageSquarePlus,
  ScanText,
  StickyNote,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  gaiaFileDownloadUrl,
  useCreateGaiaFileAnnotation,
  useDeleteGaiaFileAnnotation,
  useSaveGaiaFileText,
  type GaiaFileAnnotationDTO,
  type GaiaFileDetailDTO,
  type GaiaT,
} from "./gaia-shared";

const PDFJS_VERSION = "6.5.438";
const PDF_WORKER_SRC = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;
const MAX_OCR_PAGES = 10;

let workerConfigured = false;
function ensurePdfWorker() {
  if (workerConfigured) return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
  workerConfigured = true;
}

export function GaiaPdfViewer({
  file,
  t,
}: {
  file: GaiaFileDetailDTO;
  t: GaiaT;
}) {
  const [numPages, setNumPages] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [scale, setScale] = React.useState(1.25);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<"none" | "note" | "highlight">("none");
  const [pending, setPending] = React.useState<{ x: number; y: number } | null>(null);
  const [noteText, setNoteText] = React.useState("");
  const [drag, setDrag] = React.useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [extracting, setExtracting] = React.useState<string | null>(null);
  const [ocrProgress, setOcrProgress] = React.useState("");
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const docRef = React.useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const taskRef = React.useRef<pdfjsLib.PDFDocumentLoadingTask | null>(null);
  const textSavedRef = React.useRef(false);

  const saveText = useSaveGaiaFileText();
  const createAnnotation = useCreateGaiaFileAnnotation();
  const deleteAnnotation = useDeleteGaiaFileAnnotation();

  const downloadUrl = gaiaFileDownloadUrl(file.id);

  // Chargement du document + extraction du calque texte (une fois).
  React.useEffect(() => {
    let cancelled = false;
    textSavedRef.current = false;
    setNumPages(0);
    setPage(1);
    setLoadError(null);
    ensurePdfWorker();
    const task = pdfjsLib.getDocument({ url: downloadUrl });
    taskRef.current = task;
    task.promise
      .then(async (doc) => {
        if (cancelled) return;
        docRef.current = doc;
        setNumPages(doc.numPages);
        if (!file.hasText) {
          try {
            const parts: string[] = [];
            const limit = Math.min(doc.numPages, 20);
            for (let p = 1; p <= limit; p += 1) {
              const pdfPage = await doc.getPage(p);
              const content = await pdfPage.getTextContent();
              parts.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
            }
            const text = parts.join("\n").trim();
            if (text !== "" && !textSavedRef.current) {
              textSavedRef.current = true;
              await saveText.mutateAsync({ fileId: file.id, text: text.slice(0, 200_000), source: "pdf" });
            }
          } catch {
            // Pas de calque texte (PDF scanné) : l'OCR manuel prend le relais.
          }
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError("pdf");
      });
    return () => {
      cancelled = true;
      void taskRef.current?.destroy();
      taskRef.current = null;
      docRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id]);

  // Rendu de la page courante.
  React.useEffect(() => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || numPages === 0) return;
    let cancelled = false;
    doc.getPage(page).then((pdfPage) => {
      if (cancelled) return;
      const viewport = pdfPage.getViewport({ scale });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = "100%";
      canvas.style.height = "auto";
      void pdfPage.render({ canvas, viewport }).promise;
    });
    return () => {
      cancelled = true;
    };
  }, [page, scale, numPages]);

  const pageAnnotations = file.annotations.filter((a) => a.page === page);

  const relativePos = (e: React.MouseEvent): { x: number; y: number } => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (mode !== "note") return;
    setPending(relativePos(e));
    setNoteText("");
  };

  const savePendingNote = () => {
    if (!pending) return;
    void createAnnotation.mutateAsync({
      fileId: file.id,
      page,
      x: pending.x,
      y: pending.y,
      type: "note",
      text: noteText.trim() === "" ? t("gaia.files.annotationDefaultText") : noteText.trim(),
    });
    setPending(null);
    setMode("none");
  };

  const handleDragStart = (e: React.MouseEvent) => {
    if (mode !== "highlight") return;
    const pos = relativePos(e);
    setDrag({ x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y });
  };

  const handleDragMove = (e: React.MouseEvent) => {
    if (!drag) return;
    const pos = relativePos(e);
    setDrag({ ...drag, x1: pos.x, y1: pos.y });
  };

  const handleDragEnd = () => {
    if (!drag) return;
    const x = Math.min(drag.x0, drag.x1);
    const y = Math.min(drag.y0, drag.y1);
    const w = Math.abs(drag.x1 - drag.x0);
    const h = Math.abs(drag.y1 - drag.y0);
    setDrag(null);
    if (w < 0.01 || h < 0.005) return;
    void createAnnotation.mutateAsync({
      fileId: file.id,
      page,
      x,
      y,
      width: w,
      height: h,
      type: "highlight",
      text: "",
    });
    setMode("none");
  };

  const runOcr = async () => {
    if (extracting) return;
    setExtracting("ocr");
    setOcrProgress("");
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker(["eng", "fra"]);
      const doc = docRef.current;
      const parts: string[] = [];
      const limit = Math.min(numPages, MAX_OCR_PAGES);
      for (let p = 1; p <= limit; p += 1) {
        setOcrProgress(`${p}/${limit}`);
        const pdfPage = await doc!.getPage(p);
        const viewport = pdfPage.getViewport({ scale: 2 });
        const offscreen = document.createElement("canvas");
        offscreen.width = Math.floor(viewport.width);
        offscreen.height = Math.floor(viewport.height);
        await pdfPage.render({ canvas: offscreen, viewport }).promise;
        const { data } = await worker.recognize(offscreen);
        if (data.text.trim() !== "") parts.push(data.text.trim());
      }
      await worker.terminate();
      const text = parts.join("\n").trim();
      if (text !== "") {
        await saveText.mutateAsync({ fileId: file.id, text: text.slice(0, 200_000), source: "ocr" });
      }
    } catch {
      // OCR indisponible (réseau / worker) : l'erreur est signalée par l'absence de texte.
    } finally {
      setExtracting(null);
      setOcrProgress("");
    }
  };

  if (loadError) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        {t("gaia.files.pdfLoadError")}{" "}
        <a className="text-brand-cyan underline" href={downloadUrl} target="_blank" rel="noreferrer">
          {t("gaia.files.download")}
        </a>
      </div>
    );
  }

  return (
    <div data-testid="gaia-pdf-viewer" className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label={t("gaia.files.prevPage")}>
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <span className="min-w-14 text-center text-xs text-muted-foreground">
            {numPages === 0 ? "…" : `${page} / ${numPages}`}
          </span>
          <Button type="button" variant="outline" size="icon" className="h-7 w-7" disabled={page >= numPages} onClick={() => setPage((p) => Math.min(numPages, p + 1))} aria-label={t("gaia.files.nextPage")}>
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon" className="h-7 w-7" disabled={scale <= 0.5} onClick={() => setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)))} aria-label={t("gaia.files.zoomOut")}>
            <ZoomOut className="size-4" aria-hidden="true" />
          </Button>
          <span className="min-w-10 text-center text-xs text-muted-foreground">{Math.round(scale * 100)}%</span>
          <Button type="button" variant="outline" size="icon" className="h-7 w-7" disabled={scale >= 2.5} onClick={() => setScale((s) => Math.min(2.5, +(s + 0.25).toFixed(2)))} aria-label={t("gaia.files.zoomIn")}>
            <ZoomIn className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button type="button" variant={mode === "note" ? "secondary" : "outline"} size="sm" className="h-7 text-xs" onClick={() => { setMode(mode === "note" ? "none" : "note"); setPending(null); }}>
            <StickyNote className="size-3.5" aria-hidden="true" /> {t("gaia.files.addNote")}
          </Button>
          <Button type="button" variant={mode === "highlight" ? "secondary" : "outline"} size="sm" className="h-7 text-xs" onClick={() => { setMode(mode === "highlight" ? "none" : "highlight"); setDrag(null); }}>
            <Highlighter className="size-3.5" aria-hidden="true" /> {t("gaia.files.highlight")}
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" disabled={extracting !== null || numPages === 0} onClick={() => void runOcr()}>
            {extracting ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <ScanText className="size-3.5" aria-hidden="true" />}
            {extracting ? `${t("gaia.files.ocrRunning")} ${ocrProgress}` : t("gaia.files.ocr")}
          </Button>
        </div>
      </div>

      {mode !== "none" ? (
        <p className="text-xs text-muted-foreground">
          {mode === "note" ? t("gaia.files.noteModeHint") : t("gaia.files.highlightModeHint")}
        </p>
      ) : null}

      <div className="relative overflow-hidden rounded-md border bg-muted/30">
        <canvas ref={canvasRef} className="block w-full" />
        <div
          ref={overlayRef}
          className={`absolute inset-0 ${mode === "none" ? "pointer-events-none" : "cursor-crosshair"}`}
          onClick={handleOverlayClick}
          onMouseDown={handleDragStart}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
        >
          {pageAnnotations.map((a) =>
            a.type === "highlight" && a.width && a.height ? (
              <span
                key={a.id}
                className="group/ann pointer-events-auto absolute rounded-sm"
                style={{
                  left: `${a.x * 100}%`,
                  top: `${a.y * 100}%`,
                  width: `${a.width * 100}%`,
                  height: `${a.height * 100}%`,
                  backgroundColor: `${a.color}55`,
                }}
                title={t("gaia.files.highlight")}
              >
                <button
                  type="button"
                  aria-label={t("gaia.files.deleteAnnotation")}
                  onClick={(e) => {
                    e.stopPropagation();
                    void deleteAnnotation.mutateAsync({ fileId: file.id, annotationId: a.id });
                  }}
                  className="absolute -right-2 -top-2 hidden size-5 items-center justify-center rounded-full border bg-card text-muted-foreground group-hover/ann:flex hover:text-loss"
                >
                  <Trash2 className="size-3" aria-hidden="true" />
                </button>
              </span>
            ) : (
              <span
                key={a.id}
                className="group/ann pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%` }}
                title={a.text}
              >
                <span className="flex size-5 items-center justify-center rounded-full border text-[10px] font-bold" style={{ backgroundColor: a.color, borderColor: a.color, color: "#0A0A12" }}>
                  !
                </span>
                <span className="absolute left-6 top-0 hidden w-48 rounded-md border bg-card p-2 text-xs shadow-md group-hover/ann:block">
                  {a.text}
                  <button
                    type="button"
                    aria-label={t("gaia.files.deleteAnnotation")}
                    onClick={(e) => {
                      e.stopPropagation();
                      void deleteAnnotation.mutateAsync({ fileId: file.id, annotationId: a.id });
                    }}
                    className="mt-1 flex items-center gap-1 text-loss hover:underline"
                  >
                    <Trash2 className="size-3" aria-hidden="true" /> {t("gaia.files.delete")}
                  </button>
                </span>
              </span>
            ),
          )}
          {drag ? (
            <span
              className="absolute rounded-sm border border-dashed"
              style={{
                left: `${Math.min(drag.x0, drag.x1) * 100}%`,
                top: `${Math.min(drag.y0, drag.y1) * 100}%`,
                width: `${Math.abs(drag.x1 - drag.x0) * 100}%`,
                height: `${Math.abs(drag.y1 - drag.y0) * 100}%`,
                backgroundColor: "#FF6B5B33",
                borderColor: "#FF6B5B",
              }}
            />
          ) : null}
          {pending ? (
            <span
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${pending.x * 100}%`, top: `${pending.y * 100}%` }}
            >
              <span className="flex size-5 items-center justify-center rounded-full bg-brand-coral text-[10px] font-bold text-[#0A0A12]">!</span>
            </span>
          ) : null}
        </div>
      </div>

      {pending ? (
        <div className="flex gap-2">
          <Input
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") savePendingNote();
              if (e.key === "Escape") setPending(null);
            }}
            placeholder={t("gaia.files.annotationPlaceholder")}
            aria-label={t("gaia.files.annotationPlaceholder")}
            className="h-8 text-xs"
            autoFocus
          />
          <Button type="button" size="sm" className="h-8" onClick={savePendingNote}>
            <MessageSquarePlus className="size-3.5" aria-hidden="true" /> {t("gaia.files.saveAnnotation")}
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => setPending(null)}>
            {t("gaia.files.cancel")}
          </Button>
        </div>
      ) : null}

      {pageAnnotations.length > 0 ? (
        <ul className="space-y-1">
          {pageAnnotations.map((a: GaiaFileAnnotationDTO) => (
            <li key={a.id} className="flex items-start gap-2 rounded-md border bg-card px-2 py-1.5 text-xs">
              <span className="mt-0.5 inline-block size-2.5 shrink-0 rounded-full" style={{ backgroundColor: a.color }} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="text-muted-foreground">{t("gaia.files.page")} {a.page} · {a.type === "highlight" ? t("gaia.files.highlight") : t("gaia.files.note")}</span>
                {a.text ? <span className="block truncate">{a.text}</span> : null}
              </span>
              <button
                type="button"
                aria-label={t("gaia.files.deleteAnnotation")}
                onClick={() => void deleteAnnotation.mutateAsync({ fileId: file.id, annotationId: a.id })}
                className="shrink-0 text-muted-foreground hover:text-loss"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
