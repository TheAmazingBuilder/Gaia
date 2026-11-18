"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { NotebookText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, ApiClientError } from "@/lib/api-client";

/**
 * Sign-in / sign-up screen, shown when there is no session.
 * English only. On success the router refreshes and the server component
 * (GaiaHome) renders the workspace instead.
 */
export function AuthScreen() {
  const router = useRouter();
  const [mode, setMode] = React.useState<"login" | "signup">("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await apiFetch("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
      } else {
        await apiFetch("/api/auth/signup", {
          method: "POST",
          body: JSON.stringify({
            email,
            password,
            displayName: displayName.trim() === "" ? undefined : displayName.trim(),
          }),
        });
      }
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("An error occurred. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-2">
          <NotebookText
            className="size-7 text-emerald-600 dark:text-emerald-400"
            aria-hidden="true"
          />
          <h1 className="text-2xl font-bold tracking-tight">Gaïa</h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Your personal knowledge workspace: notes, ideas, research and
          documentation, linked to your notes.
        </p>

        <div className="mt-6 flex gap-2" role="tablist" aria-label="Auth mode">
          <Button
            type="button"
            variant={mode === "login" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("login")}
          >
            Sign in
          </Button>
          <Button
            type="button"
            variant={mode === "signup" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("signup")}
          >
            Create account
          </Button>
        </div>

        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          {mode === "signup" ? (
            <div className="space-y-1">
              <label htmlFor="gaia-display-name" className="text-xs font-medium">
                Display name (optional)
              </label>
              <Input
                id="gaia-display-name"
                type="text"
                autoComplete="name"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          ) : null}
          <div className="space-y-1">
            <label htmlFor="gaia-email" className="text-xs font-medium">
              Email
            </label>
            <Input
              id="gaia-email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="gaia-password" className="text-xs font-medium">
              Password
            </label>
            <Input
              id="gaia-password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {mode === "signup" ? (
              <p className="text-xs text-muted-foreground">
                At least 8 characters, with a letter and a digit.
              </p>
            ) : null}
          </div>
          {error ? (
            <p role="alert" className="text-sm text-loss">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </Button>
        </form>
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Your notes are private — each account only ever sees its own notes.
      </p>
    </div>
  );
}
