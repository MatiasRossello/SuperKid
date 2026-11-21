// Client-safe UI copy derived only from the zone's reasons. Never adds facts.
import type { Reason } from "./level.ts";

const isZonda = (r: Reason) => /zonda|viento/i.test(String(r.dato.evento ?? ""));

export const topReason = (sources: Reason[]) => [...sources].sort((a, b) => b.level - a.level)[0] as Reason | undefined;

/** Short title. Upper case for the big display type, sentence case for cards. */
export function headline(level: number, sources: Reason[], depto: string, upper = true): string {
  const r = topReason(sources);
  const t = !r || level === 0 ? "Todo tranqui"
    : r.dato.fenomeno === "granizo" ? `Granizo en ${depto}`
    : isZonda(r) ? `Zonda en ${depto}`
    : r.dato.alerta ? `Alerta ${r.dato.alerta} del SMN`
    : r.dato.precipitacion_mm !== undefined ? `Llueve en ${depto}`
    : "Tormentas en el pronóstico";
  return upper ? t.toUpperCase() : t;
}

/** Generic safety steps per phenomenon (advice, not data). */
export function mission(sources: Reason[]): string[] {
  const r = topReason(sources);
  if (r?.dato.fenomeno === "granizo") return ["Guardá el auto bajo techo", "Evitá la ruta mientras dure", "Quedate lejos de ventanas"];
  if (r && isZonda(r)) return ["Asegurá macetas y objetos sueltos", "Alejate de árboles y cables", "No hagas fuego al aire libre"];
  if (r?.dato.precipitacion_mm !== undefined) return ["Manejá despacio y con luces", "No cruces calles inundadas", "Revisá desagües y canaletas"];
  if (r) return ["Tené a mano dónde guardar el auto", "Seguí las alertas oficiales", "Cargá el celular por las dudas"];
  return [];
}

export const timeMza = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Mendoza" });

export const LEVEL_NAME = ["Sin alerta", "Atento", "Precaución", "Alerta", "Peligro", "Peligro extremo"];
