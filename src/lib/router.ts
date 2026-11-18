"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  parseHash,
  parsePathname,
  resolveNavigationTarget,
  routeToPath,
  type AppRoute,
} from "./routes";

export { parseHash, parsePathname, resolveNavigationTarget, routeToPath };
export type { AppRoute };

/**
 * Client-side navigation — minimal Gaïa-only equivalent of Promethe
 * src/lib/router.ts.
 *
 * `navigate()` is a plain function (it cannot call the `useRouter` hook
 * itself), so the App Router instance is registered once by the tiny
 * <RouterSync /> component mounted in Providers. Before registration
 * (first paint) it falls back to a plain location change.
 * Legacy "#/..." targets are normalized to clean URLs first.
 */

/** Event fired after a programmatic navigation so search-param state syncs. */
export const ROUTE_CHANGE_EVENT = "gaia:route-change";

interface AppRouterLike {
  push: (href: string) => void;
  replace: (href: string) => void;
}

let appRouter: AppRouterLike | null = null;

export function registerAppRouter(router: AppRouterLike | null): void {
  appRouter = router;
}

/** Programmatic navigation — accepts "/gaia?...", "#/gaia?..." or "gaia". */
export function navigate(to: string): void {
  const target = resolveNavigationTarget(to);
  if (typeof window === "undefined") return;
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === target) return;
  if (appRouter) {
    appRouter.push(target);
    window.dispatchEvent(new Event(ROUTE_CHANGE_EVENT));
    return;
  }
  window.location.assign(target);
}

/** Current route, derived from the Next.js pathname + query string. */
export function useRoute(): AppRoute {
  const pathname = usePathname();
  const [search, setSearch] = useState<string>(() =>
    typeof window === "undefined" ? "" : window.location.search,
  );

  useEffect(() => {
    const sync = () => setSearch(window.location.search);
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener(ROUTE_CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener(ROUTE_CHANGE_EVENT, sync);
    };
  }, []);

  return useMemo(
    () =>
      parsePathname(
        pathname ?? "/",
        new URLSearchParams(search.startsWith("?") ? search.slice(1) : search),
      ),
    [pathname, search],
  );
}

/** Backwards-compatible alias — the hash is gone, this reads the pathname. */
export const useHashRoute = useRoute;
