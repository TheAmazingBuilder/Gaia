import type { GaiaNoteProperty } from "@/modules/notes/types";

/**
 * Normalize note properties without changing their values:
 * trim keys, drop empty keys, and keep the last value for each case-insensitive key.
 */
export function normalizeProperties(input: GaiaNoteProperty[]): GaiaNoteProperty[] {
  const byKey = new Map<string, GaiaNoteProperty>();
  for (const property of input) {
    const key = property.key.trim();
    if (key === "") continue;
    byKey.set(key.toLowerCase(), {
      key,
      value: property.value,
      type: property.type,
      ...(property.options ? { options: property.options } : {}),
    });
  }
  return [...byKey.values()];
}
