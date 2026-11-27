"use client";

/**
 * Gaïa — gestion des fichiers (Module 3, F01–F15).
 *
 * FilesPanel : onglet « Files » — upload (drag & drop), recherche par nom
 * et texte extrait, filtres par type/dossier, galerie d'images, détail
 * (aperçu, versions, annotations PDF, références, OCR), barre de stockage.
 * AttachmentsPanel : pièces jointes d'une note (éditeur, F06).
 * GaiaFilePicker : dialogue de choix d'un fichier existant (bloc `file`).
 */
import * as React from "react";
import {
  ChevronLeft,
  Download,
  File as FileIcon,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Folder,
  History,
  LayoutGrid,
  Link2,
  List,
  Loader2,
  Music,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  ScanText,
  Search,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatFileSize, fileKindOf, fileUploadError, GAIA_FILE_KINDS, GAIA_MAX_FILE_BYTES, type GaiaFileKind } from "@/lib/gaia/files";
import {
  gaiaFileDownloadUrl,
  gaiaErrorMessage,
  useAttachGaiaFile,
  useDeleteGaiaFile,
  useDetachGaiaFile,
  useGaiaFile,
  useGaiaFiles,
  useGaiaFolders,
  useGaiaNoteFiles,
  useGaiaStorageUsage,
  useReplaceGaiaFile,
  useRestoreGaiaFileVersion,
  useSaveGaiaFileText,
  useUpdateGaiaFile,
  useUploadGaiaFile,
  type GaiaFileDetailDTO,
  type GaiaFileDTO,
  type GaiaT,
} from "./gaia-shared";
import { GaiaPdfViewer } from "./gaia-pdf-viewer";

export function FileKindIcon({ kind, className }: { kind: GaiaFileKind; className?: string }) {
  const cls = className ?? "size-4";
  switch (kind) {
    case "image":
      return <FileImage className={cls} aria-hidden="true" />;
    case "pdf":
      return <FileText className={cls} aria-hidden="true" />;
    case "audio":
      return <FileAudio className={cls} aria-hidden="true" />;
    case "video":
      return <FileVideo className={cls} aria-hidden="true" />;
    case "document":
      return <FileText className={cls} aria-hidden="true" />;
    default:
      return <FileIcon className={cls} aria-hidden="true" />;
  }
}

/** Aperçu d'un fichier selon son type (F11). */
export function FilePreview({ file, t }: { file: GaiaFileDetailDTO; t: GaiaT }) {
  const url = gaiaFileDownloadUrl(file.id);
  if (file.kind === "image") {
    return (
      <div className="overflow-hidden rounded-md border bg-muted/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={file.name} className="max-h-[480px] w-full object-contain" />
      </div>
    );
  }
  if (file.kind === "pdf") {
    return <GaiaPdfViewer file={file} t={t} />;
  }
  if (file.kind === "audio") {
    return (
      <div className="flex items-center gap-3 rounded-md border bg-card p-4">
        <Music className="size-8 shrink-0 text-muted-foreground" aria-hidden="true" />
        <audio controls src={url} className="w-full" preload="metadata" />
      </div>
    );
  }
  if (file.kind === "video") {
    return (
      <div className="overflow-hidden rounded-md border bg-black">
        <video controls src={url} className="max-h-[480px] w-full" preload="metadata" />
      </div>
    );
  }
  if (file.mimeType.startsWith("text/") || /\.(md|csv|json|txt)$/i.test(file.name)) {
    return <TextFilePreview file={file} t={t} />;
  }
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed bg-muted/30 p-8 text-center">
      <FileKindIcon kind={file.kind} className="size-10 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{t("gaia.files.noPreview")}</p>
      <Button type="button" variant="outline" size="sm" asChild>
        <a href={gaiaFileDownloadUrl(file.id, true)} download={file.name}>
          <Download className="size-4" aria-hidden="true" /> {t("gaia.files.download")}
        </a>
      </Button>
    </div>
  );
}

function TextFilePreview({ file, t }: { file: GaiaFileDetailDTO; t: GaiaT }) {
  const [text, setText] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    if (file.size > 200_000) {
      setFailed(true);
      return;
    }
    fetch(gaiaFileDownloadUrl(file.id))
      .then((r) => r.text())
      .then((content) => {
        if (!cancelled) setText(content.slice(0, 20_000));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [file.id, file.size]);
  if (failed) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        {t("gaia.files.noPreview")}
      </div>
    );
  }
  if (text === null) {
    return (
      <div className="flex items-center gap-2 rounded-md border p-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {t("gaia.files.loading")}
      </div>
    );
  }
  return (
    <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap break-words rounded-md border bg-card p-4 font-mono text-xs leading-relaxed">
      {text}
    </pre>
  );
}

