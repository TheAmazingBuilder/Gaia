import { getSession } from "@/server/session";
import { AuthScreen } from "./auth-screen";
import { GaiaShell } from "./gaia-shell";

/**
 * Server home: resolves the session cookie (no flash of the auth screen
 * for logged-in users) and renders the workspace, or the sign-in screen.
 * Used by both "/" and "/gaia" — Gaïa is the whole app.
 */
export async function GaiaHome() {
  const session = await getSession();
  if (!session) return <AuthScreen />;
  return (
    <GaiaShell
      email={session.user.email}
      displayName={session.profile.displayName}
    />
  );
}
