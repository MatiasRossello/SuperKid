// Fetchers for the official sources. Server-only: none of these send CORS headers.
// Every fetcher returns null on failure and logs; callers carry on with the rest.
import type { Departamento } from "./departamentos.ts";
import { departamentoAt } from "./geo.ts";
import type { Impact } from "./level.ts";

export const DACC = "https://www2.contingencias.mendoza.gov.ar";
export const AGRO = "https://agrometeo.mendoza.gov.ar";

async function get<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000), cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as T;
  } catch (e) {
    console.error(`[source] ${url}: ${(e as Error).message}`);
    return null;
  }
}

/** "20261119" + "211600" (UTC) → ISO */
export const frameIso = (date: string, time: string) =>
  `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}Z`;

export type Frame = { date: string; time: string; types: string[] };

export async function latestFrames(): Promise<Frame[] | null> {
  const list = await get<Record<string, string[]>>(`${DACC}/radar/web/file_list.json`);
  if (!list) return null;
  const frames = new Map<string, Frame>();
  for (const [date, files] of Object.entries(list))
    for (const f of files) {
      const [time, ...rest] = f.replace(/\.png$/, "").split("_");
      const k = date + time;
      if (!frames.has(k)) frames.set(k, { date, time, types: [] });
      frames.get(k)!.types.push(rest.join("_"));
    }
  return [...frames.values()].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

export const frameImpacts = (f: Pick<Frame, "date" | "time">) =>
  get<Impact[]>(`${DACC}/radar/web/${f.date}/${f.time}_afectacion.json`);

export type Station = { estacion: string; nombre: string; lat: number; lng: number; temp: number | null; humedad: number | null; viento: number | null; precipitacion: number | null; read_at: string; departamento: Departamento | null };

const num = (s: unknown) => (s === null || s === undefined || s === "" || isNaN(Number(s)) ? null : Number(s));

export async function stations(): Promise<Station[] | null> {
  type Raw = { estacion: string; Nombre: string; lat: string; lng: string; fechaIngles: string; tempAire: string; humedad: string; velocidadViento: string; precipitacion: string };
  const raw = await get<Raw[]>(`${AGRO}/api/todas_instantaneas.json`);
  return (
    raw?.map((s) => {
      const lat = Number(s.lat), lng = Number(s.lng);
      return {
        estacion: s.estacion, nombre: s.Nombre, lat, lng,
        temp: num(s.tempAire), humedad: num(s.humedad), viento: num(s.velocidadViento), precipitacion: num(s.precipitacion),
        read_at: new Date(s.fechaIngles.replace(" ", "T") + "-03:00").toISOString(), // agrometeo is local time, unlike the radar
        departamento: departamentoAt(lat, lng),
      };
    }) ?? null
  );
}

export type Forecast = { fecha: string; texto: string; maxima: number; minima: number; alerta: number; imagen: string };

export async function forecasts(): Promise<Forecast[] | null> {
  type Raw = { fecha: string; pronostico: string; maxima: number; minima: number; alerta: number; imagenNombre: string };
  const raw = await get<Raw[]>(`${AGRO}/api/pronostico.php`);
  return raw?.map((f) => ({ fecha: f.fecha, texto: f.pronostico.trim(), maxima: f.maxima, minima: f.minima, alerta: f.alerta, imagen: f.imagenNombre })) ?? null;
}

export type Lightning = { id: number; lat: number; lng: number; e: number; fecha: string };
export const lightning = () => get<Lightning[]>(`${DACC}/rayos/rayos.json`);

/** SMN alerts, only when SMN_JWT is set. Raw payload; the zone→departamento mapping waits for a real sample. */
export async function smnRaw(): Promise<unknown | null> {
  const jwt = process.env.SMN_JWT;
  if (!jwt) return null;
  return get(`https://ws1.smn.gob.ar/v1/warning/alert/area?mode=alert&compact=true`, { headers: { Authorization: `JWT ${jwt}` } });
}

/** Today's date in Mendoza, YYYY-MM-DD. */
export const mendozaToday = (now = new Date()) => new Date(now.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
