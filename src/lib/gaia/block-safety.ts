/**
 * Images : protocole restreint. Seules les URL http(s) et les data URL
 * d'images en base64 sont acceptées. Appelée à l'écriture (create / patch).
 */
const SAFE_IMAGE_SRC =
  /^(https?:\/\/|data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,)/i;

export function isSafeImageSrc(src: string | undefined): boolean {
  if (src === undefined) return true;
  return SAFE_IMAGE_SRC.test(src);
}

/** Embeds : seules les URL https sont acceptées. */
export function isSafeEmbedUrl(url: string | undefined): boolean {
  if (url === undefined) return true;
  return /^https:\/\//i.test(url);
}
