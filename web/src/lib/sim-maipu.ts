// Scripted, FICTIONAL storm over Maipú: rain → hail → zonda. Feeds the same computeLevels as live data.
// Only for demos and testing; the UI labels it "DATOS FICTICIOS" the whole time.
import { DEPARTAMENTOS } from "./departamentos.ts";
import { computeLevels, type Impact, type SmnLevel } from "./level.ts";
import { SCENARIOS } from "./scenarios.ts";
import type { Snapshot, Zone } from "./status.ts";
import { templateSummary } from "./summary.ts";

const STORM = "Inestable, con tormentas fuertes en el Gran Mendoza y posible caída de granizo.";
const ZONDA = "Viento Zonda en el Gran Mendoza y precordillera, con marcado ascenso de la temperatura.";
const STATION = { nombre: "Russel", lat: -33.0129, lng: -68.7473 }; // real agrometeo station in Maipú, fake readings

type Step = {
  min: number; // minutes after the scenario start
  forecast: string;
  rainMm?: number;
  hail?: Impact & { lat: number; lng: number };
  smn?: { nivel: SmnLevel; evento: string };
  rayos?: number;
};

const hail = (paraje: string, lat: number, lng: number, prob_max: number, area_impacto_km2: number) =>
  ({ departamento: "Maipú", paraje_referencia: paraje, prob_max, area_impacto_km2, lat, lng });

export const STEPS: Step[] = [
  { min: 0, forecast: STORM },                                                  // 1 · pronóstico
  { min: 6, forecast: STORM, rainMm: 1.2 },                                     // 2 · empieza a llover
  { min: 12, forecast: STORM, rainMm: 6.8, rayos: 4 },                          // 2 · lluvia fuerte
  { min: 18, forecast: STORM, rainMm: 9.5, rayos: 9, hail: hail("Russell", -33.005, -68.795, 55, 12) },          // 3
  { min: 22, forecast: STORM, rainMm: 12.1, rayos: 14, hail: hail("Lunlunta", -33.04, -68.82, 90, 60) },        // 4
  { min: 26, forecast: STORM, rainMm: 15.4, rayos: 11, hail: hail("Fray Luis Beltrán", -33.01, -68.65, 95, 140) }, // 5
  { min: 34, forecast: STORM, rainMm: 3.1, rayos: 2 },                          // 2 · pasa la celda
  { min: 40, forecast: ZONDA },                                                 // 0 · calma
  { min: 46, forecast: ZONDA, smn: { nivel: "amarilla", evento: "viento zonda" } }, // 2
  { min: 54, forecast: ZONDA, smn: { nivel: "naranja", evento: "viento zonda" } },  // 3
  { min: 66, forecast: ZONDA, smn: { nivel: "amarilla", evento: "viento zonda" } }, // 2
];

// Fixed scatter around Maipú so lightning looks the same on every run.
const SCATTER = [[0, 0], [0.03, -0.02], [-0.02, 0.04], [0.04, 0.03], [-0.03, -0.03], [0.01, 0.06], [-0.05, 0.01], [0.02, -0.05], [0.05, -0.01], [-0.01, -0.06], [0.06, 0.05], [-0.04, 0.06], [0.03, 0.08], [-0.06, -0.02]];

export function simMaipuSnapshot(at: string): Snapshot {
  const start = Date.parse(SCENARIOS.maipu.start);
  const min = (Date.parse(at) - start) / 60_000;
  const step = [...STEPS].reverse().find((s) => s.min <= min) ?? STEPS[0];
  const t = new Date(start + step.min * 60_000).toISOString();

  const levels = computeLevels({
    forecast: { at: SCENARIOS.maipu.start, texto: step.forecast },
    rain: step.rainMm ? [{ at: t, departamento: "Maipú", estacion: STATION.nombre, mm: step.rainMm }] : [],
    impacts: step.hail ? { at: t, items: [step.hail] } : null,
    smn: step.smn ? [{ at: t, departamento: "Maipú", ...step.smn }] : [],
  });
  // Fictional data must never read as an official source, even in a screenshot.
  const zones = Object.fromEntries(DEPARTAMENTOS.map((d): [string, Zone] => {
    const sources = levels[d].reasons.map((r) => ({ ...r, fuente: `Simulación (${r.fuente})` }));
    return [d, { level: levels[d].level, sources, updated_at: t, summary: `Simulación: ${templateSummary(d, levels[d].level, levels[d].reasons)}` }];
  })) as Snapshot["zones"];

  const c = step.hail ?? { lat: -33.0, lng: -68.75 };
  return {
    mode: "sim", at, frames: [], zones,
    forecast: [],
    stations: [{ nombre: STATION.nombre, departamento: "Maipú", temp: step.smn ? 34 : 21, humedad: null, precipitacion: step.rainMm ?? 0, read_at: t }],
    rayos: SCATTER.slice(0, step.rayos ?? 0).map(([dy, dx]) => ({ lat: c.lat + dy, lng: c.lng + dx, departamento: "Maipú" })),
    cells: step.hail ? [{ lat: step.hail.lat, lng: step.hail.lng, prob: step.hail.prob_max, area_km2: step.hail.area_impacto_km2 }] : [],
  };
}
