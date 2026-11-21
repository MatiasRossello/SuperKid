// Contingencies are data. Push, the service worker, and the test route never branch on a code.
// Array order is the tie-break when one text mentions more than one code (earlier wins).

export const CONTINGENCIES = [
  { code: "tormenta", label: "Tormenta" },
  { code: "granizo", label: "Granizo" },
  { code: "zonda", label: "Zonda" },
] as const;

export type ContingencyCode = (typeof CONTINGENCIES)[number]["code"];
export type Contingency = { code: ContingencyCode; label: string };

const FIELDS = ["fenomeno", "evento", "pronostico"] as const;

export function contingencyByCode(code: unknown): Contingency | undefined {
  const row = CONTINGENCIES.find((c) => c.code === code);
  return row ? { code: row.code, label: row.label } : undefined;
}

type ReasonLike = { level?: number; dato: Record<string, string | number | undefined> };

/** Highest-level reason that names a known contingency. Rain-only reasons match nothing. */
export function contingencyFromReasons(reasons: ReasonLike[]): Contingency | undefined {
  const ordered = [...reasons].sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
  for (const r of ordered) {
    for (const field of FIELDS) {
      const text = r.dato[field];
      if (typeof text !== "string" || !text) continue;
      const hit = CONTINGENCIES.find((c) => text.toLowerCase().includes(c.code));
      if (hit) return { code: hit.code, label: hit.label };
    }
  }
  return undefined;
}

export const testMessage = (c: Contingency, zone: string) => `Prueba: ${c.label} en ${zone}.`;
