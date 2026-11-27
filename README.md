![Gaïa — Your personal knowledge workspace](public/brand/gaia-banner.png)

# Gaïa — Personal knowledge workspace

Gaïa is a standalone notes workspace: a mini-Notion for writing notes, ideas,
research and documentation, with a block editor, folders, tags, templates,
versions and links between notes.

- **Code name:** `gaia` (repo / package) — **display name:** Gaïa (in the UI).
- **Stack:** Next.js 16, React 19, Tailwind CSS 4, Prisma 6, TypeScript, shadcn/ui.
- **Language:** English only (same decision as Promethe, 17 Nov 2026).
- **Theme:** dark monochrome by default (own brand, 25 Nov 2026 — see
  "Branding" below), light mode available via the theme provider.
- **Tagline:** "Your personal knowledge workspace: notes, ideas, research and
  documentation, linked to your notes."

## Where it comes from

Extracted from the **Gaïa module of [Promethe](https://github.com/TheAmazingBuilder/Promethe)**
(the trading journal), branch `Features-promethe`, head `b859140`
(18 Nov 2026). Gaïa in Promethe was itself a replica of Euforia's `Nofy`
notes workspace.

**Reproduced exactly (verbatim copies):**

- `src/server/gaia.ts` (1,191 lines) — all data access, userId-scoped.
- `src/lib/gaia/content.ts` (14 block types, Zod contracts, `normalizeBlocks`,
  `isSafeImageSrc`, projections), `templates.ts` (the 5 built-in templates),
  `versioning.ts` (snapshot throttle 3 min, cap 12).
- `src/components/gaia/` — all 9 components: block editor (20 slash commands,
  900 ms autosave with visible status), notes browser (debounced search
  300 ms, 4 sorts, list/grid), panels (overview with top tags, folders,
  templates, trash), editor dialogs (RefPicker, Versions, IconPicker with
  36 emojis), print/PDF export, linked-notes section.
- `src/app/api/gaia/**` — the 16 routes, plus `src/app/api/v1/gaia/**` —
  the same 16 as versioned re-exports.
- Prisma models `Note`, `NoteFolder`, `NoteTag`, `NoteTemplate`, `NoteVersion`
  (tables `gaia_*`), `globals.css` (tokens + `.printing-gaia` print rules),
  the `gaia.*` i18n keys, and the shared UI primitives they use.

**Features:** block editor (paragraph, h1–h3, bullet, numbered, todo, quote,
callout, divider, code, table, image, ref), autosave, version history with
restore, folders, tags, favorites, trash (restore / permanent delete),
duplication, search, 5 built-in templates + custom templates (including
"Save as template" from a note), Markdown export, print/PDF export, focus
mode, drag-and-drop block reordering, overview with activity (last 8 weeks)
and top tags. The workspace starts empty — no demo seed (same as Promethe
since 17 Nov 2026).

## What was adapted (deliberate, documented)

- **Shell:** Promethe's `AppRoot` (sidebar, dashboard, trades, strategies,
  analytics, journal, Playbook…) is gone. Gaïa is the whole app: `/` and
  `/gaia` both render the workspace, behind a slim top bar (brand + user +
  sign out). Providers are `QueryClientProvider` + `next-intl` (en only) +
  `next-themes` (dark default) + toaster.
- **Router:** Promethe's `src/lib/routes.ts` (569 lines, ~50 views) is replaced
  by a Gaïa-only equivalent. Legacy `"#/..."` hrefs stored in old notes are
  still accepted: `#/gaia?...` maps to the same view; other legacy hashes
  (e.g. `#/trades?trade=...`) land on the Gaïa home instead of a dead link.
- **Auth (minimal, same principle as Promethe):** opaque random token in an
  httpOnly cookie, backed by the `auth_sessions` table (revocable, 30-day
  expiry), scrypt password hashing (`scrypt$<salt>$<hash>`). Sign-up / login /
  logout / me routes at `/api/auth/*`. Differences vs Promethe: no `Profile`
  table — `User` carries `displayName` + `timezone` directly and the session
  payload is synthesised in `src/server/session.ts`; no Google OAuth, no
  `ensureUserSetup`, no DB-backed rate-limit buckets (in-memory fixed window
  only). No secret is needed: there is no NextAuth / OAuth secret in this app.
