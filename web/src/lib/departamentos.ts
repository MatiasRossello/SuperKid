export const DEPARTAMENTOS = [
  "Capital", "Godoy Cruz", "Guaymallén", "Las Heras", "Luján de Cuyo", "Maipú",
  "Lavalle", "San Martín", "Rivadavia", "Junín", "Santa Rosa", "La Paz",
  "Tunuyán", "Tupungato", "San Carlos", "San Rafael", "General Alvear", "Malargüe",
] as const;
export type Departamento = (typeof DEPARTAMENTOS)[number];

export const isDepartamento = (s: unknown): s is Departamento =>
  DEPARTAMENTOS.includes(s as Departamento);

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** "maipu", "MAIPÚ", " Lujan de cuyo " → canonical name, or null. */
export const findDepartamento = (s: string): Departamento | null =>
  DEPARTAMENTOS.find((d) => norm(d) === norm(s.trim())) ?? null;

const GRAN_MENDOZA: Departamento[] = ["Capital", "Godoy Cruz", "Guaymallén", "Las Heras", "Luján de Cuyo", "Maipú"];
const ESTE: Departamento[] = ["San Martín", "Rivadavia", "Junín", "Santa Rosa", "La Paz"];
const UCO: Departamento[] = ["Tunuyán", "Tupungato", "San Carlos"];
const SUR: Departamento[] = ["San Rafael", "General Alvear", "Malargüe"];

// ponytail: region words from the DACC forecast prose. "cordillera"/"llanura" ignored (span many deptos); add if they show up with storms.
const REGIONS: [RegExp, Departamento[]][] = [
  [/\bgran mendoza\b/, GRAN_MENDOZA],
  [/\b(zona|oasis|el) norte\b|\bnorte provincial\b/, [...GRAN_MENDOZA, "Lavalle"]],
  [/\b(zona|oasis|el) este\b|\beste provincial\b/, ESTE],
  [/\bvalle de uco\b|\b(zona|oasis|el) centro\b|\bcentro provincial\b/, UCO],
  [/\b(zona|oasis|el) sur\b|\bsur provincial\b/, SUR],
];

/** Departamentos the forecast text puts under storms. A storm sentence with no zone means the whole province. */
export function stormDeptosFromForecast(text: string): Set<Departamento> {
  const out = new Set<Departamento>();
  for (const sentence of norm(text).split(/[.\n]+/)) {
    if (!/tormenta|granizo|chaparron/.test(sentence)) continue;
    const before = out.size;
    let matched = false;
    for (const d of DEPARTAMENTOS) if (new RegExp(`\\b${norm(d)}\\b`).test(sentence)) { out.add(d); matched = true; }
    for (const [re, ds] of REGIONS) if (re.test(sentence)) { ds.forEach((d) => out.add(d)); matched = true; }
    if (!matched && out.size === before) DEPARTAMENTOS.forEach((d) => out.add(d));
  }
  return out;
}
