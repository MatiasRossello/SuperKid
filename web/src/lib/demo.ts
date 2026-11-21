// Demo data: location + day-by-day weather. Client-safe (no server imports).
// The demo feeds the same computeLevels / prompt path as real data, so the app and the model
// behave as if it were a real forecast. The UI always labels it as fictitious.
import { isDepartamento, type Departamento } from "./departamentos.ts";
import type { SummaryExtra } from "./summary.ts";

export const DEMO_CONDITIONS = [
  { id: "calma", label: "Sin alerta" },
  { id: "tormenta", label: "Tormentas en el pronóstico" },
  { id: "lluvia", label: "Lluvia" },
  { id: "granizo", label: "Granizo" },
  { id: "zonda", label: "Viento Zonda" },
  { id: "amarilla", label: "Alerta amarilla" },
  { id: "naranja", label: "Alerta naranja" },
  { id: "roja", label: "Alerta roja" },
] as const;

export type DemoCondition = (typeof DEMO_CONDITIONS)[number]["id"];

export type DemoDay = {
  date: string; // YYYY-MM-DD (Mendoza)
  condition: DemoCondition;
  mm?: number; // rain measured today
  prob?: number; // hail probability
  area_km2?: number; // hail area
  max?: number;
  min?: number;
};

export type DemoConfig = { departamento: Departamento; days: DemoDay[] };

export const isDemoCondition = (s: unknown): s is DemoCondition =>
  DEMO_CONDITIONS.some((c) => c.id === s);

export const conditionLabel = (c: DemoCondition) =>
  DEMO_CONDITIONS.find((x) => x.id === c)?.label ?? c;

/** Today's date in Mendoza (UTC-3), as YYYY-MM-DD. */
export const mendozaToday = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

export const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const isNum = (n: unknown) => typeof n === "number" && Number.isFinite(n);

export function isDemoConfig(v: unknown): v is DemoConfig {
  if (!v || typeof v !== "object") return false;
  const c = v as Partial<DemoConfig>;
  if (!isDepartamento(c.departamento) || !Array.isArray(c.days) || c.days.length < 1 || c.days.length > 7) return false;
  return c.days.every((d) => !!d && isDate(d.date) && isDemoCondition(d.condition) &&
    (!("mm" in d) || d.mm === undefined || isNum(d.mm)) &&
    (!("prob" in d) || d.prob === undefined || isNum(d.prob)) &&
    (!("area_km2" in d) || d.area_km2 === undefined || isNum(d.area_km2)) &&
    (!("max" in d) || d.max === undefined || isNum(d.max)) &&
    (!("min" in d) || d.min === undefined || isNum(d.min)));
}

export function defaultDemoConfig(departamento: Departamento): DemoConfig {
  const today = mendozaToday();
  return {
    departamento,
    days: [
      { date: today, condition: "lluvia", mm: 12, max: 26, min: 16 },
      { date: addDays(today, 1), condition: "calma", max: 28, min: 17 },
      { date: addDays(today, 2), condition: "calma", max: 29, min: 18 },
    ],
  };
}

/** Forecast prose per condition. The words "tormenta"/"granizo" also drive the level-1 forecast rule. */
export function forecastText(condition: DemoCondition, d: Departamento): string {
  switch (condition) {
    case "calma": return "Cielo despejado, sin alertas.";
    case "tormenta": return `Tormentas aisladas en ${d}.`;
    case "lluvia": return `Lluvia y chaparrones en ${d}.`;
    case "granizo": return `Tormentas con posible caída de granizo en ${d}.`;
    case "zonda": return `Viento Zonda en ${d}.`;
    case "amarilla": return `Alerta amarilla por tormentas en ${d}.`;
    case "naranja": return `Alerta naranja por tormentas en ${d}.`;
    case "roja": return `Alerta roja por tormentas en ${d}.`;
  }
}

/** `alerta` field of the DACC forecast: 0 none, 1 amarilla, 2 naranja, 3 roja. */
export const alertLevel = (c: DemoCondition) => (c === "amarilla" ? 1 : c === "naranja" ? 2 : c === "roja" ? 3 : 0);

/** Extra context for the model prompt: demo date + the multi-day forecast the user configured. */
export function demoSummaryExtra(config: DemoConfig): SummaryExtra {
  return {
    fecha: config.days[0]?.date,
    pronostico: config.days.map((d) => ({
      fecha: d.date,
      condicion: conditionLabel(d.condition),
      texto: forecastText(d.condition, config.departamento),
      maxima: d.max ?? 28,
      minima: d.min ?? 16,
    })),
  };
}