- **Refs — trading kinds are stubbed:** `TRADE`, `STRATEGY`, `SETUP`, `RULE`
  and `SYMBOL` have no target in a standalone notes app, so their resolvers
  return `null` (exactly like `LESSON` and `EVENT` already did in Promethe).
  The kinds are kept in the schema, the Zod contracts, the slash commands
  and the picker for exact compatibility: notes imported from Promethe keep
  their ref blocks intact (`kind` + `id`), they simply render as
  "Unresolved reference". **Only `NOTE` resolves for real** (against the
  user's own active notes). No trading data is ever invented.
- **Database:** schema is `User` + `AuthSession` + the 5 Gaïa models only.
  `DATABASE_URL` is the pooled runtime connection (Transaction pooler, port
  6543, with `?pgbouncer=true` — required, the Transaction pooler drops
  Prisma prepared statements otherwise, Postgres error 26000);
  `DIRECT_URL` (Session pooler, port 5432) is what Prisma uses for
  schema changes (`prisma db push`) — added 18 Nov 2026, like Promethe.
  `src/lib/db.ts` is a plain
  Prisma client — no soft-delete extension (Gaïa handles `deletedAt`
  explicitly, as in Promethe).
- **i18n:** `messages/en.json` contains only the `gaia.*` subtree plus
  `common.cancel` / `common.retry` (the only two `common.*` keys the Gaïa
  components use). The i18n provider no longer calls Promethe's
  `setFormatLocale` (no money formatting in Gaïa).
- **Config:** minimal `next.config.ts` (no bundle analyzer, build errors are
  NOT ignored — unlike Promethe, which sets `typescript.ignoreBuildErrors`).

## Run locally

```bash
git pull
npm install
npx prisma db push
npx prisma generate
npm run dev
```

Then open http://localhost:3000, create an account, and write.

> **Database note:** `npx prisma db push` must be run from a machine that can
> reach the database. On the build VM it is blocked by the egress proxy (same
> limitation as for Promethe) — run it from your PC. After the push, apply
> `prisma/rls.sql` in the Supabase SQL editor (20 RLS policies on the
> `gaia_*` tables, `user_id = auth.uid()::text` — the `::text` cast is
> mandatory, Supabase `auth.uid()` returns uuid while app ids are text cuid,
> see Promethe fix `e2f1d57`). RLS is defence in depth for direct Supabase
> access; the Next.js server enforces userId scoping in code.

Environment: copy `.env.example` to `.env` and set `DATABASE_URL`
(pooler, port 6543, with `?pgbouncer=true`) and `DIRECT_URL` (Session
pooler, port 5432, same password).
Never commit `.env` — it is gitignored. No other secret is needed.

## Verification (18 Nov 2026, build VM)

- `npm install` — 165 packages, OK.
- `npx prisma generate` — OK (Prisma Client v6.19.3).
- `npx prisma validate` — schema valid (needs `DATABASE_URL` and `DIRECT_URL`
  set, even as placeholders, because the datasource reads them).
- `npx tsc --noEmit` — 0 errors.
- `npm run build` — OK: `/` and `/gaia` (dynamic), 36 API routes
  (16 `/api/gaia/*` + 16 `/api/v1/gaia/*` + 4 `/api/auth/*`).
- Smoke test of the production build (no database): `/` and `/gaia` return
  200 with the sign-in screen; `/api/auth/me`, `/api/gaia/notes` and
  `/api/v1/gaia/overview` without a session return 401 `UNAUTHORIZED`.
- `npx prisma db push` was **not** run here (no credentials on the VM, proxy
  blocked) — it is the first step on your PC, see above.

## Fixes — 18 Nov 2026 (evening, branch `Features-gaia`)

Two errors seen live on localhost:3000, both fixed here:

- **Prisma "prepared statement does not exist" (Postgres 26000)** in
  `getSession` (`src/server/session.ts`): the Transaction pooler (port 6543)
  drops prepared statements between queries, so `authSession.findUnique`
  failed intermittently and the home page would not load. Fix: `DATABASE_URL`
  must carry `?pgbouncer=true` (see `.env.example`) — Prisma then inlines
  parameters instead of preparing statements. Same fix as Promethe.
- **next-themes script error (React 19)**: next-themes 0.4.6 renders its
  no-flash `<script>` inside the React tree, which React 19 rejects on
  client render. The dependency is removed; `src/components/theme-provider.tsx`
  is now a minimal custom provider that injects the blocking theme script
  with `useServerInsertedHTML` (outside the React tree) and keeps the same
  behaviour (storage key `theme`, default dark, system following).
- **Templates tab stuck on Folders**: `useRoute` tracked
  `window.location.search` by hand and synced on a custom event fired right
  after `router.push()` — but the URL commits asynchronously, so the sync
  ran before the URL changed and nothing re-synced after. `useRoute`
  (`src/lib/router.ts`) now uses `useSearchParams()`, reactive by
  construction; the Suspense boundary for it is in `gaia-home.tsx`.

## Branding — 25 Nov 2026 (branch `Features-gaia`)

Gaïa has its own identity, separate from Promethe (no phoenix, no emerald).

- **Logo — Möbius ribbon, the user's chosen 3D renders.** The in-app
  logo is the real render, not a redraw: `public/brand/` holds
  `mobius-app-icon.webp` (square 3D ribbon, home-screen icon),
  `mobius-lockup-v2.webp` (horizontal lockup, 3:1, hero use),
  `mobius-mono-v2.webp` (white 3D ribbon, single-colour contexts) and
  `mobius-favicon-v2.webp` (reference asset). These are binary `.webp`,
  so they cannot ride a snapshot push — they are dropped into the clone
  from a PC (one manual step, see below). `src/components/gaia/gaia-logo.tsx`
  (`GaiaMark`, `GaiaWordmark`, `GaiaBrand`, `GaiaLockup`) renders the
  images in dark mode and falls back to a flat SVG lemniscate + JSX
  wordmark in light mode (the renders have a dark background baked in)
  or when an image is missing. Small sizes use the mark + wordmark as
  components — the lockup image at 24 px would make the signature ï dots
  unreadable; the full lockup image is reserved for hero sizes (login).
  The live favicon is `src/app/icon.svg` — an SVG redraw of favicon v2
  (Next.js metadata icons do not accept `.webp`).
- **Wordmark.** "Gaïa" in Geist, the signature being the two dots of the ï:
  one coral, one cyan, on a dotless ı (U+0131), positioned in em so they
  scale with the font size.
- **Palette (dark default).** Monochrome base — fond `#0A0A12`, surface
  `#14141F`, texte `#FFFFFF`, texte secondaire `#9BA1B0` — plus two
  role-based accents. **Cyan `#22D3EE`** = what you can click: primary
  buttons, links, focus rings, success. **Coral `#FF6B5B`** = where you
  are: active tab/note, badges, the ï dots. **Violet `#8B5CF6`** lives in
  the logo only, never in UI chrome. Rose stays destructive-only.
  Filled cyan/coral surfaces always take dark text (`#0A0A12`): white on
  either accent fails contrast (cyan on white is 1.8:1, so light-mode
  accent text uses the deep variants `--color-brand-cyan-deep #0E7490`
  and `--color-brand-coral-deep #C93A2B`, both ≥ 4.5:1 on white).
  Tokens in `globals.css` (`@theme`: `brand-coral`, `brand-coral-deep`,
  `brand-cyan`, `brand-cyan-deep`, `brand-violet`, `brand-ink`); `--primary`,
  `--ring` and `--gain` are cyan in both themes.
- **Mastery scale (Memory).** Cold → warm on the monochrome base:
  forgotten grey, fragile cyan (dim), medium cyan, mastered coral — the
  label is always text, never the color alone.
- **Apple touch icon.** Next only accepts `jpg`/`jpeg`/`png` for
  `apple-icon` (not `svg`, verified in its source), and binary files cannot
  go through the snapshot push — so `apple-icon.png` (180×180, converted
  from the chosen app-icon render) lives in `~/workspace/gaia-brand/kit/`
  and must be dropped into `src/app/apple-icon.png` from a PC.
- **Brand images — manual step.** Copy `mobius-app-icon.webp`,
  `mobius-lockup-v2.webp` and `mobius-mono-v2.webp` (from
  `~/workspace/gaia-brand/kit/`) into `public/brand/`, then
  `git add public/brand src/app/apple-icon.png && git commit -m "Brand:
  chosen Mobius renders + apple touch icon" && git push`. Until the files
  are in place, the logo spots show the flat SVG fallback, so nothing
  ever renders broken.

## Phase 1 — Memory (18 Nov 2026, branch `Features-gaia`)

The Heat Memory System from the Fluxora feature list, built into Gaïa —
no AI, no new dependency, everything deterministic TypeScript:

- **Mastery per note** (`mastery`, `lastReviewedAt`, `nextReviewAt`,
  `reviewCount`, `easeFactor`, `intervalDays` on `Note`): forgotten (red) /
  fragile (orange) / medium (amber) / mastered (green). A new note starts
  "fragile" and is due for its first review right away. The mastery badge
  (dot + text label, never color alone) also shows on the My Notes list.
- **Spaced repetition** (`src/lib/gaia/spaced-repetition.ts`, pure
  functions): simplified SM-2. Review grades Forgot / Hard / Good / Easy
  map to SM-2 qualities 0 / 3 / 4 / 5; interval 1 day, then 6, then
  round(interval × ease); ease floored at 1.3; mastery derived from the
  interval (0 → forgotten, 1–2 → fragile, 3–13 → medium, 14+ → mastered).
- **Memory tab** (`?tab=memory`): Memory Score ring + breakdown, Kanban
  board with the 4 mastery columns (native HTML5 drag & drop + a "Move
  to…" menu per card as the keyboard/touch alternative), a per-card
  Review button (Forgot / Hard / Good / Easy), a "Due only" toggle, and a
  GitHub-style 26-week activity heatmap (emerald scale, legend, text
  summary — the per-day review counts are derived from each note's
  `lastReviewedAt`, so a note counts only on its most recent review day;
  see the caveat in `getMemoryStats`).
- **Memory Score** (transparent formula, also in `getMemoryStats`):
  `round(100 × (0.55 × avgMastery + 0.25 × dueClearance + 0.20 × streakFactor))`
  where avgMastery is the mean mastery value (forgotten 0, fragile 0.33,
  medium 0.66, mastered 1), dueClearance is `1 − dueCount / totalNotes`,
  and streakFactor is `min(7, streakDays) / 7`. No notes yet → score is
  null (empty state).
- **API**: `POST /api/gaia/notes/[id]/review {quality: 0|1|2|3}`,
  `POST /api/gaia/notes/[id]/mastery {mastery}`,
  `GET /api/gaia/memory/stats`, list filter `?mastery=` / `?due=true` —
  all mirrored under `/api/v1/gaia/` like the other Gaïa routes.

To pick this up on your PC (schema change — needs a database push):

```bash
git pull            # on branch Features-gaia
npx prisma db push  # adds the 6 Memory columns + the (userId, nextReviewAt) index
npm run dev         # restart the dev server
```

Existing notes keep working: they get mastery "fragile" and a null
`nextReviewAt`, which counts as due for review.

## Phase 2 — Visual (18-19 Nov 2026, branch `Features-gaia`)

The visual layer from the Fluxora feature list — still no AI, no schema
change, everything deterministic TypeScript:

- **Temporal Kanban** (Memory tab): a "By mastery | By time" toggle above
  the board reuses the same Kanban component. The time view groups by
  next review date — Today (due or never reviewed) / This week (≤ 7 days)
  / This month (≤ 30 days) / Later. Drag & drop and the "Move to…" menu
  reschedule only (`POST /api/gaia/notes/[id]/schedule {period}`): the
  next review date and interval change, mastery/ease/review count are
  untouched. List filter `?period=` (server-side, same ranges). The "Due
  only" toggle is hidden in the time view (the Today column already is
  the due set).
- **Knowledge graph** (new Graph tab, `?tab=graph`): React Flow
  (`@xyflow/react`, the one new dependency) with a hand-made radial BFS
  layout (`src/lib/gaia/graph-layout.ts`, pure functions, no layout
  library). Nodes are notes colored by mastery (dot + text label, never
  color alone); solid edges are note→note references from `ref` blocks,
  dashed edges are shared tags (opt-in checkbox, only for tags shared by
  2–8 notes, capped at 200 edges). Search highlights matching nodes,
  mastery chips hide/show levels, click a node to open the note.
  Data via `GET /api/gaia/memory/graph` (+ v1 mirror).
- **Memory timeline**: notes grouped by creation month (newest first,
  max 12 months, max 20 notes per month, collapsible sections) — served
  inside `GET /api/gaia/memory/stats` as `timeline`.
- **Daily journal**: "Today" card (notes created, reviews done, still
  due, newly mastered) + "This week" summary, computed on the fly from
  the same stats payload (`journal`) — no new table. Same approximation
  as the Phase 1 heatmap: reviews and newly-mastered counts are derived
  from each note's `lastReviewedAt`, so a note reviewed on two different
  days counts only on its most recent review day (documented in
  `getMemoryStats` and in the UI).

To pick this up on your PC (no schema change — no database push needed):

```bash
git pull            # on branch Features-gaia
npm install         # adds @xyflow/react
npm run dev         # restart the dev server
```

## Project layout

```
src/
  app/
    layout.tsx            Root layout (Geist fonts, Providers)
    page.tsx / gaia/      Home = Gaïa (both routes)
    api/
      auth/               login, logout, me, signup
      gaia/               21 Gaïa routes (implementation)
      v1/gaia/            21 versioned re-exports
  components/
    app/                  Providers, RouterSync, GaiaHome, GaiaShell, AuthScreen
    gaia/                 the 11 Gaïa components (verbatim from Promethe,
                          + gaia-memory.tsx (Phase 1 Memory),
                          gaia-graph.tsx (Phase 2 Visual))
    ui/                   shadcn primitives used by Gaïa
  i18n/                   en-only config, dictionaries, provider
  lib/
    gaia/                 content, refs (trading kinds stubbed), templates, versioning,
                          spaced-repetition (Phase 1 Memory, pure SM-2),
                          graph-layout (Phase 2 Visual, pure radial BFS)
    auth/                 password (scrypt), types, validators
    api-client, db, rate-limit, router, routes, utils
  server/
    api.ts                minimal error mapping (401 / 500)
    gaia.ts               all Gaïa data access (verbatim from Promethe)
    session.ts            opaque-token cookie sessions (adapted from Promethe)
messages/en.json          gaia.* + common.cancel/retry only
prisma/
  schema.prisma           User + AuthSession + 5 Gaïa models
  rls.sql                 20 RLS policies on gaia_* (apply in Supabase)
```

## Module 1 — Advanced Editor & Writing Experience (26 Nov 2026, branch `Features-gaia`)

The editor is the heart of Gaïa. All 20 features of Module 1 are implemented —
nothing skipped. The core principles hold: BLOCK JSON, never HTML; blocks are
stored as JSON in the note row; inline formatting lives in plain text.

- **E01 Rich text** — bold, italic, underline, strikethrough, highlight,
  text colors (Aurora palette). Formatting toolbar above the blocks +
  Ctrl+B / Ctrl+I / Ctrl+U. Blocks show a formatted preview when not focused
  (click to edit); the syntax is plain text: `**bold**`, `*italic*`,
  `__underline__`, `~~strike~~`, `==highlight==`, `` `code` ``,
  `[#RRGGBB]color[/]`, nestable. Word counts ignore the markers.
- **E02 Inline code** — `` `code` `` inside a sentence, rendered inline.
- **E03 Slash commands** — grouped (Basic / Lists / Media / Layout /
  Advanced / My commands / Trading), searched across command, label,
  description and keywords. Custom commands (localStorage, per browser):
  `/your-command` inserts a block of your choice with optional starter text,
  managed from the slash menu footer.
- **E04 Advanced drag & drop** — drag blocks between nesting levels,
  into toggles and columns (drop zones appear while dragging), and "Move to
  note…" from the block menu (or the multi-select bar).
- **E05 Nested blocks** — any block can have children (max depth 3).
  Tab / Shift+Tab or the block menu indents / outdents. Enter on an empty
  first child exits to the parent level; Backspace at the start merges into
  the parent.
- **E06 Toggle blocks** — collapsible sections with children (chevron,
  collapsed state persisted).
- **E07 Columns** — 2–3 side-by-side columns of blocks, each with its own
  add-block button; removing a column moves its blocks to a neighbour
  (removing the last one unwraps the block).
- **E08 Synced blocks** — a block mirrored across notes. Editing any copy
  updates the others in the same note instantly; the server fans the text
  out to copies in other notes on save. Duplicating a note re-links its
  synced blocks inside the copy only.
- **E09 Comments on blocks** — per-block threads (author = your display
  name, resolve toggle, delete). Gutter button shows the open count.
- **E10 Document outline** — sticky panel (ListTree button in the header)
  built from the note's headings; click scrolls to the block.
- **E11 Word count advanced** — click the word count in the header:
  words, characters, paragraphs, headings, to-dos, reading time.
- **E12 Writing goals** — per-note word goal + daily word goal (same
  popover). Progress bars; the daily count is the words in notes created or
  edited today (approximation, documented in the code). New API routes
  `GET/PATCH /api/gaia/settings` and `GET /api/gaia/writing/today`
  (+ `/api/v1/gaia/` mirrors).
- **E13 Table of contents** — a `/toc` block that lists the note's
  headings and navigates to them.
- **E14 Equation editor** — LaTeX blocks rendered with KaTeX
  (new dependency `katex`), source editable inline.
- **E15 Advanced tables** — the existing table block, extended: sort by
  column (persisted), row filter, column types (text / number / date /
  checkbox), formulas (`=A1+B2`, `=SUM(A1:A3)`, `=AVG(...)`, `=MIN/MAX/COUNT`).
  Sort/filter never lose rows (display order only).
- **E16 Drawing canvas** — freehand drawing on a 960×480 canvas (colors,
  sizes, eraser, undo, clear), saved as a PNG data URL (2 MB cap, same as
  images). An existing drawing can be re-opened and drawn over.
- **E17 Mermaid diagrams** — `mermaid` code blocks rendered live
  (new dependency `mermaid`, `securityLevel: "strict"`).
- **E18 Embeds** — paste a URL: YouTube / Vimeo render as players, other
  links as a rich link card. Only `https:` URLs are accepted server-side.
- **E19 Document cover** — gradient (Aurora presets) or image (URL or
  upload, 2 MB cap) at the top of the editor; grid note cards show a cover
  strip. Stored as JSON on the note (`cover` column).
- **E20 Multi-select blocks** — checkbox in the gutter (hover or when a
  selection exists); a floating bar offers Copy as Markdown, Duplicate,
  Turn into, Move to note, Delete. Escape clears the selection.

### Module 1 — data model

- `src/lib/gaia/content.ts` — 8 new block types (`toggle`, `columns`,
  `equation`, `drawing`, `mermaid`, `embed`, `toc`, `synced`), recursive
  `children` / `columns` (Zod `z.lazy`, depth cap 3), per-block `comments`
  and `tableMeta`, inline parser (`src/lib/gaia/inline.ts`, client-safe).
- `src/lib/gaia/tree.ts` — list addressing (`root` / `children:<id>` /
  `columns:<id>:<n>`) and immutable tree ops used by the editor.
- `prisma/schema.prisma` — `Note.cover` (String, JSON), `Note.wordGoal`
  (Int, nullable), `User.dailyWordGoal` (Int, default 0).
- New dependencies: `katex`, `mermaid` (both loaded lazily on the client).

### Module 1 — PC steps (after pull)

```powershell
npm install
npx prisma db push
# restart dev, hard refresh
```

## Module 2 — Knowledge Management System (26 Nov 2026, branch Features-gaia)

The graph becomes the centre of Gaïa: notes are no longer just linked, the
relations between them are visible, explorable and typed. All 17 features
(K01–K17) are implemented.

- **K01 Knowledge Graph** — the Graph tab now also draws custom-relation
  edges (coral, labelled with the relation type), with a toggle for them;
  orphan notes render with a dashed border and are counted in the legend.
- **K02 Backlinks** — the editor's Links panel (Link2 button in the header,
  exclusive with the outline) lists every note that references the current
  one.
