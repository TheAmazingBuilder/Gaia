# Gaïa — Personal knowledge workspace

Gaïa is a standalone notes workspace: a mini-Notion for writing notes, ideas,
research and documentation, with a block editor, folders, tags, templates,
versions and links between notes.

- **Code name:** `gaia` (repo / package) — **display name:** Gaïa (in the UI).
- **Stack:** Next.js 16, React 19, Tailwind CSS 4, Prisma 6, TypeScript, shadcn/ui.
- **Language:** English only (same decision as Promethe, 17 Nov 2026).
- **Theme:** dark emerald/teal by default (same palette as Promethe), light
  mode available via the theme provider.
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
  Only `DATABASE_URL` is used (no `DIRECT_URL`). `src/lib/db.ts` is a plain
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
(Supabase pooler URL, session mode port 6543, or direct port 5432).
Never commit `.env` — it is gitignored. No other secret is needed.

## Verification (18 Nov 2026, build VM)

- `npm install` — 165 packages, OK.
- `npx prisma generate` — OK (Prisma Client v6.19.3).
- `npx prisma validate` — schema valid (needs `DATABASE_URL` set, even a
  placeholder, because the datasource reads it).
- `npx tsc --noEmit` — 0 errors.
- `npm run build` — OK: `/` and `/gaia` (dynamic), 36 API routes
  (16 `/api/gaia/*` + 16 `/api/v1/gaia/*` + 4 `/api/auth/*`).
- Smoke test of the production build (no database): `/` and `/gaia` return
  200 with the sign-in screen; `/api/auth/me`, `/api/gaia/notes` and
  `/api/v1/gaia/overview` without a session return 401 `UNAUTHORIZED`.
- `npx prisma db push` was **not** run here (no credentials on the VM, proxy
  blocked) — it is the first step on your PC, see above.

## Project layout

```
src/
  app/
    layout.tsx            Root layout (Geist fonts, Providers)
    page.tsx / gaia/      Home = Gaïa (both routes)
    api/
      auth/               login, logout, me, signup
      gaia/               16 Gaïa routes (implementation)
      v1/gaia/            16 versioned re-exports
  components/
    app/                  Providers, RouterSync, GaiaHome, GaiaShell, AuthScreen
    gaia/                 the 9 Gaïa components (verbatim from Promethe)
    ui/                   shadcn primitives used by Gaïa
  i18n/                   en-only config, dictionaries, provider
  lib/
    gaia/                 content, refs (trading kinds stubbed), templates, versioning
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
