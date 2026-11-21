// What SuperKid says when asked. Facts only: no advice, and no mention of the SMN by name.
// (official data), never from a model. If the snapshot has no data for the question, it says so.
import { isZonda, timeMza, topReason } from "./copy.ts";
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

export type Intent = "granizo" | "viento" | "lluvia" | "temperatura" | "manana" | "general";

const RULES: [Intent, RegExp][] = [
  ["granizo", /granizo|granizada|piedra/],
  ["viento", /viento|zonda|rafaga/],
  ["lluvia", /llov|lluvia|paraguas|mojar|tormenta|rayo|trueno|nube/],
  ["temperatura", /temperatura|calor|frio|grados|fresco|helada/],
  ["manana", /manana|semana|proxim|pasado|despues/],
];

const plain = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

export function intentOf(question: string): Intent {
  const q = plain(question);
  return RULES.find(([, re]) => re.test(q))?.[0] ?? "general";
}

export type Reply = { intent: Intent; text: string; source: string };

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
  const general = () => {
    if (!top || zone.level === 0) return reply(`Sin alertas para ${depto} por ahora.`, src("Radar y estaciones DACC", zone.updated_at));
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
      return reply(`No tengo datos de estaciones en ${depto} por ahora.`, src("Estaciones DACC", snap.at));
    }

    case "temperatura": {
      const s = stations.find((x) => x.temp !== null);
      if (s) return reply(`La estación ${s.nombre} marca ${s.temp} °C.`, src("Estación DACC", s.read_at));
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

    default:
      return general();
  }
}