- **K03 Unlinked mentions** — same panel: other notes whose title or text
  contains this note's title without linking to it, with a one-click
  "Link" that appends a ref block at the end of the note. Titles shorter
  than 3 characters are skipped (too noisy).
- **K04 Bi-directional links** — outgoing refs + relations and backlinks
  side by side in the Links panel; navigation works both ways.
- **K05 Nested folders** — `NoteFolder.parentId`; the Folders tab is a
  collapsible tree (indent, expand/collapse, subfolder creation, move via
  the rename dialog). Deleting a folder moves its children up to its
  parent. Cycles are rejected server-side.
- **K06 Smart collections** — `SmartCollection` (name, icon, criteria JSON:
  folder incl. descendants, tags — all of them — mastery, favorites, text,
  properties). Managed in the Knowledge tab; opening one filters My Notes
  (banner with the collection name + clear button). Criteria are evaluated
  live by `matchCollectionCriteria` (`src/lib/gaia/knowledge.ts`).
- **K07 Advanced tag system** — `NoteTag.parentId` (hierarchy) +
  `relatedIds` (explicit related tags, e.g. synonyms). The Folders tab has
  a Tags section: tree, rename / move / related-tags editing, delete
  (children reparent to root, tag removed from notes and from other tags'
  related lists).
