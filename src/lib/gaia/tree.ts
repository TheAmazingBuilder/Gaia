/**
 * Gaïa — Module 1 : helpers d'arborescence des blocs.
 *
 * Les blocs forment un arbre (racine, `children` des toggles / blocs
 * imbriqués, `columns` des blocs colonnes). Chaque liste éditable est
 * adressée par un `listId` stable :
 *   "root"                  → la liste racine de la note
 *   "children:<blockId>"    → les enfants d'un bloc
 *   "columns:<blockId>:<n>" → la colonne n d'un bloc colonnes
 *
 * Toutes les fonctions sont pures et immuables (elles retournent un nouvel
 * arbre). Aucune dépendance React : utilisables côté client et serveur.
 */
import type { GaiaBlock } from "./block-schema";
import { stripInlineMarkers } from "./inline";

export type BlockListId = string;

export const ROOT_LIST_ID = "root";

export function childrenListId(blockId: string): BlockListId {
  return `children:${blockId}`;
}

export function columnsListId(blockId: string, colIndex: number): BlockListId {
  return `columns:${blockId}:${colIndex}`;
}

/** La liste adressée par `listId`, ou null si introuvable. */
export function getList(blocks: GaiaBlock[], listId: BlockListId): GaiaBlock[] | null {
  if (listId === ROOT_LIST_ID) return blocks;
  const childMatch = /^children:(.+)$/.exec(listId);
  if (childMatch) {
    const owner = findBlock(blocks, childMatch[1]);
    return owner?.children ?? null;
  }
  const colMatch = /^columns:(.+):(\d+)$/.exec(listId);
  if (colMatch) {
    const owner = findBlock(blocks, colMatch[1]);
    const col = owner?.columns?.[Number(colMatch[2])];
    return col ?? null;
  }
  return null;
}

/** Trouve un bloc n'importe où dans l'arbre. */
export function findBlock(blocks: GaiaBlock[], id: string): GaiaBlock | null {
  for (const block of blocks) {
    if (block.id === id) return block;
    if (block.children) {
      const found = findBlock(block.children, id);
      if (found) return found;
    }
    if (block.columns) {
      for (const col of block.columns) {
        const found = findBlock(col, id);
        if (found) return found;
      }
    }
  }
  return null;
}

export interface BlockLocation {
  listId: BlockListId;
  index: number;
  depth: number;
  parentId: string | null;
}

/** Localise un bloc : sa liste parente, son index, sa profondeur. */
export function findBlockLocation(
  blocks: GaiaBlock[],
  id: string,
  depth = 0,
  parentId: string | null = null,
  listId: BlockListId = ROOT_LIST_ID,
): BlockLocation | null {
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.id === id) return { listId, index: i, depth, parentId };
    if (block.children) {
      const found = findBlockLocation(
        block.children,
        id,
        depth + 1,
        block.id,
        childrenListId(block.id),
      );
      if (found) return found;
    }
    if (block.columns) {
      for (let c = 0; c < block.columns.length; c++) {
        const found = findBlockLocation(
          block.columns[c],
          id,
          depth + 1,
          block.id,
          columnsListId(block.id, c),
        );
        if (found) return found;
      }
    }
  }
  return null;
}

function mapList(
  blocks: GaiaBlock[],
  listId: BlockListId,
  updater: (list: GaiaBlock[]) => GaiaBlock[],
): GaiaBlock[] {
  if (listId === ROOT_LIST_ID) return updater(blocks);
  const childMatch = /^children:(.+)$/.exec(listId);
  if (childMatch) {
    const ownerId = childMatch[1];
    return blocks.map((block) => {
      if (block.id === ownerId) {
        return { ...block, children: updater(block.children ?? []) };
      }
      return mapBlockLists(block, listId, updater);
    });
  }
  const colMatch = /^columns:(.+):(\d+)$/.exec(listId);
  if (colMatch) {
    const ownerId = colMatch[1];
    const colIndex = Number(colMatch[2]);
    return blocks.map((block) => {
      if (block.id === ownerId) {
        const columns = [...(block.columns ?? [])];
        while (columns.length <= colIndex) columns.push([]);
        columns[colIndex] = updater(columns[colIndex] ?? []);
        return { ...block, columns };
      }
      return mapBlockLists(block, listId, updater);
    });
  }
  return blocks;
}

function mapBlockLists(
  block: GaiaBlock,
  listId: BlockListId,
  updater: (list: GaiaBlock[]) => GaiaBlock[],
): GaiaBlock {
  let next = block;
  if (block.children) {
    const mapped = mapList(block.children, listId, updater);
    if (mapped !== block.children) next = { ...next, children: mapped };
  }
  if (block.columns) {
    let changed = false;
    const columns = block.columns.map((col) => {
      const mapped = mapList(col, listId, updater);
      if (mapped !== col) changed = true;
      return mapped;
    });
    if (changed) next = { ...next, columns };
  }
  return next;
}

/** Applique `updater` à la liste `listId` (immuable). */
export function updateList(
  blocks: GaiaBlock[],
  listId: BlockListId,
  updater: (list: GaiaBlock[]) => GaiaBlock[],
): GaiaBlock[] {
  return mapList(blocks, listId, updater);
}

/** Insère un bloc dans une liste, à l'index donné (clampé). */
export function insertIntoList(
  blocks: GaiaBlock[],
  listId: BlockListId,
  index: number,
  block: GaiaBlock,
): GaiaBlock[] {
  return updateList(blocks, listId, (list) => {
    const next = [...list];
    next.splice(Math.max(0, Math.min(index, next.length)), 0, block);
    return next;
  });
}

