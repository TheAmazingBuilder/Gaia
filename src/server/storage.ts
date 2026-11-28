import "server-only";

/**
 * Gaïa — client Supabase Storage (Module 3), côté serveur uniquement.
 *
 * Le bucket `gaia-files` est privé : aucun accès direct navigateur.
 * Les routes API Next.js utilisent la service role key (jamais exposée)
 * et servent les fichiers en proxy, après vérification de la session
 * applicative (requireUser) et du userId en base.
 *
 * Variables requises (voir .env.example) :
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Si elles sont absentes, isStorageConfigured() est false et les routes
 * d'upload répondent 503 avec un message explicite (pas de crash).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { GAIA_FILE_BUCKET, sanitizeFileName } from "@/lib/gaia/files";

let cached: SupabaseClient | null | undefined;

export function isStorageConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getStorageClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    cached = null;
    return null;
  }
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}

/** Chemin Storage d'une version : `<userId>/<fileId>/v<version>/<nom>`. */
export function storagePathFor(userId: string, fileId: string, version: number, name: string): string {
  return `${userId}/${fileId}/v${version}/${sanitizeFileName(name)}`;
}

/** Upload d'un binaire ; crée le bucket à la volée s'il manque (1 retry). */
export async function uploadToStorage(
  client: SupabaseClient,
  path: string,
  buffer: Buffer,
  mimeType: string,
): Promise<{ ok: boolean; error?: string }> {
  const attempt = await client.storage.from(GAIA_FILE_BUCKET).upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
  });
  if (!attempt.error) return { ok: true };
  const message = attempt.error.message ?? "";
  if (/bucket not found/i.test(message)) {
    await client.storage.createBucket(GAIA_FILE_BUCKET, { public: false });
    const retry = await client.storage.from(GAIA_FILE_BUCKET).upload(path, buffer, {
      contentType: mimeType,
      upsert: false,
    });
    if (!retry.error) return { ok: true };
    return { ok: false, error: retry.error.message };
  }
  return { ok: false, error: message };
}

/** Téléchargement d'un binaire (Blob + type). */
export async function downloadFromStorage(
  client: SupabaseClient,
  path: string,
): Promise<{ ok: true; blob: Blob; contentType: string } | { ok: false; error: string }> {
  const result = await client.storage.from(GAIA_FILE_BUCKET).download(path);
  if (result.error || !result.data) {
    return { ok: false, error: result.error?.message ?? "Download failed." };
  }
  return { ok: true, blob: result.data, contentType: result.data.type || "application/octet-stream" };
}

/**
 * Supprime les binaires (les chemins absents sont ignorés par Supabase).
 * Ne masque jamais une erreur Storage : les appelants doivent pouvoir
 * distinguer une suppression effective d'un nettoyage échoué.
 */
export async function removeFromStorage(client: SupabaseClient, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const result = await client.storage.from(GAIA_FILE_BUCKET).remove(paths);
  if (result.error) {
    throw new Error(`Supabase Storage removal failed: ${result.error.message}`);
  }
}
