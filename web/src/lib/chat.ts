// What SuperKid says when asked. Facts only: no advice, and no mention of the SMN by name.
// (official data), never from a model. If the snapshot has no data for the question, it says so.
import { isZonda, timeMza, topReason } from "./copy.ts";
import { CENTROS, type Departamento } from "./departamentos.ts";
import type { Reason } from "./level.ts";
import type { Snapshot } from "./status.ts";

export type Mood = "calma" | "lluvia" | "granizo" | "viento";

/** Which pose the character takes. Level 0 → calm; otherwise the strongest reason decides. */
export function moodOf(level: number, sources: Reason[]): Mood {
  const r = topReason(sources);
  if (!r || level === 0) return "calma";
  if (r.dato.fenomeno === "granizo") return "granizo";
  if (isZonda(r)) return "viento";
  return "lluvia";
}

/** Poses available per mood in /public/superkid (calma-1.webp …). */
export const POSES: Record<Mood, number> = { calma: 3, lluvia: 3, granizo: 3, viento: 2 };

export type Intent = "granizo" | "viento" | "lluvia" | "temperatura" | "manana" | "dia" | "general";

const RULES: [Intent, RegExp][] = [
  ["dia", /\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/],
  ["granizo", /granizo|granizada|piedra/],
  ["viento", /viento|zonda|rafaga/],
  ["lluvia", /llov|lluev|lluvia|paraguas|mojar|tormenta|rayo|trueno|nube/],
  ["temperatura", /temperatura|calor|frio|grados|fresco|helada/],
  ["manana", /manana|semana|proxim|pasado|despues/],
];

const plain = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

export function intentOf(question: string): Intent {
  const q = plain(question);
  return RULES.find(([, re]) => re.test(q))?.[0] ?? "general";
}

export type Reply = { intent: Intent; text: string; source: string };

const km = (a: [number, number], b: [number, number]) => {
  const rad = Math.PI / 180, dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
const deg = (t: number) => `${String(t).replace(".", ",")} °C`;

/** Closest station to the city centre that passes `ok`, with its distance in km. */
export function nearestStation(depto: string, snap: Snapshot, ok: (s: Snapshot["stations"][number]) => boolean) {
  const c = CENTROS[depto as Departamento];
  if (!c) return null;
  return snap.stations
    .filter((s) => s.lat !== undefined && s.lng !== undefined && ok(s))
    .map((s) => ({ s, km: Math.round(km(c, [s.lat!, s.lng!])) }))
    .sort((a, b) => a.km - b.km)[0] ?? null;
}

const DAY_NAMES = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const mendozaDay = (iso: string) => new Date(Date.parse(iso) - 3 * 3600_000).toISOString().slice(0, 10);
/** Next occurrence of a weekday (today included) from the snapshot's date. */
function dateForWeekday(iso: string, name: string): string {
  const target = DAY_NAMES.indexOf(name);
  const base = new Date(`${mendozaDay(iso)}T00:00:00Z`);
  const delta = (target - base.getUTCDay() + 7) % 7;
  return new Date(base.getTime() + delta * 86_400_000).toISOString().slice(0, 10);
}

const shorten = (s: string, max = 170) => {
  const one = s.replace(/\s+/g, " ").trim();
  if (one.length <= max) return one;
  const cut = one.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(" ")) + "…";
};

