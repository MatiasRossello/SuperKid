// Public JSON for external bots (Grokbot). Same data the UI shows, in plain Spanish keys, with sources and times.
import { headline, LEVEL_NAME, mission, timeMza } from "./copy.ts";
import { DEPARTAMENTOS, type Departamento } from "./departamentos.ts";
import type { Snapshot } from "./status.ts";

export const AVISO =
  "Datos oficiales de la DACC Mendoza resumidos por SuperKid. No reemplaza las alertas oficiales. Emergencias: 911.";

const MODO: Record<Snapshot["mode"], string> = { db: "en_vivo", live: "en_vivo", replay: "replay", sim: "simulacion" };

export function botResponse(snap: Snapshot, opts: { departamento?: Departamento | null; minNivel?: number } = {}) {
  const deptos = opts.departamento ? [opts.departamento] : [...DEPARTAMENTOS];
  const departamentos = deptos
    .map((d) => {
      const z = snap.zones[d];
      return {
        departamento: d,
        nivel: z.level,
        nivel_nombre: LEVEL_NAME[z.level],
        titulo: headline(z.level, z.sources, d, false),
        resumen: z.summary,
        que_hacer: mission(z.sources),
        fuentes: z.sources.map((s) => ({ fuente: s.fuente, hora: timeMza(s.at), hora_iso: s.at, datos: s.dato })),
        estaciones: snap.stations.filter((s) => s.departamento === d)
          .map((s) => ({ nombre: s.nombre, precipitacion_mm: s.precipitacion, temperatura: s.temp, hora: timeMza(s.read_at) })),
        rayos_ultimos_5_min: snap.rayos.filter((r) => r.departamento === d).length,
        actualizado: z.updated_at,
      };
    })
    .filter((z) => z.nivel >= (opts.minNivel ?? 0))
    .sort((a, b) => b.nivel - a.nivel);

  return {
    modo: MODO[snap.mode],
    generado: snap.at,
    aviso: snap.mode === "sim" ? `SIMULACIÓN CON DATOS FICTICIOS. ${AVISO}` : AVISO,
    zona_horaria: "America/Argentina/Mendoza (UTC-3)",
    escala: "nivel 0 a 5: 0 sin alerta · 1 pronóstico de tormenta · 2 lluvia medida o alerta amarilla · 3 granizo posible o alerta naranja · 4 granizo probable · 5 granizo fuerte o alerta roja",
    departamentos,
    pronostico: snap.forecast.map((f) => ({ fecha: f.fecha, texto: f.texto, maxima: f.maxima, minima: f.minima, fuente: "Pronóstico DACC" })),
  };
}
