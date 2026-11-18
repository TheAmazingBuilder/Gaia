"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut, NotebookText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { GaiaView } from "@/components/gaia/gaia-view";

/**
 * Minimal shell: a slim top bar (brand + signed-in user + sign out) above
 * the Gaïa view. There is no sidebar — Gaïa is the whole app.
 */
export function GaiaShell({
  email,
  displayName,
}: {
  email: string;
  displayName: string;
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Logout is idempotent — refresh even if the call failed.
    } finally {
      router.refresh();
    }
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <NotebookText
              className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400"
              aria-hidden="true"
            />
            <span className="truncate text-base font-bold tracking-tight">
              Gaïa
            </span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Your personal knowledge workspace
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden max-w-56 truncate text-xs text-muted-foreground sm:inline">
              {displayName !== "" ? displayName : email}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="px-4 py-4 sm:px-6">
        <GaiaView />
      </main>
    </div>
  );
}