/** Supprime un bloc n'importe où dans l'arbre. */
export function removeBlockDeep(
  blocks: GaiaBlock[],
  id: string,
): { blocks: GaiaBlock[]; removed: GaiaBlock | null } {
  const loc = findBlockLocation(blocks, id);
  if (!loc) return { blocks, removed: null };
  let removed: GaiaBlock | null = null;
  const next = updateList(blocks, loc.listId, (list) => {
    removed = list[loc.index] ?? null;
    return list.filter((b) => b.id !== id);
  });
  return { blocks: next, removed };
}

/** Patch un bloc n'importe où dans l'arbre (patch partiel, `undefined` supprime). */
export function updateBlockDeep(
  blocks: GaiaBlock[],
  id: string,
  patch: Partial<GaiaBlock>,
): GaiaBlock[] {
  const loc = findBlockLocation(blocks, id);
  if (!loc) return blocks;
  return updateList(blocks, loc.listId, (list) =>
    list.map((b) => {
      if (b.id !== id) return b;
      const next: GaiaBlock = { ...b };
      const record = next as unknown as Record<string, unknown>;
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) delete record[k];
        else record[k] = v;
      }
      return next;
    }),
  );
}

/**
 * Déplace un bloc vers une liste / un index (même liste ou autre liste).
 * Si la cible est dans la même liste et après la source, l'index est ajusté
 * pour compenser la suppression.
 */
export function moveBlockDeep(
  blocks: GaiaBlock[],
  id: string,
  targetListId: BlockListId,
  targetIndex: number,
): GaiaBlock[] {
  const loc = findBlockLocation(blocks, id);
  if (!loc) return blocks;
  const block = findBlock(blocks, id);
  if (!block) return blocks;
  const without = removeBlockDeep(blocks, id).blocks;
  let index = targetIndex;
  if (loc.listId === targetListId && loc.index < targetIndex) index -= 1;
  return insertIntoList(without, targetListId, index, block);
}

/** Tous les blocs, en ordre de lecture, en ignorant les enfants repliés. */
export function visibleFlatBlocks(blocks: GaiaBlock[]): GaiaBlock[] {
  const out: GaiaBlock[] = [];
  const walk = (list: GaiaBlock[]) => {
    for (const block of list) {
      out.push(block);
      if (block.type === "toggle" && block.collapsed) continue;
      if (block.children) walk(block.children);
      if (block.columns) for (const col of block.columns) walk(col);
    }
  };
  walk(blocks);
  return out;
}

/** Profondeur d'un bloc (0 = racine). */
export function blockDepth(blocks: GaiaBlock[], id: string): number {
  return findBlockLocation(blocks, id)?.depth ?? 0;
}

/** Nombre total de blocs, enfants et colonnes inclus. */
export function countBlocksDeep(blocks: GaiaBlock[]): number {
  let n = 0;
  const walk = (list: GaiaBlock[]) => {
    for (const block of list) {
      n++;
      if (block.children) walk(block.children);
      if (block.columns) for (const col of block.columns) walk(col);
    }
  };
  walk(blocks);
  return n;
}

// ── Blocs synchronisés (E08) ────────────────────────────────────────────────

/** Met à jour le texte de toutes les copies d'un groupe synchronisé. */
export function syncTextAcross(
  blocks: GaiaBlock[],
  syncId: string,
  text: string,
): GaiaBlock[] {
  const map = (list: GaiaBlock[]): GaiaBlock[] =>
    list.map((block) => {
      let next = block;
      if (block.type === "synced" && block.syncId === syncId && block.text !== text) {
        next = { ...block, text };
      }
      if (block.children) {
        const children = map(block.children);
        if (children !== block.children) next = { ...next, children };
      }
      if (block.columns) {
        const columns = block.columns.map(map);
        if (columns.some((c, i) => c !== block.columns![i])) {
          next = { ...next, columns };
        }
      }
      return next;
    });
  return map(blocks);
}

/** syncId → texte actuel, pour la propagation inter-notes côté serveur. */
export function collectSyncedTexts(blocks: GaiaBlock[]): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (list: GaiaBlock[]) => {
    for (const block of list) {
      if (block.type === "synced" && block.syncId) {
        out.set(block.syncId, block.text);
      }
      if (block.children) walk(block.children);
      if (block.columns) for (const col of block.columns) walk(col);
    }
  };
  walk(blocks);
  return out;
}

// ── Parcours à plat ──────────────────────────────────────────────────────────

/** Tous les blocs, à plat, en ordre de lecture (enfants + colonnes inclus). */
export function flattenBlocks(blocks: GaiaBlock[]): GaiaBlock[] {
  const out: GaiaBlock[] = [];
  const walk = (list: GaiaBlock[]) => {
    for (const block of list) {
      out.push(block);
      if (block.children) walk(block.children);
      if (block.columns) for (const col of block.columns) walk(col);
    }
  };
  walk(blocks);
  return out;
}

/** Titres h1–h3 du document, pour le sommaire et le bloc table des matières. */
export function extractHeadings(blocks: GaiaBlock[]): Array<{
  id: string;
  level: 1 | 2 | 3;
  text: string;
}> {
  const out: Array<{ id: string; level: 1 | 2 | 3; text: string }> = [];
  for (const block of flattenBlocks(blocks)) {
    if (block.type === "h1" || block.type === "h2" || block.type === "h3") {
      const text = stripInlineMarkers(block.text).trim();
      if (text !== "") {
        out.push({
          id: block.id,
          level: block.type === "h1" ? 1 : block.type === "h2" ? 2 : 3,
          text,
        });
      }
    }
  }
  return out;
}