export function answer(question: string, depto: string, snap: Snapshot): Reply {
  const zone = snap.zones[depto as keyof Snapshot["zones"]];
  const intent = intentOf(question);
  const sim = snap.mode === "sim";
  const label = (s: string) => (sim ? `Simulación (${s})` : s);
  const src = (name: string, at: string) => `${label(name)} · ${timeMza(at)}`;
  const reply = (text: string, source: string): Reply => ({ intent, text, source });

  // strongest source with its time, the others by name only
  const clean = (f: string) => f.replace(/SMN/g, "Alerta oficial");
  const sourcesOf = (rs: Reason[]) => {
    const s = [...rs].sort((a, b) => b.level - a.level);
    if (!s.length) return "";
    const rest = [...new Set(s.slice(1).map((r) => r.fuente))].filter((f) => f !== s[0].fuente);
    return [`${clean(s[0].fuente)} ${timeMza(s[0].at)}`, ...rest.map(clean)].join(" · ");
  };
  const top = topReason(zone.sources);
  const stationsIn = snap.stations.filter((s) => s.departamento === depto);
  const general = () => {
    if (!top || zone.level === 0) {
      const t = stationsIn.find((x) => x.temp !== null) ?? nearestStation(depto, snap, (x) => x.temp !== null)?.s;
      return reply(`Sin alertas para ${depto}.${t ? ` Hace ${deg(t.temp!)}.` : ""}`, src("Radar y estaciones DACC", t?.read_at ?? zone.updated_at));
    }
    const d = top.dato;
    const text = d.fenomeno === "granizo" ? `El radar marca granizo cerca de ${d.paraje} (${depto}), con ${d.probabilidad} % de probabilidad.`
      : isZonda(top) ? `Hay alerta ${d.alerta} por ${d.evento} en ${depto}.`
      : d.alerta ? `Hay alerta ${d.alerta} por ${d.evento} en ${depto}.`
      : d.precipitacion_mm !== undefined ? `La estación ${d.estacion} midió ${d.precipitacion_mm} mm de lluvia.`
      : `El pronóstico de la DACC anuncia tormentas para ${depto}.`;
    return reply(text, sourcesOf(zone.sources));
  };

  const hail = zone.sources.find((r) => r.dato.fenomeno === "granizo");
  const rain = zone.sources.filter((r) => r.dato.precipitacion_mm !== undefined);
  const wind = zone.sources.find(isZonda);
  const stations = snap.stations.filter((s) => s.departamento === depto);

  switch (intent) {
    case "granizo":
      return hail
        ? reply(`El radar marca granizo cerca de ${hail.dato.paraje}, con ${hail.dato.probabilidad} % de probabilidad.`, sourcesOf([hail]))
        : reply(`El radar de la DACC no marca granizo en ${depto} ahora.`, src("Radar DACC", snap.at));

    case "viento":
      return wind
        ? reply(`Hay alerta ${wind.dato.alerta} por ${wind.dato.evento} en ${depto}.`, sourcesOf([wind]))
        : reply(`No tengo una alerta de viento para ${depto} ahora.`, src("Alertas", snap.at));

    case "lluvia": {
      if (rain.length) {
        const r = [...rain].sort((a, b) => Number(b.dato.precipitacion_mm) - Number(a.dato.precipitacion_mm))[0];
        return reply(`La estación ${r.dato.estacion} midió ${r.dato.precipitacion_mm} mm de lluvia.`, sourcesOf([r]));
      }
      const storm = zone.sources.find((r) => r.dato.pronostico !== undefined);
      if (storm) return reply(`El pronóstico de la DACC anuncia tormentas para ${depto}. Todavía no hay lluvia medida.`, sourcesOf([storm]));
      if (stations.length) return reply(`Ninguna estación de ${depto} registra lluvia ahora.`, src("Estaciones DACC", stations[0].read_at));
      const near = nearestStation(depto, snap, (s) => s.precipitacion !== null);
      if (near) return near.s.precipitacion
        ? reply(`La estación más cercana a ${depto}, ${near.s.nombre} (a ${near.km} km), midió ${near.s.precipitacion} mm.`, src("Estación DACC", near.s.read_at))
        : reply(`No está lloviendo cerca de ${depto}: la estación ${near.s.nombre} (a ${near.km} km) marca 0 mm.`, src("Estación DACC", near.s.read_at));
      return reply(`No tengo datos de lluvia para ${depto} por ahora.`, src("Estaciones DACC", snap.at));
    }

    case "temperatura": {
      const s = stations.find((x) => x.temp !== null);
      if (s) return reply(`La estación ${s.nombre} marca ${deg(s.temp!)}.`, src("Estación DACC", s.read_at));
      const near = nearestStation(depto, snap, (x) => x.temp !== null);
      if (near) return reply(`Cerca de ${depto} hace ${deg(near.s.temp!)}. Lo mide la estación ${near.s.nombre}, a ${near.km} km.`, src("Estación DACC", near.s.read_at));
      const today = new Date(Date.parse(snap.at) - 3 * 3600_000).toISOString().slice(0, 10);
      const f = snap.forecast.find((x) => x.fecha === today);
      if (f) return reply(`Hoy el pronóstico marca máxima de ${f.maxima}° y mínima de ${f.minima}°.`, src("Pronóstico DACC", snap.at));
      return reply(`No tengo temperatura para ${depto} por ahora.`, src("Estaciones DACC", snap.at));
    }

    case "manana": {
      const tomorrow = new Date(Date.parse(snap.at) - 3 * 3600_000 + 86_400_000).toISOString().slice(0, 10);
      const f = snap.forecast.find((x) => x.fecha === tomorrow) ?? snap.forecast[1];
      if (!f) return reply("No tengo el pronóstico de los próximos días por ahora.", src("Pronóstico DACC", snap.at));
      return reply(`Mañana: ${shorten(f.texto)} Máxima ${f.maxima}°, mínima ${f.minima}°.`, src("Pronóstico DACC", snap.at));
    }

    case "dia": {
      const m = plain(question).match(/\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/);
      const date = m ? dateForWeekday(snap.at, m[1]) : null;
      const f = date ? snap.forecast.find((x) => x.fecha === date) : undefined;
      if (!f) return reply(`No tengo el pronóstico para ese día en ${depto}.`, src("Pronóstico DACC", snap.at));
      const name = m ? m[1][0].toUpperCase() + m[1].slice(1) : "Ese día";
      return reply(`${name} ${f.fecha}: ${shorten(f.texto)} Máxima ${f.maxima}°, mínima ${f.minima}°.`, src("Pronóstico DACC", snap.at));
    }

    default:
      return general();
  }
}

