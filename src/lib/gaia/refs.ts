/**
 * Gaïa — resolution of references by kind (standalone version).
 *
 * A `ref` block only stores `{ kind, id }`. On every note read,
 * `resolveNoteRefs` rewrites `label` / `meta` / `href` with fresh data.
 * An unresolvable pointer keeps the client-provided label when present,
 * otherwise "Unresolved reference", with `meta` / `href` null.
 *
 * STANDALONE ADAPTATION (deliberate, documented):
 * In Promethe, TRADE resolved to a trade + instrument, STRATEGY to a
 * Playbook strategy, SETUP to a Playbook setup (with a legacy free-text
 * fallback), RULE to a Playbook rule / legacy TradingRule, and SYMBOL to
 * an instrument. This standalone app has no trades, no Playbook, no
 * instruments — there is nothing to resolve those kinds against, and no
 * trading data is ever invented. Those five resolvers therefore return
 * null, exactly like LESSON and EVENT already did in Promethe (no Academy,
 * no connected economic events).
 *
 * The kinds are KEPT in the schema, the Zod contracts, the slash commands
 * and the picker UI for exact compatibility with Promethe: notes imported
 * from Promethe keep their ref blocks intact (kind + id), they simply
 * render as "Unresolved reference" until/unless a target exists.
 * Only NOTE resolves for real — against the user's own active notes.
 */
import { db } from "@/lib/db";
import type { GaiaBlock, GaiaRefKind } from "./content";

export type GaiaRefHit = {
  kind: GaiaRefKind;
  id: string;
  label: string;
  meta: string | null;
  href: string | null;
};

export const GAIA_REF_KINDS: readonly GaiaRefKind[] = [
  "TRADE",
  "STRATEGY",
  "SETUP",
  "RULE",
  "LESSON",
  "EVENT",
  "SYMBOL",
  "NOTE",
];

async function resolveNote(userId: string, id: string): Promise<GaiaRefHit | null> {
  const note = await db.note.findFirst({
    where: { userId, id, deletedAt: null },
  });
  if (!note) return null;
  return {
    kind: "NOTE",
    id: note.id,
    label: note.title === "" ? "Untitled note" : note.title,
    meta: "Note Gaïa",
    href: `/gaia?tab=notes&note=${note.id}`,
  };
}

/** Resolves one reference. Any exception is swallowed (returns null). */
export async function resolveRef(
  userId: string,
  kind: GaiaRefKind,
  id: string,
): Promise<GaiaRefHit | null> {
  try {
    switch (kind) {
      case "TRADE":
      case "STRATEGY":
      case "SETUP":
      case "RULE":
      case "LESSON":
      case "EVENT":
      case "SYMBOL":
        // Standalone: no trading module to resolve against — see header.
        return null;
      case "NOTE":
        return await resolveNote(userId, id);
    }
  } catch {
    return null;
  }
}

/**
 * Re-resolves the `ref` blocks of a note on read. Blocks without `ref`
 * are returned as-is.
 */
export async function resolveNoteRefs(
  userId: string,
  blocks: GaiaBlock[],
): Promise<GaiaBlock[]> {
  const out: GaiaBlock[] = [];
  for (const block of blocks) {
    let next = block;
    // Module 1 : les refs imbriquées (enfants, colonnes) se résolvent aussi.
    if (block.children) {
      next = { ...next, children: await resolveNoteRefs(userId, block.children) };
    }
    if (block.columns) {
      const columns: GaiaBlock[][] = [];
      for (const col of block.columns) {
        columns.push(await resolveNoteRefs(userId, col));
      }
      next = { ...next, columns };
    }
    if (next.type !== "ref" || !next.ref) {
      out.push(next);
      continue;
    }
    const hit = await resolveRef(userId, next.ref.kind, next.ref.id);
    if (hit) {
      out.push({
        ...next,
        ref: { kind: hit.kind, id: hit.id, label: hit.label, meta: hit.meta, href: hit.href },
      });
    } else {
      out.push({
        ...next,
        ref: {
          kind: next.ref.kind,
          id: next.ref.id,
          label: next.ref.label ?? "Unresolved reference",
          meta: null,
          href: null,
        },
      });
    }
  }
  return out;
}

const PICKER_RESULT_LIMIT = 40;

/**
 * Entity picker: scans entities by kind, filters on `q`
 * (label + meta, case-insensitive), truncates to 40 results.
 * Invalid or absent `kind`: all kinds. In standalone only NOTE ever
 * returns results — the trading kinds have no source data.
 */
export async function listRefs(
  userId: string,
  q: string,
  kind?: string,
): Promise<GaiaRefHit[]> {
  const query = q.trim().toLowerCase();
  const wanted: GaiaRefKind[] =
    kind !== undefined &&
    (GAIA_REF_KINDS as readonly string[]).includes(kind)
      ? [kind as GaiaRefKind]
      : [...GAIA_REF_KINDS];

  const hits: GaiaRefHit[] = [];

  if (wanted.includes("NOTE")) {
    const notes = await db.note.findMany({
      where: { userId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
    });
    for (const note of notes) {
      const hit = await resolveNote(userId, note.id);
      if (hit) hits.push(hit);
    }
  }

  const filtered =
    query === ""
      ? hits
      : hits.filter((hit) =>
          `${hit.label} ${hit.meta ?? ""}`.toLowerCase().includes(query),
        );
  return filtered.slice(0, PICKER_RESULT_LIMIT);
}
