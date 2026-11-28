import { randomUUID } from "node:crypto";

/** Nouvel id de bloc : `nb-` + 24 caractères hex. */
export function newBlockId(): string {
  return `nb-${randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

/** Nouvel id de groupe synchronisé : `sy-` + 16 caractères hex. */
export function newSyncId(): string {
  return `sy-${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

/** Nouvel id de commentaire : `cm-` + 16 caractères hex. */
export function newCommentId(): string {
  return `cm-${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}