/** OCR d'une image (F10) : extrait le texte et le sauvegarde (recherche F12). */
export function ImageOcrButton({ file, t }: { file: GaiaFileDetailDTO; t: GaiaT }) {
  const [running, setRunning] = React.useState(false);
  const saveText = useSaveGaiaFileText();
  const { toast } = useToast();
  if (file.kind !== "image") return null;
  const run = async () => {
    if (running) return;
    setRunning(true);
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker(["eng", "fra"]);
      const { data } = await worker.recognize(gaiaFileDownloadUrl(file.id));
      await worker.terminate();
      const text = data.text.trim();
      if (text === "") {
        toast({ title: t("gaia.files.ocrEmpty") });
      } else {
        await saveText.mutateAsync({ fileId: file.id, text: text.slice(0, 200_000), source: "ocr" });
        toast({ title: t("gaia.files.ocrDone") });
      }
    } catch {
      toast({ variant: "destructive", title: t("gaia.files.ocrFailed") });
    } finally {
      setRunning(false);
    }
  };
  return (
    <Button type="button" variant="outline" size="sm" className="h-8 text-xs" disabled={running} onClick={() => void run()}>
      {running ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <ScanText className="size-3.5" aria-hidden="true" />}
      {running ? t("gaia.files.ocrRunning") : t("gaia.files.ocr")}
    </Button>
  );
}

// ── Sélecteur de fichier ───────────────────────────────────────────────────