- **K08 Note relationships** — `NoteRelation` (from, to, free-text type:
  "relates to", "contradicts", "inspired by", "parent of"…). Unique per
  (from, to, type). Created in the Links panel (note search + type with
  presets), listed both ways, shown as coral edges in the graph.
- **K09 Knowledge canvas** — `KnowledgeCanvas` (name, items JSON:
  noteId + x/y/w/h). The Canvas tab lists canvases (create/rename by
  double-click/delete) and a 1600×1000 board with a dotted grid; cards are
  dragged with the pointer and positions save (debounced) on drop. Click a
  card to open the note; "Add note" drops a new card at a free spot.
- **K10 Daily notes** — "Daily note" button in My Notes (and in the
  toolbar): opens (or creates, once per day) `YYYY-MM-DD` in an
  auto-created "Daily Notes" folder, with the long date as H1, a Tasks
  section and a Notes section. Idempotent; uses the user's timezone.
- **K11 Weekly notes** — same, "Weekly note": `Week N · YYYY` in
  "Weekly Notes", with the Monday–Sunday range, Goals / Review / Notes.
- **K12 Knowledge inbox** — `InboxItem` (text, doneAt, noteId). The Inbox
  tab captures ideas fast (Ctrl+Enter), lists open items with "To note"
  (creates the note — first line = title, one paragraph per line — and
  opens it), check-off and delete; done items collapse.
