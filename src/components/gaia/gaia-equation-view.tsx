"use client";

/**
 * Gaïa — Module 1 : rendu d'équations LaTeX (KaTeX).
 *
 * Chargé dynamiquement (ssr: false) pour ne pas alourdir le bundle de
 * l'éditeur. KaTeX génère le HTML lui-même (entrée échappée) ; le HTML
 * injecté ici vient de KaTeX, jamais de l'utilisateur directement.
 */
import * as React from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

export function EquationView({ latex }: { latex: string }) {
  const html = React.useMemo(() => {
    if (latex.trim() === "") return "";
    try {
      return katex.renderToString(latex, {
        throwOnError: false,
        displayMode: true,
      });
    } catch {
      return "";
    }
  }, [latex]);
  if (latex.trim() === "" || html === "") {
    return (
      <p className="py-2 text-center font-mono text-xs text-muted-foreground">
        Empty or invalid equation
      </p>
    );
  }
  return (
    <div
      data-testid="gaia-equation-render"
      dangerouslySetInnerHTML={{ __html: html }}
      className="overflow-x-auto py-1 text-center [&_.katex]:text-base"
    />
  );
}
