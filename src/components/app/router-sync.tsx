"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { registerAppRouter } from "@/lib/router";

/**
 * Registers the App Router instance once so the plain `navigate()` helper
 * in src/lib/router.ts can push routes. Same pattern as Promethe's
 * <RouterSync /> in AppRoot.
 */
export function RouterSync() {
  const router = useRouter();

  React.useEffect(() => {
    registerAppRouter(router);
    return () => registerAppRouter(null);
  }, [router]);

  return null;
}