- **K13 Note properties** — `Note.properties` (JSON `GaiaNoteProperty[]`:
  key, typed value — text / number / date / checkbox / select with
  options). Editable in a collapsible "Properties" section under the
  editor title; saved with the normal autosave PATCH. Keys are trimmed
  and de-duplicated (last wins, case-insensitive).
- **K14 Smart linking** — `GET /api/gaia/notes/[id]/suggestions`:
  tokenizes title + text (French/English stopwords, ≥3 chars), scores
  other notes (title tokens ×3, body ×1, shared tag +2, threshold ≥3)
  and returns the top 8 with the shared words as the explanation. Shown
  in the Links panel with one-click linking.
- **K15 Orphan notes** — `GET /api/gaia/knowledge/orphans`: notes with no
  outgoing ref, no incoming ref, no relation and no tag shared with
  another note. Listed in the Knowledge tab (open + link from the editor).
- **K16 Knowledge timeline** — `GET /api/gaia/knowledge/timeline`:
  per-month created / edited / relations counts + newest notes (max 12
  months, 10 notes/month), in the Knowledge tab.
- **K17 Relations explorer** — the Knowledge tab's explorer: search a
  note, see its 1-hop and 2-hop neighborhood in a React Flow graph (same
  node style as the Graph tab, center note ringed in coral), click any
  node to re-center. A coverage line says how many notes are connected.

