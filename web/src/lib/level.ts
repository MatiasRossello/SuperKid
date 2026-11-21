import { DEPARTAMENTOS, type Departamento, isDepartamento, stormDeptosFromForecast } from "./departamentos.ts";

export type Impact = {
  departamento: string;
  paraje_referencia: string;
  prob_max: number;
  area_impacto_km2: number;
};
export type SmnLevel = "amarilla" | "naranja" | "roja";

/** One fact behind a level. `at` is an ISO timestamp (UTC). This is also what the summarizer gets. */
export type Reason = { fuente: string; at: string; level: number; dato: Record<string, string | number> };

export type LevelInputs = {
  impacts: { at: string; items: Impact[] } | null; // latest radar frame
  forecast: { at: string; texto: string } | null; // today's DACC forecast
  rain: { at: string; departamento: Departamento; estacion: string; mm: number }[];
  smn: { at: string; departamento: Departamento; nivel: SmnLevel; evento: string }[];
};

export type ZoneLevel = { level: number; reasons: Reason[] };

const SMN_LEVEL: Record<SmnLevel, number> = { amarilla: 2, naranja: 3, roja: 5 };

export function hailLevel(i: Impact): number {
  if (i.prob_max < 70) return 3;
  return i.area_impacto_km2 > 100 ? 5 : 4;
}

export function computeLevels(inp: LevelInputs): Record<Departamento, ZoneLevel> {
  const out = Object.fromEntries(DEPARTAMENTOS.map((d) => [d, { level: 0, reasons: [] as Reason[] }])) as Record<Departamento, ZoneLevel>;
  const add = (d: Departamento, r: Reason) => {
    out[d].reasons.push(r);
    out[d].level = Math.max(out[d].level, r.level);
  };

  if (inp.forecast)
    for (const d of stormDeptosFromForecast(inp.forecast.texto))
      add(d, { fuente: "Pronóstico DACC", at: inp.forecast.at, level: 1, dato: { pronostico: inp.forecast.texto } });

  for (const r of inp.rain)
    if (r.mm > 0) add(r.departamento, { fuente: "Estación DACC", at: r.at, level: 2, dato: { estacion: r.estacion, precipitacion_mm: r.mm } });

  for (const a of inp.smn)
    add(a.departamento, { fuente: "SMN", at: a.at, level: SMN_LEVEL[a.nivel], dato: { alerta: a.nivel, evento: a.evento } });

  for (const i of inp.impacts?.items ?? [])
    if (isDepartamento(i.departamento))
      add(i.departamento, {
        fuente: "Radar DACC",
        at: inp.impacts!.at,
        level: hailLevel(i),
        dato: { fenomeno: "granizo", paraje: i.paraje_referencia, probabilidad: i.prob_max, area_km2: i.area_impacto_km2 },
      });

  return out;
}
