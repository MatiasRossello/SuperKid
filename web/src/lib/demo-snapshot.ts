// Builds a Snapshot from demo config. Same shape and same computeLevels as live data,
// so every screen (home, alerta, mapa, chat) behaves as if the weather were real.
import { DEPARTAMENTOS, type Departamento } from "./departamentos.ts";
import { alertLevel, forecastText, type DemoCondition, type DemoConfig } from "./demo.ts";
import { departamentoCenter } from "./geo.ts";
import { computeLevels, type Impact, type SmnLevel } from "./level.ts";
import type { Snapshot, Zone } from "./status.ts";
import { templateSummary } from "./summary.ts";

const clamp = (n: unknown, def: number, min: number, max: number) =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;

/** Selected demo date at the current Mendoza clock time. */
export function demoAt(config: DemoConfig, now?: number, dayIndex = 0): string {
  const date = config.days[dayIndex]?.date || config.days[0]?.date || "2026-01-01";
  const n = now ?? (typeof window !== "undefined" ? Date.now() : Date.parse(`${date}T12:00:00-03:00`));
  const hhmm = new Date(n - 3 * 3600_000).toISOString().slice(11, 16);
  return new Date(`${date}T${hhmm}:00-03:00`).toISOString();
}

const SMN: Partial<Record<DemoCondition, { nivel: SmnLevel; evento: string }>> = {
  zonda: { nivel: "naranja", evento: "viento zonda" },
  amarilla: { nivel: "amarilla", evento: "tormentas" },
  naranja: { nivel: "naranja", evento: "tormentas" },
  roja: { nivel: "roja", evento: "tormentas" },
};

export function demoSnapshot(config: DemoConfig, at?: string, dayIndex = 0): Snapshot {
  const resolvedAt = at ?? demoAt(config, undefined, dayIndex);
  const d = config.departamento;
  const day = config.days[dayIndex] ?? config.days[0];
  const [lat, lng] = departamentoCenter(d);

  const mm = day.condition === "lluvia" ? clamp(day.mm, 12, 0.1, 200) : 0;
  const prob = clamp(day.prob, 90, 0, 100);
  const area = clamp(day.area_km2, 150, 1, 2000);
  const impact: Impact | null = day.condition === "granizo"
    ? { departamento: d, paraje_referencia: "Zona demo", prob_max: prob, area_impacto_km2: area }
    : null;
  const smn = SMN[day.condition] ?? null;

  const levels = computeLevels({
    impacts: impact ? { at: resolvedAt, items: [impact] } : null,
    forecast: { at: resolvedAt, texto: forecastText(day.condition, d) },
    rain: mm ? [{ at: resolvedAt, departamento: d, estacion: "Estación Demo", mm }] : [],
    smn: smn ? [{ at: resolvedAt, departamento: d, ...smn }] : [],
  });

  const zones = Object.fromEntries(DEPARTAMENTOS.map((x): [Departamento, Zone] => {
    const reasons = levels[x].reasons;
    return [x, { level: levels[x].level, sources: reasons, summary: templateSummary(x, levels[x].level, reasons), updated_at: resolvedAt }];
  })) as Record<Departamento, Zone>;

  const forecast = config.days.map((x) => ({
    fecha: x.date,
    texto: forecastText(x.condition, d),
    maxima: clamp(x.max, 28, -10, 50),
    minima: clamp(x.min, 16, -15, 40),
    alerta: alertLevel(x.condition),
    imagen: "",
  }));

  const rayosCount = day.condition === "granizo" ? 10 : day.condition === "tormenta" || day.condition === "lluvia" ? 4 : 0;
  const rayos = Array.from({ length: rayosCount }, (_, i) => {
    const a = (i / Math.max(rayosCount, 1)) * Math.PI * 2;
    return { lat: lat + Math.sin(a) * 0.035, lng: lng + Math.cos(a) * 0.035, departamento: d };
  });

  return {
    mode: "demo",
    at: resolvedAt,
    frames: [],
    zones,
    forecast,
    stations: [{
      nombre: "Estación Demo",
      departamento: d,
      temp: clamp(day.max, 26, -10, 50),
      humedad: null,
      precipitacion: mm || null,
      read_at: resolvedAt,
    }],
    rayos,
    cells: impact ? [{ lat, lng, prob, area_km2: area }] : [],
  };
}