### Module 2 — data model

- `prisma/schema.prisma` — `NoteFolder.parentId` (self-relation),
  `NoteTag.parentId` + `relatedIds` (JSON string[]),
  `Note.properties` (String, JSON), new models `NoteRelation`,
  `SmartCollection`, `KnowledgeCanvas`, `InboxItem`.
- `prisma/rls.sql` — 16 new policies (4 per new table), same
  `user_id = auth.uid()::text` pattern (36 policies total). RLS is still
  not applied on Supabase — apply the whole file after `db push`.
- `src/lib/gaia/knowledge.ts` — client-safe helpers: trees
  (`buildTree`, `descendantIds`, `isDescendantOf`), collection matching,
  tokenization + suggestion scoring, ISO week / daily / weekly titles.
  Unit-tested with `tsx` (trees, criteria, tokenizer, scoring, dates).
- New API routes (unversioned + `/api/v1/gaia/` mirrors): `notes/daily`,
  `notes/weekly`, `notes/[id]/links`, `notes/[id]/suggestions`,
  `notes/[id]/relations` (+ `[relationId]`), `collections` (+ `[id]`,
  `[id]/notes`), `canvases` (+ `[id]`), `inbox` (+ `[id]`,
  `[id]/convert`), `knowledge/orphans`, `knowledge/timeline`,
  `tags/[id]`. `GET /api/gaia/notes` accepts `collectionId`.
