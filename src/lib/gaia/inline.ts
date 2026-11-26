/**
 * Gaïa — Module 1 : formatage riche inline (client-safe, aucune dépendance).
 *
 * Syntaxe (texte brut uniquement, jamais de HTML) :
 *   **gras**  *italique*  __souligné__  ~~barré~~  ==surligné==
 *   `code`    [#RRGGBB]couleur[/]
 * Les marqueurs imbriqués sont supportés (**gras *italique* gras**).
 * `parseInlineSegments` découpe un texte en segments pour le rendu,
 * `stripInlineMarkers` l'épure pour les comptes de mots et la recherche.
 */

// ── Formatage riche inline ─────────────────────────────────────────────────
// Syntaxe (texte brut uniquement, jamais de HTML) :
//   **gras**  *italique*  __souligné__  ~~barré~~  ==surligné==
//   `code`    [#RRGGBB]couleur[/]
// Les marqueurs imbriqués sont supportés (**gras *italique* gras**).

export interface InlineSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  highlight?: boolean;
  code?: boolean;
  color?: string;
}

type InlineFormat = Omit<InlineSegment, "text">;

const INLINE_OPENERS: Array<{ marker: string; format: InlineFormat }> = [
  { marker: "**", format: { bold: true } },
  { marker: "__", format: { underline: true } },
  { marker: "~~", format: { strike: true } },
  { marker: "==", format: { highlight: true } },
  { marker: "`", format: { code: true } },
  { marker: "*", format: { italic: true } },
];

const COLOR_OPEN_RE = /\[#([0-9a-fA-F]{6})\]/;

function pushSegment(out: InlineSegment[], text: string, format: InlineFormat) {
  if (text === "") return;
  const last = out[out.length - 1];
  const sameFormat =
    last !== undefined &&
    last.bold === format.bold &&
    last.italic === format.italic &&
    last.underline === format.underline &&
    last.strike === format.strike &&
    last.highlight === format.highlight &&
    last.code === format.code &&
    last.color === format.color;
  if (sameFormat) {
    last.text += text;
    return;
  }
  out.push({ text, ...format });
}

function parseInlineInto(text: string, base: InlineFormat, out: InlineSegment[]) {
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    // Fermeture de couleur (seulement si une couleur est active).
    if (base.color && rest.startsWith("[/]")) {
      const { color: _dropped, ...withoutColor } = base;
      void _dropped;
      parseInlineInto(text.slice(i + 3), withoutColor, out);
      return;
    }
    // Ouverture de couleur [#RRGGBB] (n'importe où dans le reste).
    const colorMatch = COLOR_OPEN_RE.exec(rest);
    // Premier marqueur d'ouverture (le plus tôt ; ** avant *).
    let best: { at: number; marker: string; format: InlineFormat } | null = null;
    for (const opener of INLINE_OPENERS) {
      const at = rest.indexOf(opener.marker);
      if (at !== -1 && (best === null || at < best.at)) {
        best = { at, marker: opener.marker, format: opener.format };
      }
    }
    if (colorMatch && (best === null || colorMatch.index < best.at)) {
      if (colorMatch.index > 0) {
        pushSegment(out, rest.slice(0, colorMatch.index), base);
      }
      const hex = colorMatch[1].toLowerCase();
      const after = rest.slice(colorMatch.index + colorMatch[0].length);
      const closeAt = after.indexOf("[/]");
      if (closeAt === -1) {
        pushSegment(out, rest.slice(colorMatch.index), base);
        return;
      }
      parseInlineInto(after.slice(0, closeAt), { ...base, color: `#${hex}` }, out);
      parseInlineInto(after.slice(closeAt + 3), base, out);
      return;
    }
    if (best === null) {
      pushSegment(out, rest, base);
      return;
    }
    if (best.at > 0) pushSegment(out, rest.slice(0, best.at), base);
    const innerStart = i + best.at + best.marker.length;
    const closerAt = text.indexOf(best.marker, innerStart);
    if (closerAt === -1) {
      // Marqueur sans fermeture : littéral.
      pushSegment(out, best.marker, base);
      i = innerStart;
      continue;
    }
    const inner = text.slice(innerStart, closerAt);
    if (best.format.code) {
      // Dans du code : pas de formatage imbriqué.
      pushSegment(out, inner, { ...base, code: true });
    } else {
      parseInlineInto(inner, { ...base, ...best.format }, out);
    }
    i = closerAt + best.marker.length;
  }
}

/** Découpe un texte en segments formatés (rendu aperçu, jamais de HTML). */
export function parseInlineSegments(text: string): InlineSegment[] {
  const out: InlineSegment[] = [];
  parseInlineInto(text, {}, out);
  return out;
}

/** Texte visible, sans marqueurs de formatage (comptes de mots, recherche). */
export function stripInlineMarkers(text: string): string {
  return parseInlineSegments(text)
    .map((seg) => seg.text)
    .join("");
}

