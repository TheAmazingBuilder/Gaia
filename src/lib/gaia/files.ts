/**
 * Gaïa — fichiers (Module 3 : File & Document Management).
 *
 * Helpers client-safe (aucune dépendance Node) : classification par MIME,
 * tailles, quota, noms de fichiers. Le binaire vit dans Supabase Storage
 * (bucket privé `gaia-files`) ; ici ne vivent que des règles de présentation.
 */

/** Bucket Supabase Storage des fichiers Gaïa (privé, cf. prisma/storage.sql). */
export const GAIA_FILE_BUCKET = "gaia-files";

/** Taille max par fichier à l'upload (25 Mo). */
export const GAIA_MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Quota affiché (offre gratuite Supabase : 1 Go de Storage). */
export const GAIA_STORAGE_QUOTA_BYTES = 1024 * 1024 * 1024;

export type GaiaFileKind = "image" | "pdf" | "audio" | "video" | "document" | "other";

/** Groupes de types pour le filtre du gestionnaire de fichiers. */
export const GAIA_FILE_KINDS: GaiaFileKind[] = ["image", "pdf", "audio", "video", "document", "other"];

/** Catégorie d'un fichier à partir de son MIME (extension en secours). */
export function fileKindOf(mimeType: string, name = ""): GaiaFileKind {
  const mime = mimeType.toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (
    mime.startsWith("text/") ||
    mime.includes("msword") ||
    mime.includes("officedocument") ||
    mime.includes("opendocument") ||
    mime === "application/rtf" ||
    mime === "application/json"
  ) {
    return "document";
  }
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["md", "txt", "csv", "json", "doc", "docx", "odt", "xls", "xlsx", "ods", "ppt", "pptx", "odp", "rtf"].includes(ext)) {
    return "document";
  }
  return "other";
}

/** Extensions / MIME refusés à l'upload (exécutables, scripts). */
const BLOCKED_EXTENSIONS = new Set([
  "exe", "msi", "bat", "cmd", "sh", "ps1", "vbs", "js", "mjs", "cjs", "jar", "apk", "dmg", "app", "com", "scr", "pif",
]);

const BLOCKED_MIME_PREFIXES = [
  "application/x-msdownload",
  "application/x-sh",
  "application/x-executable",
];

/** Fichier accepté à l'upload ? (type + taille). Retourne la raison du refus, ou null. */
export function fileUploadError(file: { name: string; type: string; size: number }): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (BLOCKED_EXTENSIONS.has(ext)) return "blocked-type";
  if (BLOCKED_MIME_PREFIXES.some((p) => file.type.toLowerCase().startsWith(p))) return "blocked-type";
  if (file.size <= 0) return "empty";
  if (file.size > GAIA_MAX_FILE_BYTES) return "too-large";
  return null;
}

/** Nom de fichier nettoyé pour le chemin Storage (ASCII, sans séparateurs). */
export function sanitizeFileName(name: string): string {
  const cleaned = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 120);
  return cleaned === "" ? "file" : cleaned;
}

/** "1.5 MB", "820 KB", "42 B"… */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[unit]!}`;
}

/** Extension d'un nom de fichier, en minuscules, sans le point. */
export function fileExtension(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return ext === name.toLowerCase() ? "" : ext;
}
