/**
 * Gaïa — Module 2 (Knowledge Management System): helpers client-safe.
 *
 * No Node import here: this file is imported by client components
 * (trees, criteria, suggestions) AND by the server (same matching rules).
 *
 * Contents:
 *  - folder / tag trees (K05, K07)
 *  - smart-collection criteria matching (K06)
 *  - tokenization + link-suggestion scoring (K14)
 *  - daily / weekly note titles (K10, K11)
 */

// ── Types partagés (miroir des DTOs serveur, voir gaia-shared.tsx) ─────────

export type KnowledgeFolderNode = {
  id: string;
  name: string;
  parentId: string | null;
  noteCount: number;
};

export type KnowledgeTagNode = {
  id: string;
  name: string;
  parentId: string | null;
  relatedIds: string[];
  noteCount: number;
};

export type KnowledgeTreeNode<T> = T & {
  children: KnowledgeTreeNode<T>[];
  depth: number;
};

/** Builds a forest from a flat list (orphans → root). Stable order: name asc. */
export function buildTree<T extends { id: string; parentId: string | null; name: string }>(
  items: T[],
): KnowledgeTreeNode<T>[] {
  const byId = new Map<string, KnowledgeTreeNode<T>>();
  for (const item of items) {
    byId.set(item.id, { ...item, children: [], depth: 0 });
  }
  const roots: KnowledgeTreeNode<T>[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent && parent.id !== node.id) {
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      node.depth = 0;
      roots.push(node);
    }
  }
  const sortNodes = (list: KnowledgeTreeNode<T>[]): void => {
    list.sort((a, b) => a.name.localeCompare(b.name));
    for (const n of list) sortNodes(n.children);
  };
  sortNodes(roots);
  return roots;
}

/** All descendant ids of a node (inclusive when `inclusive` is true). */
export function descendantIds<T extends { id: string }>(
  tree: KnowledgeTreeNode<T>[],
  id: string,
  inclusive = true,
): string[] {
  const out: string[] = [];
  const walk = (nodes: KnowledgeTreeNode<T>[]): boolean => {
    for (const n of nodes) {
      if (n.id === id) {
        if (inclusive) out.push(n.id);
        const collect = (list: KnowledgeTreeNode<T>[]): void => {
          for (const c of list) {
            out.push(c.id);
            collect(c.children);
          }
        };
        collect(n.children);
        return true;
      }
      if (walk(n.children)) return true;
    }
    return false;
  };
  walk(tree);
  return out;
}

/** True when `childId` is (transitively) under `ancestorId`. Guards cycles. */
export function isDescendantOf(
  items: Array<{ id: string; parentId: string | null }>,
  childId: string,
  ancestorId: string,
): boolean {
  const byId = new Map(items.map((i) => [i.id, i.parentId]));
  let current = byId.get(childId);
  const seen = new Set<string>([childId]);
  while (current) {
    if (current === ancestorId) return true;
    if (seen.has(current)) return false;
    seen.add(current);
    current = byId.get(current);
  }
  return false;
}

// ── Smart collections (K06) ─────────────────────────────────────────────────

export type KnowledgeCollectionCriteria = {
  folderId?: string | null;
  /** The note must carry ALL of these tags. */
  tagIds?: string[];
  mastery?: string;
  favorite?: boolean;
  /** Case-insensitive substring over title + plain text. */
  q?: string;
  /** The note must have each of these properties (exact value match). */
  properties?: Array<{ key: string; value: string }>;
};

export type KnowledgeCollectionNote = {
  folderId: string | null;
  tagIds: string[];
  mastery: string;
  favorite: boolean;
  title: string;
  text: string;
  properties: Array<{ key: string; value: string }>;
};

/**
 * Matches a note against a collection's criteria. Folder matching includes
 * the folder's descendants (a collection on "Work" also catches
 * "Work/Projects"). Empty criteria match everything.
 */