export function GaiaFilePicker({
  open,
  onOpenChange,
  onSelect,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (file: GaiaFileDTO) => void;
  t: GaiaT;
}) {
  const [q, setQ] = React.useState("");
  const [debouncedQ, setDebouncedQ] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const { toast } = useToast();
  const upload = useUploadGaiaFile();
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const handle = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(handle);
  }, [q]);

  const filesQuery = useGaiaFiles({ q: debouncedQ, sort: "newest" });

  const handleUpload = async (picked: File | undefined) => {
    if (!picked) return;
    const rejected = fileUploadError(picked);
    if (rejected) {
      toast({ variant: "destructive", title: t(rejected === "too-large" ? "gaia.files.tooLarge" : "gaia.files.invalidFile") });
      return;
    }
    setUploading(true);
    try {
      const res = await upload.mutateAsync({ file: picked });
      onSelect(res.file);
      onOpenChange(false);
    } catch (err: unknown) {
      toast({ variant: "destructive", title: gaiaErrorMessage(err) });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("gaia.files.pickerTitle")}</DialogTitle>
          <DialogDescription>{t("gaia.files.pickerBody")}</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" aria-hidden="true" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("gaia.files.searchPlaceholder")}
            aria-label={t("gaia.files.searchPlaceholder")}
            className="h-9 pl-9 text-sm"
          />
        </div>
        <div className="max-h-72 space-y-1 overflow-auto">
          {filesQuery.isLoading ? (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {t("gaia.files.loading")}
            </p>
          ) : (filesQuery.data?.files ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("gaia.files.empty")}</p>
          ) : (
            (filesQuery.data?.files ?? []).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  onSelect(f);
                  onOpenChange(false);
                }}
                className="flex w-full items-center gap-3 rounded-md border bg-card px-3 py-2 text-left hover:border-brand-cyan/50"
              >
                <FileKindIcon kind={f.kind} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{f.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatFileSize(f.size)}
                    {f.folderName ? ` · ${f.folderName}` : ""}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
        <div className="flex justify-end gap-2 border-t pt-3">
          <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
            {t("gaia.files.uploadNew")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            hidden
            onChange={(e) => {
              void handleUpload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Pièces jointes d'une note (F06) ─────────────────────────────────────────

export function AttachmentsPanel({ noteId, t }: { noteId: string; t: GaiaT }) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const { toast } = useToast();
  const filesQuery = useGaiaNoteFiles(noteId);
  const attach = useAttachGaiaFile();
  const detach = useDetachGaiaFile();
  const upload = useUploadGaiaFile();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  const files = filesQuery.data?.files ?? [];

  const handleUpload = async (picked: File | undefined) => {
    if (!picked) return;
    const rejected = fileUploadError(picked);
    if (rejected) {
      toast({ variant: "destructive", title: t(rejected === "too-large" ? "gaia.files.tooLarge" : "gaia.files.invalidFile") });
      return;
    }
    setUploading(true);
    try {
      const res = await upload.mutateAsync({ file: picked });
      await attach.mutateAsync({ noteId, fileId: res.file.id });
    } catch (err: unknown) {
      toast({ variant: "destructive", title: gaiaErrorMessage(err) });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div data-testid="gaia-attachments" className="border-b px-4 py-3 sm:px-6">
      <div className="mb-2 flex items-center gap-2">
        <Paperclip className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-medium">{t("gaia.files.attachments")}</span>
        <span className="text-xs text-muted-foreground">({files.length})</span>
        <span className="ml-auto flex gap-1">
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPickerOpen(true)}>
            <Plus className="size-3.5" aria-hidden="true" /> {t("gaia.files.attachExisting")}
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Upload className="size-3.5" aria-hidden="true" />}
            {t("gaia.files.upload")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            hidden
            onChange={(e) => {
              void handleUpload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </span>
      </div>
      {files.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-xs">
              <FileKindIcon kind={f.kind} className="size-3.5 text-muted-foreground" />
              <a
                href={gaiaFileDownloadUrl(f.id)}
                target="_blank"
                rel="noreferrer"
                className="max-w-44 truncate font-medium hover:text-brand-cyan"
              >
                {f.name}
              </a>
              <span className="text-muted-foreground">{formatFileSize(f.size)}</span>
              <button
                type="button"
                aria-label={t("gaia.files.detach")}
                title={t("gaia.files.detach")}
                onClick={() => void detach.mutateAsync({ noteId, fileId: f.id })}
                className="text-muted-foreground hover:text-loss"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{t("gaia.files.attachmentsEmpty")}</p>
      )}
      <GaiaFilePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        t={t}
        onSelect={(f) => void attach.mutateAsync({ noteId, fileId: f.id })}
      />
    </div>
  );
}

// ── Barre de stockage (F14) ────────────────────────────────────────────────

function StorageBar({ t }: { t: GaiaT }) {
  const usageQuery = useGaiaStorageUsage();
  const usage = usageQuery.data?.usage;
  if (!usage) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> {t("gaia.files.loading")}
      </div>
    );
  }
  const pct = Math.min(100, Math.round((usage.totalBytes / usage.quotaBytes) * 100));
  return (
    <div className="w-full max-w-xs space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{t("gaia.files.storageUsed")}</span>
        <span className="font-mono tabular-nums">
          {formatFileSize(usage.totalBytes)} / {formatFileSize(usage.quotaBytes)} · {usage.fileCount} {t("gaia.files.filesCount")}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full ${pct > 90 ? "bg-loss" : pct > 70 ? "bg-brand-coral" : "bg-brand-cyan"}`} style={{ width: `${pct}%` }} />
      </div>
      {usage.byKind.length > 0 ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {usage.byKind
            .map((b) => `${t(`gaia.files.kind.${b.kind}`)}: ${b.count} (${formatFileSize(b.bytes)})`)
            .join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

// ── Détail d'un fichier ────────────────────────────────────────────────────

function FileDetail({
  fileId,
  onBack,
  onOpenNote,
  t,
}: {
  fileId: string;
  onBack: () => void;
  onOpenNote: (id: string) => void;
  t: GaiaT;
}) {
  const { toast } = useToast();
  const detailQuery = useGaiaFile(fileId);
  const foldersQuery = useGaiaFolders();
  const updateFile = useUpdateGaiaFile();
  const deleteFile = useDeleteGaiaFile();
  const replaceFile = useReplaceGaiaFile();
  const restoreVersion = useRestoreGaiaFileVersion();
  const [renaming, setRenaming] = React.useState(false);
  const [name, setName] = React.useState("");
  const [deleteArmed, setDeleteArmed] = React.useState(false);
  const [replacing, setReplacing] = React.useState(false);
  const replaceRef = React.useRef<HTMLInputElement>(null);

  const file = detailQuery.data?.file;
  const folders = foldersQuery.data?.folders ?? [];

  const handleReplace = async (picked: File | undefined) => {
    if (!picked || !file) return;
    const rejected = fileUploadError(picked);
    if (rejected) {
      toast({ variant: "destructive", title: t(rejected === "too-large" ? "gaia.files.tooLarge" : "gaia.files.invalidFile") });
      return;
    }
    setReplacing(true);
    try {
      await replaceFile.mutateAsync({ fileId: file.id, file: picked });
      toast({ title: t("gaia.files.replaced") });
    } catch (err: unknown) {
      toast({ variant: "destructive", title: gaiaErrorMessage(err) });
    } finally {
      setReplacing(false);
    }
  };

  if (detailQuery.isLoading || !file) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {t("gaia.files.loading")}
      </div>
    );
  }

  return (
    <div data-testid="gaia-file-detail" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="size-4" aria-hidden="true" /> {t("gaia.files.backToFiles")}
        </Button>
        <div className="min-w-0 flex-1">
          {renaming ? (
            <span className="flex gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim() !== "") {
                    void updateFile.mutateAsync({ fileId: file.id, name: name.trim() });
                    setRenaming(false);
                  }
                  if (e.key === "Escape") setRenaming(false);
                }}
                className="h-8 max-w-sm text-sm"
                autoFocus
              />
              <Button
                type="button"
                size="sm"
                className="h-8"
                disabled={name.trim() === ""}
                onClick={() => {
                  void updateFile.mutateAsync({ fileId: file.id, name: name.trim() });
                  setRenaming(false);
                }}
              >
                {t("gaia.files.save")}
              </Button>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <FileKindIcon kind={file.kind} className="size-5 shrink-0 text-muted-foreground" />
              <span className="truncate text-base font-semibold">{file.name}</span>
              <button
                type="button"
                aria-label={t("gaia.files.rename")}
                onClick={() => {
                  setName(file.name);
                  setRenaming(true);
                }}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <Pencil className="size-3.5" aria-hidden="true" />
              </button>
            </span>
          )}
        </div>
        <select
          value={file.folderId ?? ""}
          onChange={(e) => void updateFile.mutateAsync({ fileId: file.id, folderId: e.target.value === "" ? null : e.target.value })}
          aria-label={t("gaia.files.folder")}
          className="h-8 rounded-md border bg-card px-2 text-xs"
        >
          <option value="">{t("gaia.files.noFolder")}</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" asChild>
          <a href={gaiaFileDownloadUrl(file.id, true)} download={file.name}>
            <Download className="size-3.5" aria-hidden="true" /> {t("gaia.files.download")}
          </a>
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" disabled={replacing} onClick={() => replaceRef.current?.click()}>
          {replacing ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-3.5" aria-hidden="true" />}
          {t("gaia.files.replace")}
        </Button>
        <input
          ref={replaceRef}
          type="file"
          hidden
          onChange={(e) => {
            void handleReplace(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant={deleteArmed ? "destructive" : "outline"}
          size="sm"
          className="h-8 text-xs"
          onClick={() => {
            if (!deleteArmed) {
              setDeleteArmed(true);
              setTimeout(() => setDeleteArmed(false), 4000);
              return;
            }
            void deleteFile.mutateAsync(file.id).then(() => onBack());
          }}
        >
          <Trash2 className="size-3.5" aria-hidden="true" /> {deleteArmed ? t("gaia.files.confirmDelete") : t("gaia.files.delete")}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-4">
          <FilePreview file={file} t={t} />
          {file.kind === "image" ? (
            <div className="flex items-center gap-2">
              <ImageOcrButton file={file} t={t} />
              <span className="text-xs text-muted-foreground">
                {file.hasText ? t("gaia.files.hasExtractedText") : t("gaia.files.noExtractedText")}
              </span>
            </div>
          ) : null}
          {file.hasText && file.ocrText !== "" ? (
            <details className="rounded-md border bg-card p-3">
              <summary className="cursor-pointer text-sm font-medium">{t("gaia.files.extractedText")}</summary>
              <p className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">
                {file.ocrText.slice(0, 5000)}
                {file.ocrText.length > 5000 ? "…" : ""}
              </p>
            </details>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-md border bg-card p-3 text-xs">
            <h3 className="mb-2 text-sm font-medium">{t("gaia.files.details")}</h3>
            <dl className="space-y-1.5">
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{t("gaia.files.size")}</dt><dd className="font-mono tabular-nums">{formatFileSize(file.size)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{t("gaia.files.type")}</dt><dd className="truncate font-mono">{file.mimeType}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{t("gaia.files.folder")}</dt><dd className="truncate">{file.folderName ?? "—"}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{t("gaia.files.uploaded")}</dt><dd>{new Date(file.createdAt).toLocaleDateString()}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{t("gaia.files.versions")}</dt><dd className="font-mono tabular-nums">{file.versionCount}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{t("gaia.files.linkedNotes")}</dt><dd className="font-mono tabular-nums">{file.noteCount}</dd></div>
            </dl>
          </div>

          {file.versions.length > 1 ? (
            <div className="rounded-md border bg-card p-3">
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <History className="size-4 text-muted-foreground" aria-hidden="true" /> {t("gaia.files.versionHistory")}
              </h3>
              <ul className="space-y-1.5">
                {file.versions.map((v) => (
                  <li key={v.version} className="flex items-center gap-2 text-xs">
                    <span className="font-mono tabular-nums">v{v.version}</span>
                    <span className="text-muted-foreground">{formatFileSize(v.size)} · {new Date(v.createdAt).toLocaleDateString()}</span>
                    {v.current ? (
                      <span className="rounded-sm bg-brand-cyan/15 px-1.5 py-0.5 text-[10px] font-medium text-brand-cyan-deep dark:text-brand-cyan">
                        {t("gaia.files.current")}
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="ml-auto h-6 px-2 text-[11px]"
                        onClick={() => void restoreVersion.mutateAsync({ fileId: file.id, version: v.version })}
                      >
                        {t("gaia.files.restore")}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-md border bg-card p-3">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
              <Link2 className="size-4 text-muted-foreground" aria-hidden="true" /> {t("gaia.files.linkedNotes")}
            </h3>
            {file.notes.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("gaia.files.noLinkedNotes")}</p>
            ) : (
              <ul className="space-y-1">
                {file.notes.map((n) => (
                  <li key={n.id}>
                    <button type="button" onClick={() => onOpenNote(n.id)} className="w-full truncate rounded-sm px-1 py-1 text-left text-xs hover:bg-muted">
                      {n.title === "" ? t("gaia.files.untitledNote") : n.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Gestionnaire de fichiers (F03) ─────────────────────────────────────────

export function FilesPanel({ onOpenNote }: { onOpenNote: (id: string) => void }) {
  const { toast } = useToast();
  const t = useTranslations();
  const tr: GaiaT = (key) => t(key);
  const [q, setQ] = React.useState("");
  const [debouncedQ, setDebouncedQ] = React.useState("");
  const [kind, setKind] = React.useState<GaiaFileKind | "">("");
  const [folderId, setFolderId] = React.useState("");
  const [sort, setSort] = React.useState<"newest" | "name" | "size">("newest");
  const [view, setView] = React.useState<"grid" | "list">("grid");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [uploadingCount, setUploadingCount] = React.useState(0);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const upload = useUploadGaiaFile();

  const foldersQuery = useGaiaFolders();
  const folders = foldersQuery.data?.folders ?? [];

  React.useEffect(() => {
    const handle = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(handle);
  }, [q]);

  const filesQuery = useGaiaFiles({
    q: debouncedQ,
    folderId: folderId === "" ? undefined : folderId,
    kind: kind === "" ? undefined : kind,
    sort,
  });
  const files = filesQuery.data?.files ?? [];

  const handleUpload = async (picked: FileList | File[]) => {
    const list = Array.from(picked);
    if (list.length === 0) return;
    setUploadingCount((c) => c + list.length);
    let done = 0;
    for (const f of list) {
      const rejected = fileUploadError(f);
      if (rejected) {
        toast({
          variant: "destructive",
          title: `${f.name}: ${tr(rejected === "too-large" ? "gaia.files.tooLarge" : "gaia.files.invalidFile")}`,
        });
        setUploadingCount((c) => c - 1);
        continue;
      }
      try {
        await upload.mutateAsync({ file: f, folderId: folderId === "" ? null : folderId });
        done += 1;
      } catch (err: unknown) {
        toast({ variant: "destructive", title: `${f.name}: ${gaiaErrorMessage(err)}` });
      } finally {
        setUploadingCount((c) => c - 1);
      }
    }
    if (done > 0) toast({ title: tr("gaia.files.uploadedCount").replace("{count}", String(done)) });
  };

  if (selectedId) {
    return (
      <FileDetail fileId={selectedId} onBack={() => setSelectedId(null)} onOpenNote={onOpenNote} t={tr} />
    );
  }

  return (
    <div data-testid="gaia-files-panel" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <StorageBar t={tr} />
        <div className="flex items-center gap-2">
          {uploadingCount > 0 ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              {tr("gaia.files.uploading").replace("{count}", String(uploadingCount))}
            </span>
          ) : null}
          <Button type="button" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" aria-hidden="true" /> {tr("gaia.files.upload")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) void handleUpload(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div
        className={`rounded-lg border border-dashed p-4 ${dragOver ? "border-brand-cyan bg-brand-cyan/5" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length > 0) void handleUpload(e.dataTransfer.files);
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-44 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" aria-hidden="true" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={tr("gaia.files.searchPlaceholder")}
              aria-label={tr("gaia.files.searchPlaceholder")}
              className="h-9 pl-9 text-sm"
            />
          </div>
          <select value={kind} onChange={(e) => setKind(e.target.value as GaiaFileKind | "")} aria-label={tr("gaia.files.filterType")} className="h-9 rounded-md border bg-card px-2 text-xs">
            <option value="">{tr("gaia.files.allTypes")}</option>
            {GAIA_FILE_KINDS.map((k) => (
              <option key={k} value={k}>
                {tr(`gaia.files.kind.${k}`)}
              </option>
            ))}
          </select>
          <select value={folderId} onChange={(e) => setFolderId(e.target.value)} aria-label={tr("gaia.files.folder")} className="h-9 rounded-md border bg-card px-2 text-xs">
            <option value="">{tr("gaia.files.allFolders")}</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as "newest" | "name" | "size")} aria-label={tr("gaia.files.sort")} className="h-9 rounded-md border bg-card px-2 text-xs">
            <option value="newest">{tr("gaia.files.sortNewest")}</option>
            <option value="name">{tr("gaia.files.sortName")}</option>
            <option value="size">{tr("gaia.files.sortSize")}</option>
          </select>
          <span className="flex rounded-md border">
            <button
              type="button"
              aria-label={tr("gaia.files.gridView")}
              title={tr("gaia.files.gridView")}
              onClick={() => setView("grid")}
              className={`p-2 ${view === "grid" ? "bg-muted text-foreground" : "text-muted-foreground"}`}
            >
              <LayoutGrid className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={tr("gaia.files.listView")}
              title={tr("gaia.files.listView")}
              onClick={() => setView("list")}
              className={`p-2 ${view === "list" ? "bg-muted text-foreground" : "text-muted-foreground"}`}
            >
              <List className="size-4" aria-hidden="true" />
            </button>
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {tr("gaia.files.dropHint").replace("{max}", formatFileSize(GAIA_MAX_FILE_BYTES))}
        </p>
      </div>

      {filesQuery.isLoading ? (
        <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {tr("gaia.files.loading")}
        </p>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center">
          <Folder className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">{tr("gaia.files.empty")}</p>
          <p className="max-w-sm text-xs text-muted-foreground">{tr("gaia.files.emptyBody")}</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {files.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSelectedId(f.id)}
              className="group overflow-hidden rounded-lg border bg-card text-left hover:border-brand-cyan/50"
            >
              <div className="flex h-32 items-center justify-center overflow-hidden bg-muted/40">
                {f.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={gaiaFileDownloadUrl(f.id)} alt={f.name} className="h-full w-full object-cover" loading="lazy" />
                ) : f.kind === "video" ? (
                  <Video className="size-10 text-muted-foreground" aria-hidden="true" />
                ) : f.kind === "audio" ? (
                  <Music className="size-10 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <FileKindIcon kind={f.kind} className="size-10 text-muted-foreground" />
                )}
              </div>
              <div className="p-2.5">
                <p className="truncate text-sm font-medium">{f.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(f.size)}
                  {f.folderName ? ` · ${f.folderName}` : ""}
                  {f.versionCount > 1 ? ` · v${f.versionCount}` : ""}
                  {f.noteCount > 0 ? ` · ${f.noteCount} ${tr("gaia.files.notesShort")}` : ""}
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {files.map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => setSelectedId(f.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50">
                <FileKindIcon kind={f.kind} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{f.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatFileSize(f.size)}
                    {f.folderName ? ` · ${f.folderName}` : ""}
                    {f.hasText ? ` · ${tr("gaia.files.searchable")}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{new Date(f.createdAt).toLocaleDateString()}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
