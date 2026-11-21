// What the UI reads: one snapshot for all departamentos (same response for everyone → CDN-cacheable).
import replay from "../data/replay.json" with { type: "json" };
import { DEPARTAMENTOS, type Departamento } from "./departamentos.ts";
import { departamentoAt } from "./geo.ts";
import { computeLevels, type Impact, type Reason } from "./level.ts";
import { inBounds, type FrameRef } from "./radar.ts";
import * as src from "./sources.ts";
import type { ScenarioId } from "./scenarios.ts";
import { simMaipuSnapshot } from "./sim-maipu.ts";
import { templateSummary } from "./summary.ts";

export type Zone = { level: number; summary: string; sources: Reason[]; updated_at: string };
export type Snapshot = {
  mode: "db" | "live" | "replay" | "sim";
  at: string;
  frames: FrameRef[]; // last ~30 min, oldest first
  zones: Record<Departamento, Zone>;
  forecast: src.Forecast[];
  stations: (Pick<src.Station, "nombre" | "departamento" | "temp" | "humedad" | "precipitacion" | "read_at"> & { lat?: number; lng?: number })[];
  rayos: { lat: number; lng: number; departamento: Departamento | null }[]; // last 5 min, inside radar bounds
  cells?: { lat: number; lng: number; prob: number; area_km2: number }[]; // simulation only: no radar PNG
};

// ponytail: per-instance memory cache; the CDN header on /api/status does the real work
const memo = new Map<string, { t: number; v: Promise<unknown> }>();
function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.t < ttlMs) return hit.v as Promise<T>;
  const v = fn();
  memo.set(key, { t: Date.now(), v });
  return v;
}

const TWO_MIN = 120_000;

async function rayosRecent(now: number) {
  const all = await cached("rayos", TWO_MIN, src.lightning);
  const day = new Date(now).toISOString().slice(0, 10);
  return (all ?? [])
    .filter((r) => inBounds(r.lat, r.lng))
    .filter((r) => {
      let t = Date.parse(`${day}T${r.fecha}Z`);
      if (t > now + 60_000) t -= 86_400_000; // feed only has HH:MM:SS (UTC)
      return now - t < 5 * 60_000;
    })
    .map((r) => ({ lat: r.lat, lng: r.lng, departamento: departamentoAt(r.lat, r.lng) }));
}

const zonesFrom = (levels: ReturnType<typeof computeLevels>, at: string) =>
  Object.fromEntries(DEPARTAMENTOS.map((d): [Departamento, Zone] => [d, { level: levels[d].level, sources: levels[d].reasons, summary: templateSummary(d, levels[d].level, levels[d].reasons), updated_at: at }])) as Record<Departamento, Zone>;

async function live(): Promise<Snapshot> {
  const now = Date.now();
  const [frames, stations, forecast, rayos] = await Promise.all([
    cached("frames", TWO_MIN, src.latestFrames),
    cached("stations", TWO_MIN, src.stations),
    cached("forecast", TWO_MIN, src.forecasts),
    rayosRecent(now),
  ]);
  const last = frames?.at(-1);
  const items = last ? await cached(`imp${last.date}${last.time}`, TWO_MIN, () => src.frameImpacts(last)) : null;
  const today = forecast?.find((f) => f.fecha === src.mendozaToday());
  const at = new Date(now).toISOString();
  const levels = computeLevels({
    impacts: last && items ? { at: src.frameIso(last.date, last.time), items } : null,
    forecast: today ? { at, texto: today.texto } : null,
    rain: (stations ?? []).filter((s) => s.departamento && s.precipitacion && now - Date.parse(s.read_at) < 3600_000)
      .map((s) => ({ at: s.read_at, departamento: s.departamento!, estacion: s.nombre, mm: s.precipitacion! })),
    smn: [],
  });
  return {
    mode: "live", at,
    frames: (frames ?? []).filter((f) => f.types.includes("dbz")).slice(-15).map(({ date, time }) => ({ date, time })),
    zones: zonesFrom(levels, at),
    forecast: forecast ?? [],
    stations: (stations ?? []).map(({ nombre, departamento, temp, humedad, precipitacion, read_at, lat, lng }) => ({ nombre, departamento, temp, humedad, precipitacion, read_at, lat, lng })),
    rayos,
  };
}

async function fromDb(): Promise<Snapshot> {
  const { db } = await import("./db.ts");
  const base = await live(); // radar list, stations, forecast and rayos are cached fetches anyway
  const { data, error } = await db().from("zone_status").select("departamento, level, summary, sources, updated_at");
  if (error || !data?.length) return base; // DB down → still show live data
  for (const z of data) if (z.departamento in base.zones) base.zones[z.departamento as Departamento] = z as Zone;
  return { ...base, mode: "db" };
}

const REPLAY = replay as Record<string, Impact[]>;
const REPLAY_KEYS = Object.keys(REPLAY).sort();


/** State of the 18–19/11 storm at virtual time `at`. Forecast and stations weren't archived, so they stay empty. */
export function replaySnapshot(at: string): Snapshot {
  const k = at.replace(/[-:T]/g, "").slice(0, 14); // "2026-11-19T21:16:00Z" → "20261119211600"
  const upto = REPLAY_KEYS.filter((x) => x <= k);
  const keys = (upto.length ? upto : REPLAY_KEYS.slice(0, 1)).slice(-15);
  const last = keys.at(-1)!;
  const frame = { date: last.slice(0, 8), time: last.slice(8) };
  const levels = computeLevels({ impacts: { at: src.frameIso(frame.date, frame.time), items: REPLAY[last] }, forecast: null, rain: [], smn: [] });
  return {
    mode: "replay", at,
    frames: keys.map((x) => ({ date: x.slice(0, 8), time: x.slice(8) })),
    zones: zonesFrom(levels, src.frameIso(frame.date, frame.time)),
    forecast: [], stations: [], rayos: [],
  };
}

export const snapshot = () => (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? fromDb() : live());

export const scenarioSnapshot = (id: ScenarioId, at: string): Snapshot => (id === "maipu" ? simMaipuSnapshot(at) : replaySnapshot(at));