/** Everything official we know for this departamento, as the model sees it. Nothing else reaches the model. */
export function chatFacts(depto: string, snap: Snapshot) {
  const zone = snap.zones[depto as keyof Snapshot["zones"]];
  const local = (iso: string) => timeMza(iso);
  const inDepto = snap.stations.filter((s) => s.departamento === depto);
  const near = inDepto.length ? null : nearestStation(depto, snap, (s) => s.temp !== null || s.precipitacion !== null);
  const today = new Date(Date.parse(snap.at) - 3 * 3600_000).toISOString().slice(0, 10);
  return {
    departamento: depto,
    hora_actual: local(snap.at),
    ...(snap.mode === "sim" || snap.mode === "replay" ? { aviso: "Esto es una simulación, no el tiempo real." } : {}),
    nivel_alerta: `${zone.level} de 5`,
    alertas: zone.sources.map((r) => ({ fuente: r.fuente.replace(/SMN/g, "Alerta oficial"), hora: local(r.at), ...r.dato })),
    estaciones: (inDepto.length ? inDepto : near ? [near.s] : []).map((s) => ({
      nombre: s.nombre,
      ...(near ? { distancia_km: near.km, nota: `No hay estación en ${depto}; es la más cercana.` } : {}),
      temperatura_c: s.temp, lluvia_mm: s.precipitacion, hora: local(s.read_at),
    })),
    rayos_ultimos_5_min: snap.rayos.filter((r) => r.departamento === depto).length,
    pronostico: snap.forecast.slice(0, 3).map((f) => ({ dia: f.fecha === today ? "hoy" : f.fecha, texto: f.texto, maxima_c: f.maxima, minima_c: f.minima })),
  };
}