export function matchCollectionCriteria(
  note: KnowledgeCollectionNote,
  criteria: KnowledgeCollectionCriteria,
  folderDescendants: string[] = [],
): boolean {
  if (criteria.folderId !== undefined && criteria.folderId !== null) {
    const allowed = new Set([criteria.folderId, ...folderDescendants]);
    if (note.folderId === null || !allowed.has(note.folderId)) return false;
  }
  if (criteria.tagIds && criteria.tagIds.length > 0) {
    const have = new Set(note.tagIds);
    if (!criteria.tagIds.every((t) => have.has(t))) return false;
  }
  if (criteria.mastery && criteria.mastery !== "") {
    if (note.mastery !== criteria.mastery) return false;
  }
  if (criteria.favorite === true && !note.favorite) return false;
  if (criteria.q && criteria.q.trim() !== "") {
    const q = criteria.q.trim().toLowerCase();
    const hay = `${note.title}\n${note.text}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (criteria.properties && criteria.properties.length > 0) {
    for (const wanted of criteria.properties) {
      const found = note.properties.find(
        (p) => p.key.toLowerCase() === wanted.key.toLowerCase(),
      );
      if (!found || String(found.value).trim() !== wanted.value.trim()) {
        return false;
      }
    }
  }
  return true;
}

// ── Tokenization + link suggestions (K14) ───────────────────────────────────

const STOPWORDS = new Set([
  // French
  "avec", "pour", "dans", "sur", "les", "des", "une", "est", "qui", "que",
  "aux", "par", "pas", "plus", "mais", "être", "avoir", "faire", "comme",
  "tout", "tous", "toute", "toutes", "nous", "vous", "ils", "elles", "ceci",
  "cela", "aussi", "entre", "sans", "chez", "alors", "quand", "dont", "sous",
  "leur", "leurs", "notre", "votre", "cette", "ces", "aux", "été", "être",
  "the", "and", "for", "with", "that", "this", "from", "have", "has",
  "are", "was", "were", "will", "would", "there", "their", "about",
  "which", "when", "what", "your", "yours", "note", "notes",
]);

/** Lower-cased word tokens (≥3 chars, no stopwords), de-duplicated. */
export function tokenize(text: string): string[] {
  const words = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/g)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  return [...new Set(words)];
}

export type LinkSuggestionCandidate = {
  id: string;
  title: string;
  text: string;
  tagIds: string[];
};

/**
 * Scores other notes against a source note. Title tokens weigh 3, body
 * tokens 1, a shared tag adds 2. Returns the top N with the shared words
 * that explain the suggestion (never an empty score).
 */
export function suggestLinks(
  source: { title: string; text: string; tagIds: string[] },
  candidates: LinkSuggestionCandidate[],
  limit = 8,
): Array<{ id: string; score: number; sharedWords: string[] }> {
  const sourceTitle = new Set(tokenize(source.title));
  const sourceBody = new Set(tokenize(source.text));
  const sourceTags = new Set(source.tagIds);
  const scored: Array<{ id: string; score: number; sharedWords: string[] }> = [];
  for (const c of candidates) {
    const titleTokens = tokenize(c.title);
    const bodyTokens = tokenize(c.text);
    let score = 0;
    const shared = new Set<string>();
    for (const w of titleTokens) {
      if (sourceTitle.has(w)) {
        score += 3;
        shared.add(w);
      } else if (sourceBody.has(w)) {
        score += 1;
        shared.add(w);
      }
    }
    for (const w of bodyTokens) {
      if (sourceTitle.has(w)) {
        score += 3;
        shared.add(w);
      } else if (sourceBody.has(w)) {
        score += 1;
        shared.add(w);
      }
    }
    for (const t of c.tagIds) {
      if (sourceTags.has(t)) score += 2;
    }
    if (score >= 3) {
      scored.push({ id: c.id, score, sharedWords: [...shared].slice(0, 5) });
    }
  }
  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return scored.slice(0, limit);
}

// ── Daily / weekly notes (K10, K11) ─────────────────────────────────────────

/** ISO week number (Monday-first). */
export function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return { year: d.getUTCFullYear(), week };
}

/** "2026-11-26" — the daily note's title, in the user's timezone. */
export function dailyNoteTitle(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** "Week 48 · 2026" — the weekly note's title. */
export function weeklyNoteTitle(date: Date): string {
  const { year, week } = isoWeek(date);
  return `Week ${week} · ${year}`;
}

/** Monday (00:00) of the ISO week containing `date`, local time. */
export function weekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
}
