/** Parse une colonne JSON String en tableau de chaînes (défaut [] si vide ou corrompue). */
export function parseJsonStringArray(
  stored: string | null | undefined,
): string[] {
  if (!stored) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}
