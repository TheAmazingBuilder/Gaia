/**
 * Gaïa — Module 1 : formules et tri des tableaux avancés (E15).
 *
 * Formules supportées dans une cellule (préfixe `=`) :
 *   =A1+B2, =A1*2, =(A1+A2)/2, =SUM(A1:A3), =AVG(B2:B5), =MIN(...),
 *   =MAX(...), =COUNT(...).
 * Références A1 (colonne lettre + ligne 1-based, ligne 1 = en-tête).
 * Les références hors limites ou les erreurs donnent "" (cellule vide)
 * ou "#ERR" en cas de formule invalide. Aucune dépendance, pas d'eval.
 */

function colLetterToIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

function cellValue(rows: string[][], ref: string, seen: Set<string>): number {
  const m = /^([A-Z]+)(\d+)$/.exec(ref.toUpperCase());
  if (!m) return 0;
  const col = colLetterToIndex(m[1]);
  const row = Number(m[2]) - 1;
  const key = `${row}:${col}`;
  if (seen.has(key)) return 0; // Référence circulaire : 0.
  if (row < 0 || row >= rows.length) return 0;
  const raw = rows[row]?.[col] ?? "";
  if (raw.trim().startsWith("=")) {
    seen.add(key);
    const v = evaluateFormula(raw, rows, seen);
    seen.delete(key);
    const num = Number(v);
    return Number.isFinite(num) ? num : 0;
  }
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

function rangeValues(rows: string[][], range: string, seen: Set<string>): number[] {
  const m = /^([A-Z]+\d+):([A-Z]+\d+)$/.exec(range.toUpperCase());
  if (!m) return [cellValue(rows, range, seen)];
  const start = /^([A-Z]+)(\d+)$/.exec(m[1])!;
  const end = /^([A-Z]+)(\d+)$/.exec(m[2])!;
  const c0 = colLetterToIndex(start[1]);
  const c1 = colLetterToIndex(end[1]);
  const r0 = Number(start[2]) - 1;
  const r1 = Number(end[2]) - 1;
  const out: number[] = [];
  for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r++) {
    for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c++) {
      const raw = rows[r]?.[c] ?? "";
      if (raw.trim() === "") continue;
      if (raw.trim().startsWith("=")) {
        out.push(cellValue(rows, `${String.fromCharCode(65 + (c % 26))}${r + 1}`, seen));
      } else {
        const num = Number(raw);
        if (Number.isFinite(num)) out.push(num);
      }
    }
  }
  return out;
}

/**
 * Évalue une formule (`=...`) contre les lignes du tableau.
 * Retourne la valeur affichée (nombre formaté ou "#ERR").
 */
export function evaluateFormula(
  formula: string,
  rows: string[][],
  seen: Set<string> = new Set(),
): string {
  const expr = formula.trim().slice(1).trim();
  if (expr === "") return "";
  // Fonctions d'agrégat : SUM/AVG/MIN/MAX/COUNT(plage ou refs).
  const fnMatch = /^(SUM|AVG|MIN|MAX|COUNT)\(([^()]*)\)$/i.exec(expr);
  if (fnMatch) {
    const fn = fnMatch[1].toUpperCase();
    const args = fnMatch[2]
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a !== "");
    const values: number[] = [];
    for (const arg of args) values.push(...rangeValues(rows, arg, seen));
    if (fn === "COUNT") return String(values.length);
    if (values.length === 0) return "";
    if (fn === "SUM") return formatNumber(values.reduce((a, b) => a + b, 0));
    if (fn === "AVG") {
      return formatNumber(values.reduce((a, b) => a + b, 0) / values.length);
    }
    if (fn === "MIN") return formatNumber(Math.min(...values));
    return formatNumber(Math.max(...values));
  }
  // Expression arithmétique : on remplace les refs A1 par leurs valeurs,
  // puis on évalue avec un mini-parseur (pas d'eval).
  const replaced = expr.replace(/[A-Z]+[0-9]+/gi, (ref) =>
    String(cellValue(rows, ref, seen)),
  );
  if (!/^[0-9+\-*/().\s]+$/.test(replaced)) return "#ERR";
  try {
    const value = evalArithmetic(replaced);
    if (!Number.isFinite(value)) return "#ERR";
    return formatNumber(value);
  } catch {
    return "#ERR";
  }
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "#ERR";
  const rounded = Math.round(n * 100) / 100;
  return String(rounded);
}

/** Mini-évaluateur arithmétique (+ - * / parenthèses, priorités respectées). */
function evalArithmetic(expr: string): number {
  const tokens = expr.match(/(\d+\.?\d*|\+|-|\*|\/|\(|\))/g);
  if (!tokens) throw new Error("empty");
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  function parseExpr(): number {
    let v = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      const rhs = parseTerm();
      v = op === "+" ? v + rhs : v - rhs;
    }
    return v;
  }
  function parseTerm(): number {
    let v = parseFactor();
    while (peek() === "*" || peek() === "/") {
      const op = next();
      const rhs = parseFactor();
      v = op === "*" ? v * rhs : v / rhs;
    }
    return v;
  }
  function parseFactor(): number {
    const tok = next();
    if (tok === "(") {
      const v = parseExpr();
      if (next() !== ")") throw new Error("paren");
      return v;
    }
    if (tok === "-") return -parseFactor();
    if (tok === "+") return parseFactor();
    const n = Number(tok);
    if (!Number.isFinite(n)) throw new Error("number");
    return n;
  }
  const value = parseExpr();
  if (pos !== tokens.length) throw new Error("trailing");
  return value;
}

/** Valeur affichée d'une cellule (formule évaluée, sinon texte brut). */
export function displayCellValue(cell: string, rows: string[][]): string {
  if (cell.trim().startsWith("=")) return evaluateFormula(cell, rows);
  return cell;
}

/** Lignes de données triées selon tableMeta (l'en-tête ne bouge jamais). */
export function sortedDataRows(
  rows: string[][],
  sortBy: number | undefined,
  sortDir: "asc" | "desc" | undefined,
  colTypes: Array<string> | undefined,
): string[][] {
  if (rows.length <= 1 || sortBy === undefined) return rows.slice(1);
  const dir = sortDir === "desc" ? -1 : 1;
  const type = colTypes?.[sortBy] ?? "text";
  const data = rows.slice(1);
  const keyOf = (row: string[]): number | string => {
    const raw = row[sortBy] ?? "";
    const val = raw.trim().startsWith("=") ? displayCellValue(raw, rows) : raw;
    if (type === "number") {
      const n = Number(val);
      return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
    }
    if (type === "date") {
      const t = Date.parse(val);
      return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
    }
    return val.toLowerCase();
  };
  return [...data].sort((a, b) => {
    const ka = keyOf(a);
    const kb = keyOf(b);
    if (typeof ka === "number" && typeof kb === "number") return (ka - kb) * dir;
    return String(ka).localeCompare(String(kb)) * dir;
  });
}