- New components: `gaia-knowledge.tsx`, `gaia-canvas.tsx`,
  `gaia-inbox.tsx`, `gaia-links-panel.tsx`, `gaia-properties.tsx`.
  Modified: `gaia-view.tsx` (3 new tabs: Knowledge, Canvas, Inbox),
  `gaia-graph.tsx` (relation edges + orphans), `gaia-editor.tsx` (Links
  panel toggle + properties section), `gaia-panels.tsx` (folder tree +
  TagsPanel), `gaia-notes.tsx` (daily/weekly buttons + collection
  banner), `gaia-shared.tsx` (types + hooks), `messages/en.json`.

### Module 2 — PC steps (after pull)

```powershell
npm install
npx prisma db push
# restart dev, hard refresh
```

## Module 3 — File & Document Management (F01–F15)

- Upload (drag & drop, multi-files, 25 MB max, executables refused),
  Supabase Storage (private bucket `gaia-files`, server-side service role
  key, API proxy for download/preview), file manager (search by name +
  extracted text, type/folder filters, sort, grid/list, image gallery),
  PDF viewer (pdf.js, page nav, zoom), PDF annotations (note pins +
  highlights, relative coordinates), attachments on notes (multiple
  files per note, `file` block in the editor with inline audio/video
  preview), audio attachments, video embeds (uploaded files, player),
  OCR (tesseract.js eng+fra, images + scanned PDFs, 10 pages max),
  document preview by type (image, PDF, audio, video, text), file
  search, file versioning (replace = new version, restore creates a
  version), storage management (used / 1 GB quota, breakdown by type,
  largest files), file references (one file, several notes).
