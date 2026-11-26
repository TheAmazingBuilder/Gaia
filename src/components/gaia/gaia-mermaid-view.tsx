"use client";

/**
 * Gaïa — Module 1 : rendu de diagrammes Mermaid.
 *
 * Chargé dynamiquement côté client uniquement. `securityLevel: "strict"`
 * : Mermaid échappe le HTML dans les libellés, le SVG injecté est généré
 * par Mermaid, jamais du HTML brut utilisateur.
 */
import * as React from "react";

function useIsDark(): boolean {
  const [dark, setDark] = React.useState(false);
  React.useEffect(() => {
    const read = () => setDark(document.documentElement.classList.contains("dark"));
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

export function MermaidView({ code }: { code: string }) {
  const dark = useIsDark();
  const idRef = React.useRef(`mmd-${Math.random().toString(36).slice(2, 10)}`);
  const [svg, setSvg] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(() => {
      void (async () => {
        if (code.trim() === "") {
          if (alive) {
            setSvg("");
            setError(null);
          }
          return;
        }
        try {
          const mermaid = (await import("mermaid")).default;
          mermaid.initialize({
            startOnLoad: false,
            theme: dark ? "dark" : "default",
            securityLevel: "strict",
          });
          const { svg } = await mermaid.render(`${idRef.current}-${Date.now()}`, code);
          if (alive) {
            setSvg(svg);
            setError(null);
          }
        } catch (e) {
          if (alive) setError(e instanceof Error ? e.message : "Invalid diagram");
        }
      })();
    }, 400);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [code, dark]);

  if (error) {
    return (
      <p data-testid="gaia-mermaid-error" className="py-2 text-center font-mono text-xs text-loss">
        {error}
      </p>
    );
  }
  if (svg === "") {
    return (
      <p className="py-2 text-center font-mono text-xs text-muted-foreground">
        Rendering diagram…
      </p>
    );
  }
  return (
    <div
      data-testid="gaia-mermaid-render"
      dangerouslySetInnerHTML={{ __html: svg }}
      className="overflow-x-auto py-1 [&_svg]:mx-auto [&_svg]:max-w-full"
    />
  );
}
