import { Suspense } from "react";
import { getSession } from "@/server/session";
import { AuthScreen } from "./auth-screen";
import { GaiaShell } from "./gaia-shell";

/**
 * Server home: resolves the session cookie (no flash of the auth screen
 * for logged-in users) and renders the workspace, or the sign-in screen.
 * Used by both "/" and "/gaia" — Gaïa is the whole app.
 * The Suspense boundary is required because the Gaïa view reads search
 * params (useSearchParams) for its tabs.
 */
export async function GaiaHome() {
  const session = await getSession();
  if (!session) return <AuthScreen />;
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-7xl px-4 py-6 text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <GaiaShell
        email={session.user.email}
        displayName={session.profile.displayName}
      />
    </Suspense>
  );
}