- Schema: `GaiaFile` (+ `folderId` → `NoteFolder`), `FileVersion`,
  `FileAnnotation`, `NoteFile` (join file ↔ note). `Note.blocks` gains
  the `file` block type (`fileId`).
- `prisma/storage.sql` — bucket + storage.objects policies (apply in the
  Supabase SQL editor, after `db push`). `prisma/rls.sql` — 16 new
  policies (4 per new table), 52 policies total. RLS is still not applied
  on Supabase — apply the whole file after `db push`.
- `src/server/storage.ts` — Supabase Storage client (server only).
  `src/lib/gaia/files.ts` — client-safe helpers (kinds, sizes, quota).
- New API routes (unversioned + `/api/v1/gaia/` mirrors): `files`
  (GET list + POST upload), `files/storage`, `files/[id]` (GET/PATCH/
  DELETE), `files/[id]/download`, `files/[id]/versions` (POST replace),
  `files/[id]/restore`, `files/[id]/annotations` (+ `[annotationId]`),
  `files/[id]/text`, `files/[id]/notes`, `notes/[id]/files` (+
  `[fileId]`).
- New components: `gaia-files.tsx` (manager, detail, attachments,
  picker), `gaia-pdf-viewer.tsx`. Modified: `gaia-view.tsx` (Files tab),
  `gaia-editor.tsx` (attachments section + markdown export),
  `gaia-blocks.tsx` (`file` block + slash command), `gaia-shared.tsx`
  (types + hooks), `messages/en.json`. New deps: `@supabase/supabase-js`,
  `pdfjs-dist`, `tesseract.js`.
- PDF text layer is extracted automatically after upload (searchable);
  scanned PDFs and images need the manual OCR button (runs in the
  browser, eng+fra).

### Module 3 — PC steps (after pull)

```powershell
npm install
npx prisma db push
# .env : add SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
#   (Supabase Dashboard → Project Settings → API)
# Supabase SQL editor : run prisma/storage.sql, then prisma/rls.sql
# Vercel → gaia → Settings → Environment Variables (Production + Preview) :
#   add SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, then redeploy
# restart dev, hard refresh
```
