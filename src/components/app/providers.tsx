"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/i18n/i18n-provider";
import { Toaster } from "@/components/ui/toaster";
import { RouterSync } from "./router-sync";

/**
 * Client providers for the whole app (replaces Promethe's AppRoot shell,
 * which also carried the sidebar, auth screen, PWA registration and legacy
 * hash redirect — none of which exist in this standalone app).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <RouterSync />
          {children}
          <Toaster />
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
