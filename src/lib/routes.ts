/**
 * Clean-URL routing — pure functions, no Next.js imports (unit-testable).
 *
 * Minimal Gaïa-only equivalent of Promethe src/lib/routes.ts. The whole app
 * lives on two real App Router pages (/ and /gaia) that render the same
 * GaiaView; internal navigation (tabs, note editor, filters) goes through
 * query params (?tab=&note=&folder=&tag=&q=&sort=&view=).
 *
 * Legacy "#/..." hrefs stored in old notes (from Promethe) are accepted on
 * input: "#/gaia?..." maps to the same view; any other legacy hash
 * (e.g. "#/trades?trade=...") has no target in this standalone app and
 * falls back to the Gaïa home — never a dead link, never invented data.
 */

export interface AppRoute {
  view: "gaia";
  /** Query params (?tab=..., ?note=...) — drill-down filters etc. */
  query?: Record<string, string>;
}

function queryFromParams(params: URLSearchParams): Record<string, string> {
  const query: Record<string, string> = {};
  for (const [k, v] of params.entries()) query[k] = v;
  return query;
}

function withSearch(path: string, query?: Record<string, string>): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== "") params.set(k, v);
  }
  const qs = params.toString();
  return qs === "" ? path : `${path}?${qs}`;
}

/** Parse a clean pathname ("/" or "/gaia") + query into a typed route. */
export function parsePathname(
  pathname: string,
  params: URLSearchParams,
): AppRoute {
  void pathname; // "/" and "/gaia" both render Gaïa
  return { view: "gaia", query: queryFromParams(params) };
}

/** Parse a legacy hash ("#/gaia?tab=notes&note=...") into a typed route. */
export function parseHash(hash: string): AppRoute {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const [path, qs] = clean.split("?");
  const params = new URLSearchParams(qs ?? "");
  if (path === "/gaia" || path === "gaia" || path === "" || path === "/") {
    return { view: "gaia", query: queryFromParams(params) };
  }
  // Legacy trading hash (e.g. "#/trades?trade=..."): no trading module in
  // this standalone app — land on the Gaïa home instead of a dead link.
  return { view: "gaia", query: {} };
}

/** Build the canonical clean URL for a route. */
export function routeToPath(route: AppRoute): string {
  return withSearch("/gaia", route.query);
}

/** Normalise any navigation target ("/gaia?...", "#/gaia?...", "gaia") to a clean URL. */
export function resolveNavigationTarget(to: string): string {
  if (to.startsWith("#/") || to.startsWith("#")) {
    return routeToPath(parseHash(to));
  }
  if (to.startsWith("/")) return to;
  return `/${to}`;
}
